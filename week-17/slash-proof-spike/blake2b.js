/**
 * BLAKE2b (RFC 7693) with personalisation, enough for CKB's `ckbhash`.
 *
 * Written out rather than installed: fiber-atlas has zero runtime dependencies,
 * and a spike that answers "can a CKB script do this" should not answer it with
 * a package the script could not use.
 *
 * Correctness is pinned two ways: the RFC 7693 "abc" vector for the core
 * compression, and — the one that actually matters — reproducing a real CKB
 * tx_hash from the RPC, which exercises hash and serialisation together.
 */

const MASK = (1n << 64n) - 1n;

const IV = [
  0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
  0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n,
];

const SIGMA = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
  [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
  [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
];

const rotr = (x, n) => ((x >> n) | (x << (64n - n))) & MASK;

function mix(v, a, b, c, d, x, y) {
  v[a] = (v[a] + v[b] + x) & MASK;
  v[d] = rotr(v[d] ^ v[a], 32n);
  v[c] = (v[c] + v[d]) & MASK;
  v[b] = rotr(v[b] ^ v[c], 24n);
  v[a] = (v[a] + v[b] + y) & MASK;
  v[d] = rotr(v[d] ^ v[a], 16n);
  v[c] = (v[c] + v[d]) & MASK;
  v[b] = rotr(v[b] ^ v[c], 63n);
}

function readLE64(buf, off) {
  let x = 0n;
  for (let i = 7; i >= 0; i--) x = (x << 8n) | BigInt(buf[off + i]);
  return x;
}

function compress(h, block, counter, last) {
  const v = [...h, ...IV];
  v[12] ^= counter & MASK;
  v[13] ^= (counter >> 64n) & MASK;
  if (last) v[14] ^= MASK;

  const m = [];
  for (let i = 0; i < 16; i++) m.push(readLE64(block, i * 8));

  for (let r = 0; r < 12; r++) {
    const s = SIGMA[r];
    mix(v, 0, 4, 8, 12, m[s[0]], m[s[1]]);
    mix(v, 1, 5, 9, 13, m[s[2]], m[s[3]]);
    mix(v, 2, 6, 10, 14, m[s[4]], m[s[5]]);
    mix(v, 3, 7, 11, 15, m[s[6]], m[s[7]]);
    mix(v, 0, 5, 10, 15, m[s[8]], m[s[9]]);
    mix(v, 1, 6, 11, 12, m[s[10]], m[s[11]]);
    mix(v, 2, 7, 8, 13, m[s[12]], m[s[13]]);
    mix(v, 3, 4, 9, 14, m[s[14]], m[s[15]]);
  }

  for (let i = 0; i < 8; i++) h[i] ^= v[i] ^ v[i + 8];
}

/**
 * @param {Buffer} input
 * @param {{ outlen?: number, personal?: Buffer|null }} opts
 * @returns {Buffer}
 */
export function blake2b(input, { outlen = 32, personal = null } = {}) {
  const h = [...IV];
  h[0] ^= 0x01010000n | BigInt(outlen); // fanout=1, depth=1, keylen=0

  if (personal) {
    if (personal.length !== 16) throw new Error('personal must be 16 bytes');
    h[6] ^= readLE64(personal, 0);
    h[7] ^= readLE64(personal, 8);
  }

  // Non-streaming: CKB payloads here are kilobytes, and buffering keeps the
  // final-block/counter handling in one place where it can be read.
  let off = 0;
  while (input.length - off > 128) {
    compress(h, input.subarray(off, off + 128), BigInt(off + 128), false);
    off += 128;
  }
  const tail = Buffer.alloc(128);
  input.copy(tail, 0, off);
  compress(h, tail, BigInt(input.length), true);

  const out = Buffer.alloc(64);
  for (let i = 0; i < 8; i++) out.writeBigUInt64LE(h[i], i * 8);
  return out.subarray(0, outlen);
}

const CKB_PERSONAL = Buffer.from('ckb-default-hash', 'utf8');

/** CKB's `ckbhash`: BLAKE2b-256 personalised with "ckb-default-hash". */
export const ckbhash = (input) => blake2b(input, { outlen: 32, personal: CKB_PERSONAL });
