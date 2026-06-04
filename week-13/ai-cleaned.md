# Week 13

The carry-over problem from week 12 was the proposal anchor funding path. The treasury held capacity but wasn't wired to disburse it — creating an anchor cell still required a signer to supply the CKB. This week closed that.

## Keyless execute groundwork (June 2)

Before the main PR, a few things got fixed. Proposal cells had been locked in a way that still required the treasury private key at execution time. The governance-lock handles authorization through committee threshold signatures; the treasury shouldn't be involved in signing. Moved proposal cells to governance-lock as their lock script.

While doing that I found a signing bug. The CLI was wrapping the governance payload in SHA-256 before calling the secp256k1 signer. CKB's governance-lock signs the raw blake2b digest directly, so `prehash: false` is the correct setting. This was also the reason Phase 4 drill transactions had been failing to confirm on testnet — the votes were being signed against the wrong preimage, so execute transactions were rejected on-chain. Fixed that, and also fixed a `since` field encoding error in the `proposal-anchor` unit tests where block-number metric was being used instead of MTP.

## `treasury-lock` and `proposal-anchor` — [PR #31](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/31)

PR #31 ships two new contracts and bumps the protocol to GOV1 v4.

**treasury-lock** is a CKB type script with no private key. Its args encode `governance_lock_type_id(32) | proposal_anchor_type_id(32)`. When a transaction tries to spend a treasury cell, the contract checks whether a valid `proposal-anchor` input is present in the same transaction. If one is, the spend is permitted for the anchor fee and any registry capacity growth. If not, the transaction is rejected.

**proposal-anchor** is a type script protecting PBLK anchor cells. On creation, it validates the cell data is a well-formed PBLK payload (v0x01 add/remove or v0x02 set-treasury) for the configured registry Type ID, and that the cell is locked to the configured treasury address. On consumption, it enforces a minimum relative `since` timestamp using the MTP metric — the review delay is enforced at consensus, not in the CLI. It also checks that capacity returned to treasury is at least the input capacity minus 1 CKB. Type script args: `version(0x01) | registry_type_id_value(32) | treasury_lock_hash(32) | reclaim_delay_ms(8 LE)`.

**GOV1 v4** is 173 bytes, up from 141 in v3. The extra 32 bytes carry the proposal anchor type hash, which governance-lock uses to verify a valid anchor input exists in the execute transaction. The `sign` step is removed from the workflow: propose → anchor → export/import → vote → execute.

New CLI commands: `ckb-firewall anchor`, `ckb-firewall reclaim`, `ckb-firewall treasury-status`. `ckb-firewall inspect` gained treasury pool info. The `sign` command was removed. The GUI was updated to remove the sign step and add a treasury banner. TypeScript and Rust SDK examples were scaffolded under `examples/` with a root README, lockfile, and helper scripts.

## Security review rounds (June 3–4)

PR #31 went through five Gemini review rounds the same day it was open.

Several places used bare `+` on `usize` values derived from on-chain bytes. On 32-bit targets, a `u32` cast to `usize` can equal `usize::MAX`, making the addition wrap. All replaced with `checked_add`. `treasury-lock`'s `is_anchor_type_for_treasury` was reading type script args without first validating the molecule `Script` table's field offsets — bounds checks added, matching the approach already in `proposal-anchor`. The execute command was trying to fund registry capacity growth from the proposal cell before falling back to the treasury, which is wrong; registry growth always comes from the treasury. The anchor cell was being locked to governance-lock; the contract requires treasury-lock so the treasury can reclaim it after the review window. The `since` MTP validation was checking only bit 62, which also accepts the reserved `0b11` metric; correct check is `(since & 0x6000_0000_0000_0000) == 0x4000_0000_0000_0000`. When the treasury change output fell below the 61 CKB minimum cell capacity, the CLI was creating a sub-threshold output the node would reject; dust is now absorbed into the fee. A CLI fallback was constructing the treasury-lock script from hardcoded testnet constants; replaced with the script discovered from live cell deps.

After the PR merged, a review comment on `contracts/proposal-anchor/src/main.rs` line 164 flagged one more overflow: `args_off + 4` was still bare addition. Fixed in commit `7db5cf0` using `checked_add`, storing the result as `args_data_start` and reusing it in both the bounds check and the final slice. Reply posted on the thread, thread resolved.

## 75-page docs overhaul (June 4)

The Diátaxis skeleton from week 12 was filled in across nine commits.

**Tutorials** (17 pages): three persona tracks — developer integrating the SDK, validator running governance, operator deploying a registry. Each track is self-contained.

**How-to guides** (27 pages): one page per named task — anchor a proposal, cast a vote, execute a proposal, check proposal status, reclaim an expired anchor, prune expired registry entries, donate to the treasury, run preflight checks in TypeScript and Rust, deploy a private registry, use the GUI.

**Reference**: BLKL format spec, testnet deployment constants, glossary expansion with 8 new terms (PBLK, treasury-lock, proposal-anchor, Type ID, blake160, since, median block time, GovernanceHeader).

**Concepts** (11 pages): registry cell, governance model, treasury architecture, Type ID mechanics, BLKL encoding, since semantics, and others.

**Examples** (5 pages): TypeScript SDK, Rust SDK, preflight patterns, multi-registry, and a full governance round-trip.

`public/preview.js` got 8 new TERMS entries, 3 new CODE_INDEX entries, and the GovernanceWitness snippet corrected from v3 (141 bytes, `0x03`) to v4 (173 bytes, `0x04`). CI had been failing since week 12's restructure because five reference page links still pointed to deleted `/guides/` and `/operations/` routes — fixed and pushed.

## What's next

- Testnet deployment of `treasury-lock` and `proposal-anchor` with new Type IDs
- Governance drill using the v4 witness to confirm the full flow on testnet
- Rust SDK publish to crates.io
- Formal security review issue

## Refs / Sources

- [CKB Transaction Firewall](https://github.com/digitaldrreamer/ckb-transaction-firewall)
- [PR #31 — keyless governance lifecycle](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/31)
- [CKB since field RFC](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0017-tx-valid-since/0017-tx-valid-since.md)
