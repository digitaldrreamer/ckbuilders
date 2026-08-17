/**
 * Half of testnet's penalties carry no `channel_outpoint` in the Faultline index.
 * They are not unattributable in principle: their commitment cell was created by
 * spending *another* commitment cell, so the funding cell is further back than
 * one hop. This walks that chain to the funding-lock input and measures how deep
 * it goes — which sets both the real slash-proof size and the attribution
 * recovery available to Atlas today.
 */

import { DatabaseSync } from 'node:sqlite';
import { getTransaction } from './rpc.js';
import { ckbhash } from './blake2b.js';
import { rawTransaction } from './molecule.js';

const FUNDING = '0x6c67887fe201ee0c7853f1682c0b77c0e6214044c156c7558269390a8afa6d7c';
const COMMIT = '0x740dee83f87c6f309824d8fd3fbdd3c8380ee6fc9acc90b1a748438afcdf81d8';
const MAX_HOPS = 24;

const txCache = new Map();
const getTx = (h) => {
  if (!txCache.has(h)) txCache.set(h, getTransaction(h));
  return txCache.get(h);
};

/** Walk back from a commitment cell until the input is a funding cell. */
async function walkToFunding(commitmentTxHash) {
  let cursor = commitmentTxHash;
  const hops = [];

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const res = await getTx(cursor);
    const tx = res?.transaction;
    if (!tx) return { ok: false, reason: 'tx missing', hops };

    // Serialised size of this level's raw tx: what a slash proof would carry.
    hops.push({ txHash: cursor, rawBytes: rawTransaction(tx).length });

    let next = null;
    for (const i of tx.inputs) {
      const prev = await getTx(i.previous_output.tx_hash);
      const out = prev?.transaction?.outputs?.[Number(BigInt(i.previous_output.index))];
      if (!out) continue;
      if (out.lock.code_hash === FUNDING) {
        return {
          ok: true,
          hops,
          funding: `${i.previous_output.tx_hash}:${BigInt(i.previous_output.index)}`,
          fundingArgs: out.lock.args,
        };
      }
      if (out.lock.code_hash === COMMIT) next = i.previous_output.tx_hash;
    }
    if (!next) return { ok: false, reason: 'no funding or commitment input', hops };
    cursor = next;
  }
  return { ok: false, reason: `exceeded ${MAX_HOPS} hops`, hops };
}

if (!process.env.FIBER_ATLAS_DB) {
  throw new Error('set FIBER_ATLAS_DB to a fiber-atlas testnet archive');
}
const db = new DatabaseSync(process.env.FIBER_ATLAS_DB, { readOnly: true });
const rows = db
  .prepare(
    `SELECT tx_hash, detail, channel_outpoint FROM event
      WHERE kind='penalty' AND channel_outpoint IS NULL ORDER BY block_number DESC LIMIT ?`,
  )
  .all(Number(process.env.N ?? 25));

console.log(`walking ${rows.length} penalties Faultline left unattributed\n`);

let recovered = 0;
const depths = [];
const extraBytes = [];
const reasons = new Map();

await Promise.all(
  Array.from({ length: 5 }, async function worker(_, __) {
    while (rows.length) {
      const r = rows.pop();
      if (!r) return;
      const ctx = JSON.parse(r.detail).commitment_outpoint.split(':')[0];
      try {
        const res = await walkToFunding(ctx);
        if (res.ok) {
          recovered++;
          depths.push(res.hops.length);
          extraBytes.push(res.hops.reduce((a, h) => a + h.rawBytes + 32 * 10 + 64, 0));
        } else {
          reasons.set(res.reason, (reasons.get(res.reason) ?? 0) + 1);
        }
      } catch (e) {
        reasons.set(String(e.message ?? e), (reasons.get(String(e.message ?? e)) ?? 0) + 1);
      }
    }
  }),
);

const med = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(`funding cell recovered for ${recovered}/${recovered + [...reasons.values()].reduce((a, b) => a + b, 0)}`);
if (depths.length) {
  console.log(`chain depth  min ${Math.min(...depths)}  median ${med([...depths])}  max ${Math.max(...depths)} hops`);
  console.log(`extra proof bytes for the chain  median ${med([...extraBytes])}B  max ${Math.max(...extraBytes)}B`);
}
if (reasons.size) console.log(`unresolved:`, Object.fromEntries(reasons));
