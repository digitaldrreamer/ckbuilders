/**
 * CKB's Complete Binary Merkle Tree.
 *
 * Laid out in a flat array of 2n-1 nodes: the root is index 0, leaf i sits at
 * index i+n-1, and every internal node i is merge(2i+1, 2i+2). This is the shape
 * a verifier walks, so proofs are just the sibling chain from a leaf to the root.
 *
 * The layout is confirmed against a real testnet header rather than taken on
 * trust — see verify-root.js.
 */

import { ckbhash } from './blake2b.js';

export const merge = (l, r) => ckbhash(Buffer.concat([l, r]));

export function buildTree(leaves) {
  const n = leaves.length;
  if (n === 0) return [Buffer.alloc(32)];
  const nodes = new Array(2 * n - 1);
  for (let i = 0; i < n; i++) nodes[i + n - 1] = leaves[i];
  for (let i = n - 2; i >= 0; i--) nodes[i] = merge(nodes[2 * i + 1], nodes[2 * i + 2]);
  return nodes;
}

export const merkleRoot = (leaves) =>
  leaves.length === 0 ? Buffer.alloc(32) : buildTree(leaves)[0];

/**
 * The sibling chain proving `leaves[index]` is in the tree.
 * Returned bottom-up, which is the order a verifier consumes it.
 */
export function merkleProof(leaves, index) {
  const n = leaves.length;
  const nodes = buildTree(leaves);
  const siblings = [];
  let i = index + n - 1;
  while (i > 0) {
    const sibling = i % 2 === 1 ? i + 1 : i - 1;
    siblings.push({ hash: nodes[sibling], isLeft: sibling < i });
    i = (i - 1) >> 1;
  }
  return siblings;
}

/** Replay a proof: fold the leaf up through its siblings and return the root. */
export function rootFromProof(leaf, siblings) {
  let acc = leaf;
  for (const { hash, isLeft } of siblings) acc = isLeft ? merge(hash, acc) : merge(acc, hash);
  return acc;
}
