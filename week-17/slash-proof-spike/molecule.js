/**
 * Molecule serialisation of CKB's `RawTransaction` and `Transaction`, per
 * blockchain.mol.
 *
 * Only what the spike needs: enough to derive `tx_hash` and `witness_hash` from
 * an RPC transaction. `tx_hash` is checked against the value the RPC already
 * returned, so a serialisation bug fails loudly instead of producing a plausible
 * wrong root later.
 *
 * Encoding rules used here:
 *   struct / array  fixed size, fields concatenated, no header
 *   fixvec          u32 item count, then items
 *   dynvec          u32 total size, u32 offset per item, then items
 *   table           u32 total size, u32 offset per field, then fields
 *   option          empty when None, otherwise the item's own bytes
 */

const u32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};

const u64 = (v) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(v));
  return b;
};

const hex = (s) => Buffer.from(s.slice(2), 'hex');

/** fixvec: count-prefixed, items are fixed width. */
const fixvec = (items) => Buffer.concat([u32(items.length), ...items]);

/** `vector Bytes <byte>` — a fixvec of bytes. */
const bytes = (buf) => Buffer.concat([u32(buf.length), buf]);

/** dynvec: total size, then one offset per item, then the items. */
function dynvec(items) {
  const headerLen = 4 + 4 * items.length;
  const offsets = [];
  let cursor = headerLen;
  for (const item of items) {
    offsets.push(cursor);
    cursor += item.length;
  }
  return Buffer.concat([u32(cursor), ...offsets.map(u32), ...items]);
}

/** table: same layout as dynvec, but the field count is fixed by the schema. */
const table = (fields) => dynvec(fields);

const HASH_TYPE = { data: 0, type: 1, data1: 2, data2: 4 };
const DEP_TYPE = { code: 0, dep_group: 1 };

function script(s) {
  const ht = HASH_TYPE[s.hash_type];
  if (ht === undefined) throw new Error(`unknown hash_type ${s.hash_type}`);
  return table([hex(s.code_hash), Buffer.from([ht]), bytes(hex(s.args))]);
}

/** ScriptOpt — None is zero bytes, which is what makes the table offsets differ. */
const scriptOpt = (s) => (s ? script(s) : Buffer.alloc(0));

/** struct OutPoint { tx_hash: Byte32, index: Uint32 } */
const outPoint = (o) => Buffer.concat([hex(o.tx_hash), u32(Number(BigInt(o.index)))]);

/** struct CellInput { since: Uint64, previous_output: OutPoint } */
const cellInput = (i) => Buffer.concat([u64(i.since), outPoint(i.previous_output)]);

/** struct CellDep { out_point: OutPoint, dep_type: byte } */
function cellDep(d) {
  const dt = DEP_TYPE[d.dep_type];
  if (dt === undefined) throw new Error(`unknown dep_type ${d.dep_type}`);
  return Buffer.concat([outPoint(d.out_point), Buffer.from([dt])]);
}

const cellOutput = (o) => table([u64(o.capacity), script(o.lock), scriptOpt(o.type)]);

/** The pre-image of `tx_hash`: everything except the witnesses. */
export function rawTransaction(tx) {
  return table([
    u32(Number(BigInt(tx.version))),
    fixvec(tx.cell_deps.map(cellDep)),
    fixvec(tx.header_deps.map(hex)),
    fixvec(tx.inputs.map(cellInput)),
    dynvec(tx.outputs.map(cellOutput)),
    dynvec(tx.outputs_data.map((d) => bytes(hex(d)))),
  ]);
}

/** The pre-image of `witness_hash`: the raw transaction plus its witnesses. */
export function transaction(tx) {
  return table([rawTransaction(tx), dynvec(tx.witnesses.map((w) => bytes(hex(w))))]);
}
