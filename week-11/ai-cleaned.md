# Week 11

Two threads this week. The first was shipping BLKL v2 and the complete governance workflow — a protocol change that had been staged since the CLI launched. The second was working through the security findings from week 10's review. The second thread didn't go as planned.

## BLKL v2 and governance tooling

The v1 registry format was single-registry only and the governance CLI workflow was incomplete. PR #19 finished both.

BLKL v2 adds a governance header to the registry payload carrying the committee pubkeys. Signer key rotation no longer requires a contract redeployment — update the registry, not the contract. The firewall-lock was updated to support multi-registry matching. The CLI got the complete governance sequence wired up: `import`, `export`, `check`, `propose`, `vote`, `sign`, `execute`.

Review flagged an issue with the signing preimage. It was binding to the transaction hash, which requires knowing the tx hash before signing and breaks the sign-before-execute workflow. Replaced with `blake2b(proposal_id_hash || vote_digest_hash || old_root || new_root)`. Signers now commit to the exact state transition. That fix landed the same day as PR #21.

## Hotfixing, then stopping

After the v2 work I started going through the remaining open issues from week 10's security review. The C-4 verification block in execute.ts referenced `oldRoot` and `newRoot` before they were declared — temporal dead zone, runtime throw if the path was hit. Fixed the ordering, opened PR #22.

Then kept reading. The `--cmd` argument in update-blacklist.ts was going verbatim into `execSync`. The `--key` flag on sign and vote was exposing private keys in process listings and shell history. The signer index parser could produce NaN. Identifier length silently truncated above 255 bytes and produced payloads the chain would reject.

Each fix pointed to something else. At the point where two branches had overlapping changes that were starting to conflict, I stopped and closed PR #22. Patching one issue at a time wasn't working — the problems were structural chains, not isolated bugs.

## Security audit (PR #23)

Wrote up every finding with a severity label, then addressed them in a single pass.

**V1 (critical)** — temporal dead zone: the C-4 signer verification block moved after `oldRoot` and `newRoot` are computed.

**V2 (high)** — command injection: `execSync` → `execFileSync` with an explicit parsed argument array in update-blacklist.ts.

**V3 (medium)** — key exposure: `--key` removed from sign and vote entirely. Interactive prompt only, no flag path.

**V4–V7 (low)** — error isolation in listProposals(); `assertHttps()` now throws instead of warns for non-local HTTP; dynamic signer index bound derived from on-chain committee size; explicit throw on identifier overflow in blkl.ts.

A code quality audit ran alongside the security pass.

sign and vote were missing `--rpc-url` and `--registry-tx` in index.ts — `opts.rpcUrl` was always undefined and both commands were broken at runtime. Votes needed to freeze once signing started: adding a vote after the first signature changes the vote_digest_hash and invalidates collected signatures. vote.ts wasn't checking the local pubkeys Merkle root against on-chain before recording a vote. The Rust SDK had no BLKL v2 parsing — added GovernanceHeader struct and replaced the O(n) scan with an expiry-aware binary search. Several more through Q13: binary search in check.ts, AbortController timeout in SDK fetch, auto-rejection of proposals with expired review windows, version string corrected.

## GOV1 v3 and on-chain review window enforcement (PR #24)

After PR #23 merged, H3 was still open. It was the structural one.

The 72-hour governance review window before execution was enforced only by the CLI's `expiresAt` check. Nothing on-chain prevented someone with three governance keys from crafting a raw transaction and bypassing it entirely.

The fix required a new witness format. GOV1 v3 is 141 bytes: the 133-byte v2 layout plus 8 bytes of `review_window_end_ms` encoded as a little-endian u64. The governance-lock contract reads the `since` field on the governance input, verifies it encodes an absolute median-time-past timestamp, and rejects with ERR_REVIEW_WINDOW_NOT_MET (error code 6) if the timestamp is below `review_window_end_ms`. The review window is now enforced at consensus, not in the CLI.

There was also a gap in the version discriminator: a 141-byte payload with version byte `0x02` would pass the length check, be parsed as v2, and skip the `since` enforcement entirely. Fixed by reading the version byte first and deriving the expected length from it via a match expression.

Once v3 was working there was no reason to keep v2. Dropped it — no callers needed backward compat.

Added 10 unit tests for `verify_since_timestamp` covering every rejection branch: relative timestamps, wrong metric encoding (block height, epoch), zero `since` with nonzero minimum, value below minimum, exact boundary, value above minimum, minimum = 0.

## Status

All findings from the week-10 security review are fixed and documented in SECURITY.md. The formal review issue for the team hasn't been filed yet — everything is done but I want to write it up properly before posting.

## What's next

- File the formal security review issue
- Decide whether `add` and `remove` belong in the published CLI
- `examples/` folder — still outstanding
- Beginner app — still outstanding

## Refs / Sources

- [CKB Transaction Firewall](https://github.com/digitaldrreamer/ckb-transaction-firewall)
- [PR #19 — BLKL v2 and governance tooling](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/19)
- [PR #21 — signing preimage binds old_root/new_root](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/21)
- [PR #23 — CLI security vulnerabilities and code quality audit](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/23)
- [PR #24 — full audit fixes, GOV1 v3, on-chain review window](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/24)
