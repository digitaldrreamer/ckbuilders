/**
 * Can a CKB script verify that a given node's channel was penalised?
 *
 * The penalty predicate Faultline uses lives in *witness* data
 * (`unlock_count == 0x00`, src/faultline/classify.ts), and witness data is the
 * hardest thing on chain for a script to reach: it is not in any live cell, so
 * it cannot arrive as a cell_dep. The only route is a Merkle inclusion proof
 * against a block header supplied via header_deps.
 *
 * This builds that proof for real testnet penalties and measures it. Two levels
 * are needed, because a penalty transaction names the commitment cell it spent,
 * not the channel:
 *
 *   L1  penalty tx  ∈ witnesses_root       — carries the witness, proves cheating
 *   L2  force-close tx ∈ raw_transactions_root — proves that commitment cell came
 *                                             from funding outpoint F
 *
 *   (L3, the binding F → node_pubkey, is a signature the bonded node produced
 *    itself. Not measured here: it is one signature, and it is the part that does
 *    not exist yet.)
 */

import { DatabaseSync } from 'node:sqlite';
import { getBlockByNumber, getTransaction, rpc } from './rpc.js';
import { ckbhash } from './blake2b.js';
import { rawTransaction, transaction } from './molecule.js';
import { merkleRoot, merkleProof, rootFromProof, merge } from './cbmt.js';

const DB = process.env.FIBER_ATLAS_DB;
if (!DB) throw new Error('set FIBER_ATLAS_DB to a fiber-atlas testnet archive');
const hexLen = (h) => h.length / 2 - 1;

/** Every transaction in a block, with the two roots the header commits to. */
async function blockRoots(blockNumber) {
  const b = await getBlockByNumber(blockNumber);
  const txHashes = b.transactions.map((t) => Buffer.from(t.hash.slice(2), 'hex'));
  const witHashes = b.transactions.map((t) => ckbhash(transaction(t)));
  return {
    block: b,
    txHashes,
    witHashes,
    rawRoot: merkleRoot(txHashes),
    witRoot: merkleRoot(witHashes),
  };
}

/**
 * L1 — prove the penalty transaction, *including its witnesses*, is in a block.
 * The verifier gets: the serialised tx, the sibling chain, and the sibling root.
 */
function proveWitness(ctx, txHash) {
  const idx = ctx.block.transactions.findIndex((t) => t.hash === txHash);
  if (idx < 0) throw new Error(`${txHash} not in block`);
  const tx = ctx.block.transactions[idx];
  const preimage = transaction(tx);
  const siblings = merkleProof(ctx.witHashes, idx);

  // Replay exactly as a script would: hash the supplied bytes, fold up the
  // siblings, combine with the sibling root, compare to the header.
  const leaf = ckbhash(preimage);
  const witRoot = rootFromProof(leaf, siblings);
  const root = merge(ctx.rawRoot, witRoot);

  return {
    tx,
    verified: root.toString('hex') === ctx.block.header.transactions_root.slice(2),
    bytes: {
      serialisedTx: preimage.length,
      siblings: siblings.length * 32,
      siblingRoot: 32,
      headerDep: 32,
    },
    depth: siblings.length,
  };
}

/** L2 — prove a transaction (no witnesses needed) is in a block. */
function proveRaw(ctx, txHash) {
  const idx = ctx.block.transactions.findIndex((t) => t.hash === txHash);
  if (idx < 0) throw new Error(`${txHash} not in block`);
  const tx = ctx.block.transactions[idx];
  const preimage = rawTransaction(tx);
  const siblings = merkleProof(ctx.txHashes, idx);
  const rawRoot = rootFromProof(ckbhash(preimage), siblings);
  const root = merge(rawRoot, ctx.witRoot);

  return {
    tx,
    verified: root.toString('hex') === ctx.block.header.transactions_root.slice(2),
    bytes: {
      serialisedTx: preimage.length,
      siblings: siblings.length * 32,
      siblingRoot: 32,
      headerDep: 32,
    },
    depth: siblings.length,
  };
}

const total = (b) => Object.values(b).reduce((a, x) => a + x, 0);

async function main() {
  const db = new DatabaseSync(DB, { readOnly: true });
  const penalties = db
    .prepare(
      `SELECT block_number, tx_hash, channel_outpoint, detail
         FROM event WHERE kind='penalty' ORDER BY block_number DESC LIMIT ?`,
    )
    .all(Number(process.env.N ?? 5));

  const results = [];

  for (const p of penalties) {
    const detail = JSON.parse(p.detail);
    const commitmentTxHash = detail.commitment_outpoint.split(':')[0];

    // L1: the penalty itself.
    const ctx1 = await blockRoots(p.block_number);
    const l1 = proveWitness(ctx1, p.tx_hash);

    // The witness is what the whole scheme rests on — decode it the way
    // classify.ts does, from the proven bytes rather than from the RPC.
    const inputIdx = l1.tx.inputs.findIndex(
      (i) => i.previous_output.tx_hash === commitmentTxHash,
    );
    const witness = l1.tx.witnesses[inputIdx];
    const unlockCount = parseInt(witness.slice(2).slice(32, 34), 16);

    // L2: the force close that created the commitment cell.
    const fc = await getTransaction(commitmentTxHash);
    const fcBlock = BigInt(await rpc('get_header', [fc.tx_status.block_hash]).then((h) => h.number));
    const ctx2 = await blockRoots(fcBlock);
    const l2 = proveRaw(ctx2, commitmentTxHash);

    const fundingOutpoints = l2.tx.inputs.map(
      (i) => `${i.previous_output.tx_hash}:${BigInt(i.previous_output.index)}`,
    );

    results.push({
      penaltyTx: p.tx_hash,
      block: p.block_number,
      l1,
      l2,
      unlockCount,
      witnessBytes: hexLen(witness),
      fundingOutpoints,
      claimedChannel: p.channel_outpoint,
    });

    const t = total(l1.bytes) + total(l2.bytes);
    console.log(`penalty ${p.tx_hash.slice(0, 18)}… block ${p.block_number}`);
    console.log(
      `  L1 witness proof  ${l1.verified ? 'VERIFIED' : 'FAILED'}  ` +
        `tx ${l1.bytes.serialisedTx}B + ${l1.depth} siblings (${l1.bytes.siblings}B) ` +
        `= ${total(l1.bytes)}B`,
    );
    console.log(
      `  L2 funding proof  ${l2.verified ? 'VERIFIED' : 'FAILED'}  ` +
        `tx ${l2.bytes.serialisedTx}B + ${l2.depth} siblings (${l2.bytes.siblings}B) ` +
        `= ${total(l2.bytes)}B`,
    );
    console.log(
      `  unlock_count=${unlockCount} (${unlockCount === 0 ? 'penalty' : 'settlement'}) ` +
        `· funding ${fundingOutpoints[0]?.slice(0, 18)}… ` +
        `· matches indexed channel: ${fundingOutpoints.includes(p.channel_outpoint)}`,
    );
    console.log(`  TOTAL PROOF ${t}B`);
  }

  const totals = results.map((r) => total(r.l1.bytes) + total(r.l2.bytes));
  const avg = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
  console.log(`\n${results.length} penalties · all verified: ` +
    `${results.every((r) => r.l1.verified && r.l2.verified)}`);
  console.log(`proof size min ${Math.min(...totals)}B  avg ${avg}B  max ${Math.max(...totals)}B`);
  // CKB's minimum fee rate is 1000 shannons/KB, i.e. 1 shannon per byte.
  console.log(`fee at 1 shannon/byte: ~${(avg / 1e8).toFixed(8)} CKB (${avg} shannons)`);
}

await main();
