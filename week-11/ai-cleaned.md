# Week 11

Two threads this week. The first was shipping BLKL v2 and the complete governance workflow — a protocol change that had been staged since the CLI launched. The second was working through the security findings from week 10’s review. The second thread didn’t go as planned.

## BLKL v2 and governance tooling

The v1 registry format was single-registry only and the governance CLI workflow was incomplete. PR #19 finished both.

BLKL v2 adds a governance header to the registry payload carrying the committee pubkeys. Signer key rotation no longer requires a contract redeployment — update the registry, not the contract. The firewall-lock was updated to support multi-registry matching. The CLI got the complete governance sequence wired up: `import`, `export`, `check`, `propose`, `vote`, `sign`, `execute`.

Review flagged an issue with the signing preimage. It was binding to the transaction hash, which requires knowing the tx hash before signing and breaks the sign-before-execute workflow. Replaced with `blake2b(proposal_id_hash || vote_digest_hash || old_root || new_root)`. Signers now commit to the exact state transition. That fix landed the same day as PR #21.

## Hotfixing, then stopping

After the v2 work I started going through the remaining open issues from week 10’s security review. The C-4 verification block in execute.ts referenced `oldRoot` and `newRoot` before they were declared — temporal dead zone, runtime throw if the path was hit. Fixed the ordering, opened PR #22.

Then kept reading. The `--cmd` argument in update-blacklist.ts was going verbatim into `execSync`. The `--key` flag on sign and vote was exposing private keys in process listings and shell history. The signer index parser could produce NaN. Identifier length silently truncated above 255 bytes and produced payloads the chain would reject.

Each fix pointed to something else. At the point where two branches had overlapping changes that were starting to conflict, I stopped and closed PR #22. Patching one issue at a time wasn’t working — the problems were structural chains, not isolated bugs.

## Security audit (PR #23)

Wrote up every finding with a severity label, then addressed them in a single pass.

**V1 (critical)** — temporal dead zone: the C-4 signer verification block moved after `oldRoot` and `newRoot` are computed.

**V2 (high)** — command injection: `execSync` → `execFileSync` with an explicit parsed argument array in update-blacklist.ts.

**V3 (medium)** — key exposure: `--key` removed from sign and vote entirely. Interactive prompt only, no flag path.

**V4–V7 (low)** — error isolation in listProposals(); `assertHttps()` now throws instead of warns for non-local HTTP; dynamic signer index bound derived from on-chain committee size; explicit throw on identifier overflow in blkl.ts.

A code quality audit ran alongside the security pass.

The sign and vote commands were missing --rpc-url and --registry-tx in index.ts — opts.rpcUrl was always undefined and both commands were broken at runtime.

Votes needed to freeze once signing started: adding a vote after the first signature changes the vote_digest_hash and invalidates collected signatures. vote.ts wasn’t checking the local pubkeys Merkle root against on-chain before recording a vote.

The Rust SDK had no BLKL v2 parsing — added GovernanceHeader struct and replaced the O(n) scan with an expiry-aware binary search. Several more through Q13: binary search in check.ts, trailing slash normalization, AbortController timeout in SDK fetch, auto-rejection of proposals with expired review windows, and version string corrected.

## GOV1 v3 and on-chain review window enforcement (PR #24)

After PR #23 merged, H3 was still open. It was the structural one.

The 72-hour governance review window before execution was enforced only by the CLI’s `expiresAt` check. Nothing on-chain prevented someone with three governance keys from crafting a raw transaction and bypassing it entirely.

The fix required a new witness format. GOV1 v3 is 141 bytes: the 133-byte v2 layout plus 8 bytes of `review_window_end_ms` encoded as a little-endian u64. The governance-lock contract reads the `since` field on the governance input, verifies it encodes an absolute median-time-past timestamp, and rejects with ERR_REVIEW_WINDOW_NOT_MET (error code 6) if the timestamp is below `review_window_end_ms`. The review window is now enforced at consensus, not in the CLI.

There was also a gap in the version discriminator: a 141-byte payload with version byte `0x02` would pass the length check, be parsed as v2, and skip the `since` enforcement entirely. Fixed by reading the version byte first and deriving the expected length from it via a match expression.

Once v3 was working there was no reason to keep v2. Dropped it — no callers needed backward compat.

Added 10 unit tests for `verify_since_timestamp` covering every rejection branch: relative timestamps, wrong metric encoding (block height, epoch), zero `since` with nonzero minimum, value below minimum, exact boundary, value above minimum, minimum = 0.

## Rust SDK v0.3.0 (PR #25)

The Rust SDK was at v0.2.0 and had drifted significantly from the TypeScript SDK and the current protocol state. Three structural gaps: single-registry only (matching full type-script equality instead of the 32-byte type_id_value), `now_secs` baked into `check_transaction` via `SystemTime::now()`, and `parse_registry_payload` was private.

Updated to v0.3.0. The flat `lib.rs` was split into six focused modules: `errors`, `types`, `registry`, `builder`, `firewall`, `testnet`. The type_id_value matching now correctly reads bytes 34–66 of the registry type-script args, matching the on-chain resolver. `check_transaction` takes `now_secs: u64` as an explicit parameter — callers supply the chain’s median time or system time; nothing is baked in. `parse_registry_payload` is public.

The builder module is new: `build_firewall_lock_args`, `build_firewall_lock_script`, and `build_firewall_spend_cell_deps` mirror the TypeScript SDK’s builder.ts, encoding the v2 FirewallLockArgs byte layout. `preflight_check` and `is_blacklisted` are also now standalone public helpers — useful when you’ve already fetched and parsed registry payloads yourself.

Optional `serde` and `testnet` feature flags. `encode_registry_payload` and `encode_governance_header` are public so callers can produce test payloads or build tooling without reimplementing the wire format. Only BLKL v2 is accepted; v1 is hard-rejected, matching the contract and TypeScript SDK. 20+ tests.

PR review surfaced real issues. The `error_codes` module had entirely wrong constants for codes 5–7 and 13–16 — I’d invented governance codes that don’t exist in the contract. The actual mapping (from the frozen v1 contract): `InvalidArgsLayout=5`, `UnsupportedVersion=6`, `UnsupportedFlags=7`, `MissingInnerLockCellDep=13`, `InvalidInnerLockScript=14`, `InnerLockRejected=15`, `OutputScriptParseFailed=16`. The dep-matching length check was `>= 66` instead of `== 66`; the on-chain resolver requires exact length. The `parse_entries` function was missing the max_possible bounds check before `Vec::with_capacity`, which the contract itself has to prevent OOM on malicious input. The governance header bounds were checked against `data.len()` instead of `offset + gov_len`, allowing a malformed `gov_header_len` to cause reads into the entry section. `encode_registry_payload` was casting identifier length to `u8` without validation, silently truncating anything over 255 bytes. Fixed all of these in a follow-up commit.

## Docs audit and preview system (PR #26)

With the protocol changes stabilised, the docs site had accumulated a lot of stale content. PR #26 was a full sweep.

All “GOV1 v2” references updated to “GOV1 v3” across the architecture, blacklist-registry, and governance pages. The signing preimage description was wrong in two places — it now correctly documents the 5-field 136-byte blake2b preimage. The rust-sdk.md page was a “coming soon” stub; replaced with full v0.3.0 docs covering all public functions. The overview page Rust tab showed a placeholder; now shows a working `check_transaction` snippet. CHANGELOG entries added for TypeScript SDK v0.3.2, CLI v0.2.3, and Rust SDK v0.3.0.

A glossary page was added covering all project-specific terminology: binary formats, contracts, architecture concepts, SDK types, and governance vocabulary. 37 terms.

Then a hover/tap preview system on top of the glossary. Every page now auto-marks the first occurrence of each defined term with a dotted underline. Hovering (desktop) shows a definition popover; tapping (mobile) shows a bottom sheet. The same system was extended to inline `code` symbols — hovering over a symbol like `check_transaction` or `FirewallError` shows the actual source snippet from the relevant file. File-path references get a file-location panel. Syntax highlighting for both TypeScript and Rust was added via a self-contained tokenizer with no CDN dependency.

## Status

All findings from the week-10 security review are fixed and documented in SECURITY.md. The Rust SDK is at v0.3.0 and publishable to crates.io. The formal review issue for the team hasn’t been filed yet — everything is done but I want to write it up properly before posting.

## What’s next

- File the formal security review issue
- Publish Rust SDK to crates.io
- Decide whether `add` and `remove` belong in the published CLI
- `examples/` folder — still outstanding
- Beginner app — still outstanding

## Refs / Sources

- [CKB Transaction Firewall](https://github.com/digitaldrreamer/ckb-transaction-firewall)
- [PR #19 — BLKL v2 and governance tooling](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/19)
- [PR #21 — signing preimage binds old_root/new_root](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/21)
- [PR #23 — CLI security vulnerabilities and code quality audit](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/23)
- [PR #24 — full audit fixes, GOV1 v3, on-chain review window](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/24)
- [PR #25 — Rust SDK v0.3.0](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/25)
- [PR #26 — docs audit and preview system](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/26)
