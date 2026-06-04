The carry-over problem from week 12 was the proposal anchor funding path. The treasury held capacity but wasn't wired to disburse it. Creating an anchor cell still required a signer to supply the CKB. That's the gap this week closed.


Keyless execute groundwork (June 2)

Started the week with a few things that had been nagging. Proposal cells were locked in a way that still required a private key at execution time. The governance-lock handles authorization -- the treasury shouldn't be involved in signing. Moved proposal cells to governance-lock as their lock script.

While doing that I found a signing bug. The CLI was wrapping the governance payload in SHA-256 before calling the secp256k1 signer. CKB's governance-lock signs the raw blake2b digest directly. The fix is `prehash: false` in the signer call. This was also why Phase 4 drill transactions had been failing to confirm on testnet -- the votes were signed against the wrong preimage so execute transactions were rejected on-chain. Fixed that too, along with a `since` field encoding error in the proposal-anchor unit tests where block-number metric was being used instead of MTP.


treasury-lock and proposal-anchor (PR #31)

The keyless anchor problem needed two new contracts. PR #31 ships both, along with a protocol version bump to GOV1 v4.

`treasury-lock` is a CKB type script with no private key. Its args encode `governance_lock_type_id(32) | proposal_anchor_type_id(32)`. When a transaction tries to spend a cell locked by treasury-lock, the contract checks whether a valid `proposal-anchor` input is present in the same transaction. If one is, the spend is permitted for the anchor fee and any registry capacity growth. If not, the transaction is rejected. That's the full model: capacity leaves the treasury only through governance-validated transactions.

`proposal-anchor` is a type script protecting PBLK anchor cells. On creation, it validates the cell data is a well-formed PBLK payload (v0x01 add/remove or v0x02 set-treasury) for the configured registry Type ID, and that the cell is locked to the configured treasury address. On consumption, it enforces a relative `since` timestamp using the MTP (median time past) metric — the review delay is enforced at consensus, not in the CLI. It also checks that capacity returns to treasury minus at most 1 CKB. Type script args: `version(0x01) | registry_type_id_value(32) | treasury_lock_hash(32) | reclaim_delay_ms(8 LE)`.

GOV1 v4 is 173 bytes, up from 141 in v3. The extra 32 bytes carry the proposal anchor type hash, which governance-lock uses to verify a valid anchor input exists in the execute transaction. The `sign` step is removed from the workflow. The updated sequence is: propose → anchor → export/import → vote → execute.

New CLI commands: `ckb-firewall anchor` builds and submits the treasury-funded anchor transaction. `ckb-firewall reclaim` reclaims the anchor cell after the review delay. `ckb-firewall treasury-status` reports pool usage and the donation address. `ckb-firewall inspect` gained treasury info. The `sign` command was removed. GUI was updated to remove the sign step from the proposal flow and add a treasury banner. TypeScript and Rust SDK examples were scaffolded under `examples/` with a root README, lockfile, and helper scripts.


Gemini security review rounds (June 3)

PR #31 went through five Gemini review rounds the same day it was open. Each round produced a batch of fixes.

Several places used bare `+` on `usize` values derived from on-chain bytes. On 32-bit targets, a `u32` value cast to `usize` can equal `usize::MAX`, making the addition wrap. Replaced all of these with `checked_add`. `treasury-lock`'s `is_anchor_type_for_treasury` was reading type script args without first validating the molecule `Script` table's field offsets -- added bounds checks matching the approach already used in `proposal-anchor`. The execute command was attempting to fund registry capacity growth from the proposal cell surplus before falling back to the treasury, which is wrong -- registry growth is always drawn from the treasury. Fixed. The anchor cell was being locked to governance-lock in the initial implementation; the contract requires treasury-lock so the treasury can reclaim it after the review window. Fixed. The `since` field has two independent checks: `(since & 0x8000_0000_0000_0000) != 0` for the relative flag (bit 63, rejects absolute timestamps) and a metric check for bits 62:61. The metric check was checking only bit 62, which also accepts the reserved `0b11` metric -- corrected to `(since & 0x6000_0000_0000_0000) == 0x4000_0000_0000_0000` so both bits must be exactly `0b10` (MTP only). Both checks must pass; the relative flag was already present and correct. When the treasury change output fell below the 61 CKB minimum cell capacity, the CLI was creating a sub-threshold output the node would reject -- dust is now absorbed into the fee. A fallback in the CLI was constructing the treasury-lock script from hardcoded testnet constants -- replaced with the script discovered from live cell deps.

After PR #31 merged, a review comment (`#discussion_r3354905455`) on `contracts/proposal-anchor/src/main.rs` line 164 flagged one more overflow: `args_off + 4` was still bare addition. The `args_off` value comes from a `u32` cast to `usize`, so on 32-bit targets it can equal `usize::MAX`. Fixed with `checked_add`, the result stored as `args_data_start` and reused in both the bounds check and the final slice. Reply posted on the thread, thread resolved.


75-page docs overhaul (June 4)

The Diátaxis skeleton from week 12 was filled in across nine commits.

Tutorials got 17 pages across three persona tracks: developer integrating the SDK into a transaction builder, validator running governance nodes and voting on proposals, operator deploying a private registry and bootstrapping the treasury. Each track is self-contained and starts from the choose-your-path router.

How-to guides got 27 pages, one per named task: anchor a proposal, cast a vote, execute a proposal, check proposal status, reclaim an expired anchor, prune expired registry entries, donate to the treasury, run a preflight check in TypeScript and Rust, deploy a private registry, use the governance GUI.

Reference gained a BLKL format spec page, the testnet deployment constants page, and a glossary expansion adding 8 new terms: PBLK, treasury-lock, proposal-anchor, Type ID, blake160, since, median block time, and GovernanceHeader.

Concepts got 11 pages covering the registry cell, governance model, treasury architecture, Type ID mechanics, BLKL encoding, since semantics, and others.

Examples got 5 pages: TypeScript SDK, Rust SDK, preflight patterns, multi-registry configuration, and a full governance round-trip.

`public/preview.js` was updated alongside: 8 new TERMS entries for the glossary additions, 3 new CODE_INDEX entries for `findRegistryCell`, `isBlacklisted`, and `isTypeArgsBlacklisted`, and the stale GovernanceWitness code snippet corrected from v3 (141 bytes, version byte `0x03`) to v4 (173 bytes, version byte `0x04`).

CI had been failing since week 12's restructure. Five links in reference pages were still pointing to `/guides/` and `/operations/` routes that had been deleted. Fixed and pushed.


PR #32 work (also June 4)

After the keyless governance and docs work landed, a second branch of work on June 4 addressed docs coverage, version housekeeping, and CLI ergonomics.

`preview.js` gained 20 new CODE_INDEX entries covering the full public SDK surface: `TransactionFirewall`, `HashType`, `ScriptLike`, `OutPointLike`, `RegistryEntry`, `TransactionCellDep`, `FIREWALL_ERROR_CODES`, all four `FirewallSdkError` subclasses, `isFirewallSdkError`, `resolveRegistryDeps`, `firstActiveEntry`, and the Rust SDK builders and helpers (`is_blacklisted`, `preflight_check`, `build_firewall_lock_args/script/spend_cell_deps`, `encode_governance_header`). Four new TERMS entries added: `treasury`, `live cell`, `Merkle proof`, `RegistryEntry`. FILE_PATH_RE extended to include `examples/*` so the Location lines in example docs get GitHub link panels.

`ckb-firewall config` is a new command that reads and writes `~/.ckb-firewall/config.json`. Running it with no flags shows the current config and offers an interactive menu. `--proposer <name>` sets a default proposer name non-interactively. The `propose` command was updated to use the saved name as the prompt default and offers to save the entered name on first use. The GUI's New Proposal form now prefills the Proposer field from the same config value via `TFW_META`. `saveConfig` wraps FS operations in try-catch with a descriptive error; the `propose` command treats a save failure as a non-fatal warning so a permissions issue on the config file cannot block proposal creation.

CLI bumped to 0.5.0. Rust SDK bumped to 0.3.1 (minor registry.rs fix). Hardcoded version literals in `index.ts` and `app.jsx` replaced with runtime reads from `package.json` via `createRequire`, matching the pattern already used in `gui-server.ts`. Rust example `preflight_service` fixed to print "1 entry" vs "entries" correctly.

Gemini review rounds on PR #32 surfaced: non-fatal saveConfig failure in propose (fixed), try-catch in saveConfig (fixed), top-level try-catch in configCommand (fixed), Array.isArray guard in loadConfig (fixed), indentation inside the try block (fixed). All addressed and resolved.


Status and what's next

The governance workflow is fully keyless end to end. Proposals anchor through the treasury, the review delay is enforced on chain, and execution doesn't touch a treasury key. The docs are the most complete they've been, covering all four Diátaxis modes.

What's still open: live testnet deployment of `treasury-lock` and `proposal-anchor` (new contracts, new Type IDs needed), a governance drill using the v4 witness to confirm the end-to-end flow produces confirmed transactions, Rust SDK publish to crates.io, and the formal security review issue.


Refs / Sources

- CKB Transaction Firewall repo - https://github.com/digitaldrreamer/ckb-transaction-firewall
- PR #31 (keyless governance lifecycle) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/31
- CKB since field RFC - https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0017-tx-valid-since/0017-tx-valid-since.md
