/**
 * The same two-level proof, over a sample spread across the whole penalty
 * history rather than the most recent handful — the failure era carried fatter
 * transactions, and a proof-size claim taken only from quiet recent blocks would
 * understate the worst case.
 *
 * Also decodes the commitment-lock args, to show concretely why L2 lands on a
 * funding outpoint and not on a node.
 */

import { DatabaseSync } from 'node:sqlite';
import { getBlockByNumber, getTransaction, rpc } from './rpc.js';
import { ckbhash } from './blake2b.js';
import { rawTransaction, transaction } from './molecule.js';
import { merkleRoot, merkleProof, rootFromProof, merge } from './cbmt.js';

const DB = process.env.FIBER_ATLAS_DB;
if (!DB) throw new Error('set FIBER_ATLAS_DB to a fiber-atlas testnet archive');
const SAMPLE = Number(process.env.N ?? 60);
const CONCURRENCY = Number(process.env.C ?? 6);

const blockCache = new Map();

async function blockRoots(n) {
  const key = String(n);
  if (blockCache.has(key)) return blockCache.get(key);
  const p = (async () => {
    const b = await getBlockByNumber(n);
    const txHashes = b.transactions.map((t) => Buffer.from(t.hash.slice(2), 'hex'));
    const witHashes = b.transactions.map((t) => ckbhash(transaction(t)));
    return { b, txHashes, witHashes, rawRoot: merkleRoot(txHashes), witRoot: merkleRoot(witHashes) };
  })();
  blockCache.set(key, p);
  return p;
}

function prove(ctx, txHash, withWitness) {
  const idx = ctx.b.transactions.findIndex((t) => t.hash === txHash);
  if (idx < 0) return null;
  const tx = ctx.b.transactions[idx];
  const preimage = withWitness ? transaction(tx) : rawTransaction(tx);
  const leaves = withWitness ? ctx.witHashes : ctx.txHashes;
  const siblings = merkleProof(leaves, idx);
  const half = rootFromProof(ckbhash(preimage), siblings);
  const root = withWitness ? merge(ctx.rawRoot, half) : merge(half, ctx.witRoot);
  return {
    tx,
    verified: root.toString('hex') === ctx.b.header.transactions_root.slice(2),
    size: preimage.length + siblings.length * 32 + 32 /* sibling root */ + 32 /* header dep */,
    depth: siblings.length,
    txBytes: preimage.length,
    blockTxs: ctx.b.transactions.length,
  };
}

async function mapPool(items, fn, limit) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (i < items.length) {
        const k = i++;
        try {
          out[k] = await fn(items[k]);
        } catch (e) {
          out[k] = { error: String(e.message ?? e) };
        }
      }
    }),
  );
  return out;
}

const db = new DatabaseSync(DB, { readOnly: true });
// Spread the sample evenly across the ordered penalty history.
const all = db
  .prepare(`SELECT block_number, tx_hash, channel_outpoint, detail FROM event
             WHERE kind='penalty' ORDER BY block_number`)
  .all();
const step = Math.max(1, Math.floor(all.length / SAMPLE));
const sample = all.filter((_, i) => i % step === 0).slice(0, SAMPLE);
console.log(`sampling ${sample.length} of ${all.length} penalties, every ${step}th, ` +
  `blocks ${sample[0].block_number}–${sample.at(-1).block_number}\n`);

const results = await mapPool(
  sample,
  async (p) => {
    const commitmentTxHash = JSON.parse(p.detail).commitment_outpoint.split(':')[0];
    const ctx1 = await blockRoots(p.block_number);
    const l1 = prove(ctx1, p.tx_hash, true);
    if (!l1) return { error: 'penalty tx not in block' };

    const fc = await getTransaction(commitmentTxHash);
    if (!fc?.tx_status?.block_hash) return { error: 'force-close tx unconfirmed' };
    const h = await rpc('get_header', [fc.tx_status.block_hash]);
    const ctx2 = await blockRoots(BigInt(h.number));
    const l2 = prove(ctx2, commitmentTxHash, false);
    if (!l2) return { error: 'force-close tx not in block' };

    const inputIdx = l1.tx.inputs.findIndex((i) => i.previous_output.tx_hash === commitmentTxHash);
    const witness = l1.tx.witnesses[inputIdx];
    const unlockCount = parseInt(witness.slice(2).slice(32, 34), 16);
    const funding = l2.tx.inputs.map((i) => `${i.previous_output.tx_hash}:${BigInt(i.previous_output.index)}`);
    const commitmentArgs = l2.tx.outputs
      .filter((o) => o.lock.code_hash === '0x740dee83f87c6f309824d8fd3fbdd3c8380ee6fc9acc90b1a748438afcdf81d8')
      .map((o) => o.lock.args);

    return {
      block: p.block_number,
      l1, l2,
      total: l1.size + l2.size,
      unlockCount,
      fundingMatches: funding.includes(p.channel_outpoint),
      commitmentArgs,
    };
  },
  CONCURRENCY,
);

const ok = results.filter((r) => r && !r.error);
const errs = results.filter((r) => r?.error);
const bad = ok.filter((r) => !r.l1.verified || !r.l2.verified);

const sizes = ok.map((r) => r.total).sort((a, b) => a - b);
const pct = (p) => sizes[Math.min(sizes.length - 1, Math.floor((sizes.length - 1) * p))];

console.log(`verified          ${ok.length - bad.length}/${ok.length}` +
  `${bad.length ? '  ** ' + bad.length + ' FAILED **' : ''}`);
console.log(`unlock_count==0   ${ok.filter((r) => r.unlockCount === 0).length}/${ok.length}`);
console.log(`funding matched   ${ok.filter((r) => r.fundingMatches).length}/${ok.length}` +
  `   (independent cross-check against the indexed channel_outpoint)`);
if (errs.length) console.log(`errors            ${errs.length}: ${[...new Set(errs.map((e) => e.error))].join('; ')}`);

console.log(`\nproof size   min ${sizes[0]}B  p50 ${pct(0.5)}B  p90 ${pct(0.9)}B  max ${sizes.at(-1)}B`);
console.log(`  L1 tx bytes  p50 ${ok.map(r=>r.l1.txBytes).sort((a,b)=>a-b)[Math.floor(ok.length/2)]}B` +
  `  max ${Math.max(...ok.map(r=>r.l1.txBytes))}B`);
console.log(`  merkle depth min ${Math.min(...ok.map(r=>r.l1.depth))}  max ${Math.max(...ok.map(r=>r.l1.depth))}` +
  `  (block tx count max ${Math.max(...ok.map(r=>r.l1.blockTxs))})`);
console.log(`  fee @1 shannon/B  p50 ${(pct(0.5)/1e8).toFixed(8)} CKB   max ${(sizes.at(-1)/1e8).toFixed(8)} CKB`);
console.log(`  share of CKB's 512KB max tx size: ${((sizes.at(-1)/524288)*100).toFixed(2)}%`);

const args = ok.flatMap((r) => r.commitmentArgs);
console.log(`\ncommitment-lock args: ${args.length} seen, lengths ` +
  `${[...new Set(args.map((a) => a.length / 2 - 1))].join(',')} bytes`);
console.log(`  sample ${args[0]}`);
console.log(`  distinct values: ${new Set(args).size} of ${args.length} — ` +
  `per-channel derived, so they identify a channel, never a node`);
