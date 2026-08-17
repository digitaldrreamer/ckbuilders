# Slash-proof spike

Can a CKB script verify that a Fiber channel was penalised?

Faultline classifies a penalty on `unlock_count == 0x00` in the commitment-lock
unlock witness. Witness data is the hardest thing on chain for a script to
reach: it belongs to a spent cell, so it cannot arrive as a `cell_dep`. The only
route is a Merkle inclusion proof against a block header supplied via
`header_deps`.

This builds that proof against real testnet penalties and measures it. Written
with no dependencies, because a spike answering "can a script do this" should not
answer it with a package the script could not use.

## Files

| | |
|---|---|
| `blake2b.js` | BLAKE2b-256 with CKB's `ckb-default-hash` personalisation. Pinned to the RFC 7693 `abc` vector. |
| `molecule.js` | Molecule serialisation of `RawTransaction` and `Transaction`, enough to derive `tx_hash` and `witness_hash`. |
| `cbmt.js` | CKB's complete binary Merkle tree: root, proof, and proof replay. |
| `rpc.js` | Minimal CKB JSON-RPC client. |
| `slash-proof.js` | Builds and verifies the two-level proof for recent penalties, with a size breakdown. |
| `batch.js` | The same over a sample spread across the whole penalty history. |
| `chain-walk.js` | Walks commitment→commitment chains back to the funding cell. |

## Running

Needs Node 24+ (for `node:sqlite`) and a Fiber Atlas testnet archive.

```bash
FIBER_ATLAS_DB=/path/to/fiber-atlas.testnet.db N=5 node slash-proof.js
```

```bash
FIBER_ATLAS_DB=/path/to/fiber-atlas.testnet.db N=60 C=6 node batch.js
```

```bash
FIBER_ATLAS_DB=/path/to/fiber-atlas.testnet.db N=25 node chain-walk.js
```

`CKB_RPC_URL` defaults to `https://testnet.ckbapp.dev/`.

## Results, 2026-08-17

Correctness is pinned at three levels, each checking the one below:

- BLAKE2b-512 of `abc` matches RFC 7693.
- All 411 `tx_hash` values in testnet block 19,209,683 are reproduced from the
  molecule serialisation.
- `merge(raw_transactions_root, witnesses_root)` equals that block's
  `transactions_root`, `0xc39d747c…3370`, confirming the CBMT layout empirically
  rather than from the Rust source.

Over 59 penalties sampled across blocks 17,958,375–19,160,358 (every 59th of
3,595; one further sample lost to a transient RPC failure):

- Both proof levels verified for 59/59.
- `unlock_count == 0` recovered from the proven bytes for 59/59.
- Proof size min 1,309 B, p50 2,319 B, p90 2,949 B, max 3,536 B — 0.67% of CKB's
  512 KB maximum transaction size. Proof bytes live in the witness, so they cost
  fee and not capacity: about 0.00002 CKB at the default 1,000 shannons/KB.

The funding outpoint recovered by the L2 proof matched Faultline's indexed
`channel_outpoint` for all 30 of the 30 sampled penalties that had one. The other
30 had none — see `chain-walk.js`, which recovers the funding cell for 25 of 25
by walking commitment→commitment hops (median 2, max 7).

## Not proven here

- **Cycle cost.** This verifies in JavaScript. Nothing has been compiled to
  RISC-V or run in CKB-VM, so the cycle budget for BLAKE2b over a ~1 KB
  transaction plus a ten-deep Merkle path is still unmeasured. That, not proof
  size, is the likely binding constraint.
- **`load_header` in a real script.** Header availability via `header_deps` is
  assumed, not exercised.
- **The binding from a funding outpoint to a node.** It does not exist. That is
  the part the bond design has to add.
