The week had two tracks that ended up connected. The first was getting BLKL v2 and the full governance workflow shipped. The second was going through the security issues from last week's review -- that one went deeper than expected.


BLKL v2 and governance tooling

The v2 protocol change had been on the list since the CLI launched. The v1 registry format was single-registry only, and the governance workflow -- propose, vote, sign, execute -- was partially implemented. PR #19 finished it.

BLKL v2 adds a governance header section to the registry payload. That header carries the committee pubkeys, so signer key rotation no longer needs a contract redeployment. The firewall-lock updated to support multi-registry: it can now match against multiple registry cell deps instead of exactly one. The CLI got the full workflow commands wired up properly: `import` and `export` for proposals, `check` for preflight, plus the full governance sequence.

The PR review came back with issues. Two went into fixes the same day: the signing preimage was binding to the transaction hash, which meant you had to know the tx hash before signing -- breaking the sign-before-execute workflow. Replaced with blake2b(proposal_id_hash || vote_digest_hash || old_root || new_root). Signers now commit to the exact state transition. PR #21.


Security hotfixing (then stopping)

After PR #21 merged I started going through the remaining open issues from last week's review. The C-4 block in execute.ts referenced `oldRoot` and `newRoot` before they were declared. Temporal dead zone -- runtime throw if that path was hit. Fixed the ordering and opened PR #22.

Then I kept reading. Each thing I fixed showed me something else. The `--cmd` argument in update-blacklist.ts was going directly to `execSync`. `--key` was putting private keys in ps output. The signer index validator was producing NaN. Identifier length silently truncated above 255 bytes.

At some point I had overlapping changes in two branches and they were starting to conflict. I closed PR #22 -- it was going to get superseded -- and stopped patching.

Audit first. Fix after.


Security audit and code quality pass (PR #23)

Wrote up every finding with a severity label and addressed them in one pass.

V1 (critical) -- temporal dead zone: C-4 verification block moved after `oldRoot`/`newRoot` computation.
V2 (high) -- command injection: `execSync` -> `execFileSync` with a parsed argv array.
V3 (medium) -- key exposure: removed `--key` entirely from sign and vote. Interactive prompt only.
V4 through V7 -- error isolation in listProposals(); HTTPS throws instead of warns; dynamic signer bound from on-chain committee size; explicit throw on identifier overflow.

Then the code quality pass:

sign and vote commands were missing `--rpc-url` and `--registry-tx` in index.ts. opts.rpcUrl was always undefined -- both commands were broken at runtime and I hadn't caught it.

Votes weren't freezing once signing started. Adding a new vote after the first signature invalidates collected signatures because vote_digest_hash changes.

vote.ts wasn't verifying the local pubkeys Merkle root against on-chain before accepting a vote. A validator with a stale local config could vote and only find out at execution.

The Rust SDK had no BLKL v2 parsing. Added GovernanceHeader struct and replaced the O(n) scan with binary search. A few more through Q13 -- binary search in check.ts, trailing slash normalization, SDK fetch timeout, auto-reject of expired proposals, version string corrected.


On-chain review window: GOV1 v3 (PR #24)

After PR #23 merged I looked at H3 properly. H3 was the one I'd left with a note and moved past.

The 72-hour governance review window was enforced only by the CLI's `expiresAt` check. Nothing on-chain stopped someone with three governance keys from crafting a raw transaction and skipping it entirely.

The fix was a new witness format. GOV1 v3 is 141 bytes -- 133 bytes of v2 plus 8 bytes for `review_window_end_ms` as a little-endian u64. The governance-lock contract reads the `since` field on the governance input, verifies it encodes an absolute median-time-past timestamp, and rejects with ERR_REVIEW_WINDOW_NOT_MET (code 6) if the value is below `review_window_end_ms`. Consensus-level enforcement.

There was also a gap in the version discriminator: a 141-byte payload with version byte 0x02 would pass the length check, be parsed as v2, and skip the since enforcement. Fixed by reading the version byte first and deriving the expected length from it.

After that there was no reason to keep v2. Dropped it. All callers were already producing v3.

Wrote 10 unit tests for verify_since_timestamp covering every rejection branch and the passing boundary cases.


Rust SDK v0.3.0 (PR #25)

The Rust SDK was at v0.2.0 and had drifted from the TypeScript SDK and the current protocol state. Three structural gaps: single-registry only (matching full type-script equality instead of the 32-byte type_id_value), `now_secs` baked into `check_transaction` via `SystemTime::now()`, and `parse_registry_payload` was private.

Updated to v0.3.0. The flat lib.rs was split into six focused modules: errors, types, registry, builder, firewall, testnet. type_id_value matching now correctly reads bytes 34-66 of the registry type-script args, matching the on-chain resolver. `check_transaction` takes `now_secs: u64` as an explicit parameter -- callers supply the chain's median time or system time, nothing is baked in. `parse_registry_payload` is public.

The builder module is new: `build_firewall_lock_args`, `build_firewall_lock_script`, and `build_firewall_spend_cell_deps` mirror the TypeScript SDK's builder.ts, encoding the v2 FirewallLockArgs byte layout. `preflight_check` and `is_blacklisted` are also now standalone public helpers -- useful when you've already fetched and parsed registry payloads yourself.

Optional serde and testnet feature flags. `encode_registry_payload` and `encode_governance_header` are public so callers can produce test payloads or build tooling without reimplementing the wire format. Only BLKL v2 is accepted; v1 is hard-rejected. 20+ tests.

PR review surfaced real issues. The error_codes module had entirely wrong constants for codes 5-7 and 13-16 -- I'd invented governance codes that don't exist in the contract. The actual mapping (from the frozen v1 contract): InvalidArgsLayout=5, UnsupportedVersion=6, UnsupportedFlags=7, MissingInnerLockCellDep=13, InvalidInnerLockScript=14, InnerLockRejected=15, OutputScriptParseFailed=16. The dep-matching length check was >= 66 instead of == 66; the on-chain resolver requires exact length. The `parse_entries` function was missing the max_possible bounds check before Vec::with_capacity, which the contract itself has to prevent OOM on malicious input. The governance header bounds were checked against data.len() instead of offset + gov_len, allowing a malformed gov_header_len to cause reads into the entry section. `encode_registry_payload` was casting identifier length to u8 without validation, silently truncating anything over 255 bytes. Fixed all of these in a follow-up commit.


Docs audit and preview system (PR #26)

With the protocol changes stabilized, the docs site had accumulated a lot of stale content. PR #26 was a full sweep.

All "GOV1 v2" references updated to "GOV1 v3" across the architecture, blacklist-registry, and governance pages. The signing preimage description was wrong in two places -- it now correctly documents the 5-field 136-byte blake2b preimage. The rust-sdk.md page was a "coming soon" stub; replaced with full v0.3.0 docs covering all public functions. The overview page Rust tab showed a placeholder; now shows a working check_transaction snippet. CHANGELOG entries added for TypeScript SDK v0.3.2, CLI v0.2.3, and Rust SDK v0.3.0.

A glossary page was added covering all project-specific terminology: binary formats, contracts, architecture concepts, SDK types, and governance vocabulary. 37 terms.

Then a hover/tap preview system on top of the glossary. Every page now auto-marks the first occurrence of each defined term with a dotted underline. Hovering (desktop) shows a definition popover; tapping (mobile) shows a bottom sheet. The same system was extended to inline code symbols -- hovering over a symbol like check_transaction or FirewallError shows the actual source snippet from the relevant file. File-path references get a file-location panel. Syntax highlighting for both TypeScript and Rust was added via a self-contained tokenizer with no CDN dependency.


Status

Every finding from the week-10 review is fixed and documented in SECURITY.md. The Rust SDK is at v0.3.0 and publishable to crates.io. I still haven't filed the formal review issue for the team -- want to write it up properly before I do.


What's next

- File the formal security review issue
- Publish Rust SDK to crates.io
- Decide whether add/remove belong in the published CLI
- examples/ folder -- still outstanding
- Beginner app -- still outstanding


Refs / Sources

- CKB Transaction Firewall repo - https://github.com/digitaldrreamer/ckb-transaction-firewall
- PR #19 (BLKL v2 and governance tooling) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/19
- PR #21 (signing preimage binds old_root/new_root) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/21
- PR #23 (CLI security vulnerabilities + quality audit) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/23
- PR #24 (full audit fixes + GOV1 v3) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/24
- PR #25 (Rust SDK v0.3.0) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/25
- PR #26 (docs audit and preview system) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/26
