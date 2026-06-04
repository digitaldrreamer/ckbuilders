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

Several places used bare `+` on `usize` values derived from on-chain bytes. On 32-bit targets, a `u32` cast to `usize` can equal `usize::MAX`, making the addition wrap. All replaced with `checked_add`. `treasury-lock`'s `is_anchor_type_for_treasury` was reading type script args without first validating the molecule `Script` table's field offsets — bounds checks added, matching the approach already in `proposal-anchor`. The execute command was trying to fund registry capacity growth from the proposal cell before falling back to the treasury, which is wrong; registry growth always comes from the treasury. The anchor cell was being locked to governance-lock; the contract requires treasury-lock so the treasury can reclaim it after the review window. The `since` validation had two checks: the relative flag `(since & 0x8000_0000_0000_0000) != 0` and the metric bits. The metric check was checking only bit 62, which also accepts the reserved `0b11` metric; corrected to `(since & 0x6000_0000_0000_0000) == 0x4000_0000_0000_0000` so bits 62:61 must be exactly `0b10` (MTP). Both checks are required — the relative flag rejects absolute timestamps and the metric check rejects block-number and epoch metrics. When the treasury change output fell below the 61 CKB minimum cell capacity, the CLI was creating a sub-threshold output the node would reject; dust is now absorbed into the fee. A CLI fallback was constructing the treasury-lock script from hardcoded testnet constants; replaced with the script discovered from live cell deps.

After the PR merged, a review comment on `contracts/proposal-anchor/src/main.rs` line 164 flagged one more overflow: `args_off + 4` was still bare addition. Fixed in commit `7db5cf0` using `checked_add`, storing the result as `args_data_start` and reusing it in both the bounds check and the final slice. Reply posted on the thread, thread resolved.

## 75-page docs overhaul (June 4)

The Diátaxis skeleton from week 12 was filled in across nine commits.

**Tutorials** (17 pages): three persona tracks — developer integrating the SDK, validator running governance, operator deploying a registry. Each track is self-contained.

**How-to guides** (27 pages): one page per named task — anchor a proposal, cast a vote, execute a proposal, check proposal status, reclaim an expired anchor, prune expired registry entries, donate to the treasury, run preflight checks in TypeScript and Rust, deploy a private registry, use the GUI.

**Reference**: BLKL format spec, testnet deployment constants, glossary expansion with 8 new terms (PBLK, treasury-lock, proposal-anchor, Type ID, blake160, since, median block time, GovernanceHeader).

**Concepts** (11 pages): registry cell, governance model, treasury architecture, Type ID mechanics, BLKL encoding, since semantics, and others.

**Examples** (5 pages): TypeScript SDK, Rust SDK, preflight patterns, multi-registry, and a full governance round-trip.

`public/preview.js` got 8 new TERMS entries, 3 new CODE_INDEX entries, and the GovernanceWitness snippet corrected from v3 (141 bytes, `0x03`) to v4 (173 bytes, `0x04`). CI had been failing since week 12's restructure because five reference page links still pointed to deleted `/guides/` and `/operations/` routes — fixed and pushed.

## `ckb-firewall config` and docs polish — [PR #32](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/32)

A second branch of June 4 work addressed docs coverage, CLI ergonomics, and version housekeeping.

**`ckb-firewall config`** is a new command reading and writing `~/.ckb-firewall/config.json`. Running it with no flags shows the current config and offers an interactive menu to set or clear the default proposer name. `--proposer <name>` sets it non-interactively. The `propose` command uses the saved name as the prompt default and offers to save the entered name on first use. If saving fails (e.g. permissions), it prints a warning and proposal creation continues. The GUI's New Proposal form prefills the Proposer field from the same config value via `TFW_META`.

**preview.js** gained 20 new CODE_INDEX entries covering the full public SDK surface: `TransactionFirewall`, `HashType`, `ScriptLike`, `OutPointLike`, `RegistryEntry`, `TransactionCellDep`, `FIREWALL_ERROR_CODES`, all four `FirewallSdkError` subclasses, `isFirewallSdkError`, `resolveRegistryDeps`, `firstActiveEntry`, and the Rust SDK builders and helpers. Four new TERMS entries: `treasury`, `live cell`, `Merkle proof`, `RegistryEntry`. FILE_PATH_RE extended to include `examples/*` so Location lines in example docs get GitHub link panels on hover.

**Versions**: CLI bumped to 0.5.0, Rust SDK to 0.3.1. Hardcoded version literals in `index.ts` and `app.jsx` replaced with `createRequire` reads from `package.json`.

**Gemini review fixes**: `saveConfig` try-catch with descriptive error, non-fatal warning in `propose`, top-level try-catch in `configCommand`, `Array.isArray` guard in `loadConfig`, indentation fix in `configCommand` try block.

## Governance GUI improvements (June 4 follow-up)

After the docs and tooling work landed, a round of GUI bug-fixes and polish was done on the governance console.

**Execute flow fix.** The execute form was dispatching `UPDATE_PROPOSAL` instead of `EXECUTE` to the React reducer. The `EXECUTE` case is the one that also updates `state.registry` optimistically — so the registry tab stayed empty even after a proposal was successfully executed. The server-side handler also had a matching bug: it was saving the proposal to disk before setting `status = "executed"`, so the next 15-second `/api/data` poll overwrote the optimistic update and the proposal reverted to "approved". Both halves fixed.

**Registry display.** The registry table rows are `<button>` elements without `width: 100%`, so their grid columns weren't aligning with the header. Fixed in CSS. The connection dot now shows an amber "Registry error" state when the local GUI server is reachable (HTTP 200) but the RPC fetch to the testnet node fails — previously it showed green "Connected" in both cases, making it impossible to distinguish a testnet connectivity problem from normal operation.

**Proposal cards and pages.** The vote dot count was hardcoded to 3; it now reads the threshold from `meta`. Compact cards show a review countdown for active proposals. The Proposals tab was missing "Approved" and "Ready to execute" filter tabs, making proposals in those states unreachable through the UI. Added. The registry page now shows an error banner when `meta.registryError` is set, and the empty-state copy hints at hidden expired entries when the "Show expired" checkbox is off. Several null-pubkey guards were added so anonymous sessions (no `yourPubkey` in meta) degrade gracefully instead of showing incorrect counts.

**Operator docs.** The treasury deployment and private registry guides were rewritten. The old `deploy-treasury.mdx` described deploying the treasury-lock binary as a manual standalone step, which contradicted the bootstrap tutorial and left the critical connection unexplained. The new version leads with the connection mechanism — treasury-lock args encode `governance_lock_type_id | proposal_anchor_type_id`, matching the contracts in the registry's v3 governance header, which is how the CLI and GUI auto-discover the treasury without out-of-band config. The private registry guide got dedicated "Connect the CLI", "Connect the GUI", and "Connect the TypeScript SDK" sections and documents the current limitation: no persistent registry config in the config file, so `--registry-tx` must be passed to every command. The operator tutorial index relabelled step 3 ("Deploy and seed the treasury" → "Verify the deployment") to match what the page actually does.

## PR #34 review rounds (June 4, continued)

After the GUI and docs work pushed to the branch, automated reviews from Gemini and CodeRabbit on [PR #34](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/34) caught several real issues, all addressed in the same session.

**Execute re-download bug.** `handleExecute` in `gui-server.ts` was setting `proposal.status = "executed"` immediately after building the TX JSON, before returning it to the browser. A guard at the top of the handler blocked any future call with "Proposal already executed." If the file was lost or the broadcast failed, there was no path to re-download. Fixed by removing the guard — the TX is deterministic so re-running is always safe, and if the TX was already confirmed on-chain `getLiveCell` rejects on the spent anchor cell anyway.

**Meta keys lost on poll.** The `SET_DATA` reducer was replacing `state.meta` entirely with the poll response payload, preserving only `yourPubkey`. Keys like `reviewWindowHours` that are only present at initial page load were silently cleared on the first 15-second poll. Fixed to spread `state.meta` first so poll data overlays rather than replaces.

**Registry null crashes.** `RegistryPage` had multiple bare `registry.filter` and `registry.length` calls that would throw if registry arrived as null before the first successful poll. Consolidated to `const reg = registry || []` at the top of the component, used throughout. `meta.yourPubkey` access across `OverviewPage` and `ProposalsPage` was not using optional chaining — changed to `meta?.yourPubkey` everywhere. All pubkey equality checks were case-sensitive; normalised both sides to lowercase once per component.

**Nested button HTML violation.** Registry table rows were `<button>` elements containing proposal link `<button>` elements inside cells — nested interactive content is invalid per the HTML5 spec and causes broken event propagation and accessibility issues. Changed the outer row to `<div role="button" tabIndex={0}>` with an `onKeyDown` handler for Enter/Space. Removed the button-reset CSS (`appearance`, `border`, `text-align`) that was only there to undo browser button styling on the now-removed `<button>` element.

**CHANGELOG terminology.** A v0.1.0 entry said "no separate multisig signing step" but the same section documented a `sign` command. v0.1.0 did have an explicit sign step. Corrected to restore the step and clarify that the command produces 65-byte recovered secp256k1 signatures that go directly into the execute TX witness — no aggregation step beyond that.

**Error codes audit.** All codes verified against contract source: firewall-lock (5–17), governance-lock (1–6), blacklist-registry (20–28), proposal-anchor (31–36), spawn-aware-secp256k1 (1–7) — complete and correct. Code 26 in blacklist-registry is a gap: when `INVALID_TYPE_ID` was assigned code 27 in May, 26 was skipped. A CHANGELOG entry was added for 2026-05-20 to record when code 27 was introduced and that it replaced a misuse of code 20 for type ID mismatches.

**Version audit.** `@ckb-firewall/sdk` (0.3.4) and the Rust crate (0.3.1) have no source changes since their last publish — no bump needed. `@ckb-firewall/cli` is at 0.5.2 locally vs 0.5.1 on npm and needs publishing after the branch merges.

## What's next

- Merge PR #34 and publish `@ckb-firewall/cli` 0.5.2
- Testnet deployment of `treasury-lock` and `proposal-anchor` with new Type IDs
- Governance drill using the v4 witness to confirm the full flow on testnet
- Rust SDK publish to crates.io
- Formal security review issue

## Refs / Sources

- [CKB Transaction Firewall](https://github.com/digitaldrreamer/ckb-transaction-firewall)
- [PR #31 — keyless governance lifecycle](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/31)
- [PR #32 — preview.js polish, config command, version bumps](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/32)
- [PR #34 — GUI fixes, operator docs, review responses](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/34)
- [CKB since field RFC](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0017-tx-valid-since/0017-tx-valid-since.md)
