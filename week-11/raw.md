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


Status

Every finding from the week-10 review is fixed and documented in SECURITY.md. I still haven't filed the formal review issue for the team -- want to write it up properly before I do.


What's next

- File the formal security review issue
- Decide whether add/remove belong in the published CLI
- examples/ folder -- still outstanding
- Beginner app -- still outstanding


Refs / Sources

- CKB Transaction Firewall repo - https://github.com/digitaldrreamer/ckb-transaction-firewall
- PR #19 (BLKL v2 and governance tooling) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/19
- PR #21 (signing preimage binds old_root/new_root) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/21
- PR #23 (CLI security vulnerabilities + quality audit) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/23
- PR #24 (full audit fixes + GOV1 v3) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/24
