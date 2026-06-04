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

The docs preview system (`public/preview.js`) gained 20 new code-hover entries covering the full public SDK surface — every major TypeScript class, interface, error type, and Rust function now shows a source snippet when hovered in the docs. Four new glossary definitions added: treasury, live cell, Merkle proof, RegistryEntry. The file-path hover pattern was extended to also recognise paths under `examples/`, so the location lines on example doc pages link through to GitHub.

`ckb-firewall config` is a new command. It stores a default proposer name in `~/.ckb-firewall/config.json` — the same directory proposals are saved to. `ckb-firewall config --proposer alice` sets it in one command. Without the flag, the command shows the current value and offers an interactive menu to set or clear it. Once a name is saved, `ckb-firewall propose` uses it as the default and only asks to confirm; the GUI's New Proposal form prefills from it as well. If writing the config file fails (e.g. a permissions issue), the `propose` command prints a warning and continues — the config is a convenience, not a gate.

CLI bumped to 0.5.0. Rust SDK bumped to 0.3.1. The CLI's `--version` output and the version label in the GUI header both now read from `package.json` at runtime instead of hardcoded strings, so they stay in sync automatically. The Rust `preflight_service` example was fixed to print "1 entry" correctly instead of "1 entries".

Gemini review on PR #32 caught: the config write in `propose` should be non-fatal (fixed — it's a warning now), the config write function should throw a readable error not a raw Node error (fixed), the config command should catch unexpected errors and exit cleanly instead of printing a stack trace (fixed), the parsed config JSON should validate field types rather than blind-casting (fixed — `proposerName` is only accepted if it's a string), and a missing indentation level inside the try block (fixed). All five addressed and resolved same day.


GUI polish and PR #34 review rounds (June 4, continued)

After the GUI and docs work landed on the branch, a round of automated reviews (Gemini + CodeRabbit) on PR #34 caught several real issues that were fixed in the same session.

The execute handler in gui-server.ts was setting proposal.status = "executed" and saving before returning the TX JSON. A guard at the top of the handler threw "Proposal already executed" if status was already executed, so if the file was lost or the broadcast failed there was no way to re-download. Fixed by removing that guard -- the TX is deterministic so re-running is safe, and if the TX is already confirmed on chain getLiveCell will reject on the spent anchor cell anyway.

SET_DATA in the React reducer was replacing state.meta entirely with the poll payload, only preserving yourPubkey. Keys like reviewWindowHours that are only present at initial page load were wiped on the first 15-second poll. Fixed to spread state.meta first so poll data overlays rather than replaces.

RegistryPage had multiple bare registry.filter and registry.length calls that would crash if registry was null. Consolidated to const reg = registry || [] at the top and used it throughout. Same pattern applied in OverviewPage. meta.yourPubkey access in both OverviewPage and ProposalsPage wasn't using optional chaining -- changed to meta?.yourPubkey everywhere. All pubkey comparisons were case-sensitive; normalized both sides to lowercase. Registry table rows were button elements containing proposal link button elements inside -- nested interactive content is invalid HTML per spec. Changed outer rows to div with role=button, tabIndex, and onKeyDown handler for Enter/Space. Removed button-reset CSS (appearance, border, text-align) that was only there to undo browser button styling.

CHANGELOG had a v0.1.0 entry that removed the sign step and said "no separate multisig signing step" -- but the sign command existed in v0.1.0 and the same section documented it. Corrected to restore the sign step and clarify that the command produces 65-byte recovered secp256k1 signatures that go directly into the execute TX witness, no aggregation step beyond that.

Error codes audit: all codes verified against contract source. firewall-lock (5-17), governance-lock (1-6), blacklist-registry (20-28), proposal-anchor (31-36), spawn-aware-secp256k1 (1-7) -- all complete and correct. Code 26 in blacklist-registry is a gap: when INVALID_TYPE_ID was added as code 27 in May, 26 was skipped. Not documented externally, added a CHANGELOG entry for May 20 noting the code 27 addition and the gap.

Version check: @ckb-firewall/sdk (0.3.4) and ckb-transaction-firewall-sdk Rust (0.3.1) have no source changes since their last publish. @ckb-firewall/cli is at 0.5.2 locally vs 0.5.1 on npm -- needs publish.

CLI 0.5.2 bumped to prepare for publish after this branch merges.


Security audit and PR #36 (June 4, continued)

Went through SECURITY.md and verified every item against the current code. Found four status entries that were wrong.

M1 was marked Fixed but wasn't. VOTE_THRESHOLD = 3 is hardcoded in proposals.ts and isVoteApproved uses it directly. The on-chain threshold is read from the governance header for display purposes in the GUI but never used in the actual vote approval check. For the canonical testnet registry (threshold 3) it's invisible, but a private registry operator with a different threshold would see the CLI say "vote passed" when it hasn't. Fixed: isVoteApproved now accepts an optional threshold parameter (defaults to VOTE_THRESHOLD). executeCommand does a fast pre-check with the default, then re-checks with state.governanceHeader.threshold after loading the registry state.

M2 and L3 were both marked Fixed. Both were about sign.ts -- M2 was a misleading comment in placeholderSigners, L3 was missing validation on registryIndex. sign.ts was deleted in v0.4.0. Neither finding is relevant any more. Status corrected to Removed.

L6 was marked Fixed but wasn't. header_deps: [] appears in execute.ts, anchor.ts, and reclaim.ts with no comment explaining why it's always empty. The fix: since the MTP delay is enforced by CKB consensus (the miner checks the since field directly), no scripts call load_header() and header_deps doesn't need any entries. Added a one-line comment to all three files.

Also went through notes/governance.md and notes/architecture.md, which still described the old multisig signer model and GOV1 v2 (133 bytes). Updated both for keyless governance: removed the Multisig Signer role, updated the lifecycle to include the anchor step, replaced the sign command with the current flow, and updated the witness description to GOV1 v4 (173 bytes).

The security-findings-full.md document (internal, gitignored) was a May 19 snapshot with everything marked Open. Updated all statuses to reflect what's been fixed across phases 1-4.

CHANGELOG was missing the v0.5.1 entry entirely -- that version was bumped and published from a feature branch but never logged. Added the entry. CLI bumped to 0.5.2, PR #36 opened and merged.


Status and what's next

The governance workflow is fully keyless end to end. Proposals anchor through the treasury, the review delay is enforced on chain, and execution doesn't touch a treasury key. The docs are the most complete they've been, covering all four Diátaxis modes. SECURITY.md now accurately reflects the current state of all known findings.

What's still open: publish CLI 0.5.2 to npm, live testnet deployment of `treasury-lock` and `proposal-anchor` (new contracts, new Type IDs needed), a governance drill using the v4 witness to confirm the end-to-end flow produces confirmed transactions, Rust SDK publish to crates.io, and the formal security review issue.


Refs / Sources

- CKB Transaction Firewall repo - https://github.com/digitaldrreamer/ckb-transaction-firewall
- PR #31 (keyless governance lifecycle) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/31
- PR #32 (preview.js, config command, version bumps) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/32
- PR #34 (GUI fixes, operator docs, review responses) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/34
- CKB since field RFC - https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0017-tx-valid-since/0017-tx-valid-since.md
