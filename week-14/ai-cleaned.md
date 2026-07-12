# Week 14

_July 5_

Week 13 shipped `treasury-lock` and `proposal-anchor` inside the firewall, closing the keyless anchor funding path. But the more I worked on the UX around it — watching capacity move only when a valid proof cell appeared in the same transaction, with no signer at any stage — the more the governance treasury looked like one instance of something more general.

## The gist (early June)

Started writing it up as an essay while the firewall work was still fresh. The problem that forced it: every governance proposal needs an anchor cell on-chain, and someone has to front the capacity. If that someone is the proposer, you're asking participants to lock personal capital for the public good. That's not governance — it's a donor programme with extra steps.

The insight is simpler than the implementation: instead of asking who controls the funds, ask under what conditions capacity should be allowed to move. A treasury type script permits spending only when a valid proof cell of an authorized type appears in the same transaction. The proof cell's type script enforces the real conditions. No signature on the treasury spend, no key — the condition **is** the authorization.

Both scripts run against the same transaction in the same consensus pass, and neither calls the other. That isn't a design choice; it's how CKB's execution model works. The mutual guarantee comes from structure, not from inter-contract trust.

Dropped the first draft as a [gist](https://gist.github.com/digitaldrreamer/382a99898a44f4b2db2266b5b5c1c9c6). The firewall governance treasury on testnet is the worked example, with `treasury-lock` and `proposal-anchor` from week 13 as the concrete deployment.

## RobairEth's comment (June 6)

RobairEth left fair pushback on the gist the same week. Formal specification of financial conditions is hard, and the cost of getting it wrong is permanent: if the proof type script has a bug, there's no key to rotate and no owner to fix it — the "no one controls it" property becomes a liability the moment there's a logic error.

He's right. The mitigation is the same as anywhere in immutable contract development: spec properly, test thoroughly, deploy on testnet before mainnet funds go in — which is exactly why the firewall has been on testnet. The difference in degree is that post-deployment recovery mechanisms reintroduce a trusted party, so the pre-deployment bar is higher. The permanence of bugs is the cost of the trustlessness. I replied on the gist and took that weight more seriously in what I wrote next.

## Neon (June 12)

Shared the gist with Neon. He picked up the pattern quickly — autonomous treasury funding cell creation, tasks agents could manage rather than user-facing flows, frictionless onboarding against the ~61 CKB cell floor. He also flagged gaming risk and stressed that checks and balances still matter: the proof conditions define what qualifies, and the treasury enforces without an admin.

He pointed at other CKBuilder [crowdfund work](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/6) and suggested starting a discussion thread on Nervos Talk for wider feedback. I said I would — then life got in the way and I didn't reply for over a week.

## Falsification rounds

Before turning the essay into a repo I wanted to stress-test whether the pattern is actually novel or just unfamiliar framing. Went through Bitcoin covenant proposals (CTV, OP_VAULT, OP_CAT), Ergo's ZK Treasury, Cardano Plutus eUTXO patterns, the standard Ethereum Governor + Timelock + Safe stack, and the UTXO smart-contract literature. Compiled the notes as a reply on the gist and kept them in the repo as `structural-authorization-ckb-comments.md`.

What held up:

- **Ergo is the closest chain.** ErgoScript can inspect the full spending transaction the way CKB type scripts can, and Ergo's ZK Treasury authorizes spending without a single controlling key. The gap: Ergo still needs a cryptographically generated human artifact as the witness. Here the proof cell is the authorization — structural, not signed. Ergo also has no recoverable storage cost model, so the self-replenishing loop (capacity out on anchor, back on execute, net fees only) doesn't fall out of the economics the way it does on CKB.
- **Bitcoin covenants** are spirit-adjacent but not deployed, and can't read cell data for dynamic conditions.
- **Ethereum treasuries** always terminate in a key or multisig.
- **Cardano** can do mutual validation, but wiring reference inputs is more cumbersome and there's no native `since` equivalent.

Three things in combination look genuinely new on a live system: condition-as-authorization with no cryptographic artifact, the self-replenishing economic loop from CKB's capacity model, and simultaneous mutual validation without inter-contract calls.

Honest qualifications: whoever deploys the type scripts sets the rules — trustlessness is about ongoing operation, not inception. UTXO contention is real for pool cells that mutate on every contribution. And the pattern isn't formally verified yet; the firewall deployment is the prototype evidence.

## ckb-structural-authorization (June 21)

Turned the gist into a proper [spec repo](https://github.com/digitaldrreamer/ckb-structural-authorization), and renamed the core idea from "self-enforcing treasury" to **structural authorization** once the abstraction settled. The treasury is an application of the pattern, not the pattern itself.

Two spec layers:

- **`SPEC-CORE.md`** — the base pattern. A guarded cell with an open lock whose type script permits spending only when a valid condition cell of an authorized type appears in the same transaction. A guard script and a condition script, mutually validating in one atomic transaction context. This is what bug bounties, bonds, escrows, and assurance contracts use without needing a shared pool.
- **`SPEC-TREASURY.md`** — the shared-pool adaptation on top of `SPEC-CORE`: donation, the anchor / execute / abort lifecycle, capacity replenishment. Governance proposal funding in the firewall is the flagship instance, mapping directly to `treasury-lock` and `proposal-anchor` from week 13, now described in generic terms (guarded cell, condition cell, proof cell).

`POSSIBILITIES.md` sketches applications from buildable-now (dominant assurance contracts, self-enforcing bug bounties, accountability bonds, protocol dev funds) through complex-but-sound (lending, parametric insurance, bridge escrows without operators, quadratic funding) — same guard script, different condition scripts. Kept the original essay as `structural-authorization-ckb.md`, and the README got mermaid diagrams for EVM vs CKB authority models and the guard/condition mechanism.

## What to build next

`POSSIBILITIES.md` probably overshoots — I listed a lot to show range, not because I'm building all of it.

For proof, the self-enforcing bug bounty is the right first build. Smaller surface than a full treasury lifecycle, but it demonstrates the core claim directly: the bounty **is** the invariant check, the exploit is the proof, the proof is the claim, and there's no human severity assessment. A protocol team can't renege because they don't hold a key to the bounty cell. The limitation is real — only invariants expressible as on-chain checks qualify — but that's the point of picking it as a demo. Crowdfund is the other obvious candidate (Neon pointed at existing CKBuilder work there); the dominant-assurance-contract variant is more interesting than a plain pool but also heavier. Bug bounty first, then see.

Still owe Neon a Nervos Talk thread, and the formal firewall security review submission from week 13 is still on the list.

### Refs / Sources

- [Structural Authorization repo](https://github.com/digitaldrreamer/ckb-structural-authorization)
- [Original gist — self-enforcing treasury essay](https://gist.github.com/digitaldrreamer/382a99898a44f4b2db2266b5b5c1c9c6)
- [CKB Transaction Firewall — prototype deployment](https://github.com/digitaldrreamer/ckb-transaction-firewall)
- [CKBuilder crowdfund discussion](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/6)
- [Bitcoin covenants overview](https://bitcoinops.org/en/topics/covenants/)
- [Ergo ZK Treasury](https://ergoplatform.org/en/blog/2020-09-04-announcing-the-zk-treasury-on-ergo/)
- [CKB since field RFC](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0017-tx-valid-since/0017-tx-valid-since.md)

---

> I forgot to push this last week and I understand that combining weeks doesn't count as separate weeks. It's on me to make sure I push my devlogs on time each week, so I'm combining this into one report, hence the different dates in each half.

---

_July 12_

The structural-authorization work above was a write-up stretch — spec repo, no firewall code. This half comes back to the firewall itself: I submitted it to the CKBuilder project catalogue, got the first outside review of the whole system rather than of one contract at a time, and turned the most actionable piece of that review into a PR.

## The submission — [issue #19](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/19)

Filed the firewall as a CKBuilder project. Everything from the prior weeks went in as one package: the five on-chain contracts (`firewall-lock`, `blacklist-registry`, `governance-lock`, `proposal-anchor`, `treasury-lock`), the TypeScript SDK (`@ckb-firewall/sdk` 0.3.4) and Rust SDK (`ckb-transaction-firewall-sdk` 0.3.1), the CLI (`@ckb-firewall/cli` 0.5.2) with the full governance lifecycle, and the local governance dashboard — all on testnet.

The request-for-feedback section was the point of submitting. The two things I couldn't answer myself: what a credible path to mainnet looks like for something enforcing payment rules at consensus (internal review is done — 4 criticals, 7 highs, all resolved — but an internal review isn't an external bar), and whether fail-closed is the right default when the registry cell dep is missing or malformed. I also flagged the governance-coordination gap honestly: proposal JSON currently moves between committee members by email/Slack and gets copied into `~/.ckb-firewall/proposals/` by hand.

## Officeyutong's feedback (June 14)

Got a review back with a checklist rather than a verdict.

**Mainnet readiness**, at minimum: an independent external audit of the on-chain scripts; fuzz/property tests for registry parsing, dep resolution, sorting, malformed data, and expiry; cycle profiling with large registries; full testnet drills for add / remove / temporary expiry / stale dep / key rotation; and written runbooks for registry update, key compromise, and recovery. Explicitly: don't treat the internal review as enough.

**Fail-closed** is the right tradeoff. If a missing or malformed dep failed open, a compromised agent could omit or corrupt the dep to bypass the firewall. Stale deps are a tooling problem — make refresh/retry easy in the SDK and CLI, but the lock still rejects. That settles the question I'd been sitting on.

**Governance:** 3-of-5 is fine as an execution threshold but shouldn't be the whole public-registry model, and anchor cost shouldn't be the only spam defence — proposal validation, evidence requirements, and rate limiting still matter. **Scope:** keep repeating the boundary in the docs — outputs not counterparties, no incoming screening, no full input screening, no protection for cells that don't use the firewall lock, and preflight is not the security boundary.

## Picking what to build

Most of the list is process — audit, drills, runbooks. The one item that was pure code this week was the fuzz/property tests for registry parsing and malformed data. I started there and hit a question I couldn't answer: which parser?

The BLKL v2 registry payload was being decoded in three places — inside `blacklist-registry`, inside `firewall-lock`, and again in the Rust SDK. Three hand-written copies of the same bounds-checking, sorting, and length logic. Fuzzing one proves nothing about the other two, and any of the three can drift. For a consensus script that's a latent fork: if the on-chain decoder and the SDK decoder disagree on whether a payload is valid, off-chain screening and on-chain enforcement stop agreeing. So the test task became a consolidation task.

## registry-format: one canonical decoder — [PR #39](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/39)

Extracted the BLKL v2 decoder into a new shared crate, `crates/registry-format`. It's `no_std` (alloc only) with no `ckb-std` dependency — the same source links unchanged into the on-chain contracts and also compiles on the host, so it can be property-fuzzed without a CKB VM. `blacklist-registry` and `firewall-lock` now call into it, and the Rust SDK delegates its entry decoding to it. One decoder, exercised by both the consensus path and the fuzz suite.

The wire format it parses:

```text
BLKL(4) | version(1)=0x02 | gov_header_len(2 LE) | gov_header(..) |
entry_count(4 LE) | [ id_len(1) | id(id_len) | expires_at(8 LE) ] × entry_count
```

Entries must be strictly ascending by identifier.

With the parser in one place I also closed a malleability gap. Added `parse_strict`, which rejects any trailing bytes after the declared entries. The old lenient `parse` ignored them, so two different byte strings could decode to the same registry — non-canonical. The contracts use the strict form now, so the encoding has to be exact. Kept the lenient `parse` too, because the fuzz suite runs both and checks them against each other. Marked `feat(contracts)!` — a payload that used to squeak through with junk on the end now gets rejected.

**Tests:** 11 property/fuzz/round-trip cases in the crate — `parse_never_panics`, `oversized_entry_count_no_oom`, `truncation_rejected`, `unsorted_rejected`, `duplicate_identifier_rejected`, `wrong_version_rejected`, `trailing_bytes`, `expiry_preserved`, `roundtrip_wellformed`, `strict_error_precedence`, and `is_blacklisted_matches_scan` (a linear-scan oracle). 8 more in the SDK against the same decoder, plus an end-to-end VM test that rejects a registry update carrying trailing bytes. That covers the parsing / sorting / malformed / expiry line of Officeyutong's list; dep resolution and cycle profiling are separate and still open.

## Gemini review round

Two bots on the PR. BattleTest found no issues. Gemini found two, both in the new parser's bounds checks — worth taking seriously precisely because this is now the single decoder everything depends on:

1. **(high)** `count_offset + 4 > data.len()`. `parse_entries` is public, so `count_offset` is caller-supplied. A near-`usize::MAX` offset wraps the addition and slips past the bounds check, then panics on the out-of-bounds index. Fixed with `checked_add(4)` — an offset that can't fit fails the check instead of wrapping.
2. **(medium)** `offset + id_len + 8 > data.len()`. Same shape. Rewrote it as `id_len + 8 > data.len() - offset`. The subtraction can't underflow because `offset < data.len()` is checked one line up, which keeps the small `id_len + 8` from overflowing near the top of the range.

Neither is reachable through the current on-chain call path — there the offset is bounded by the u16 governance-header length — but the crate is public and the SDK calls it, so the public entry point gets hardened regardless. Applied both, re-ran the suite (11 + 8 green, clippy clean, the `firewall-lock` contract build passed in CI), replied on the thread, and merged once all checks were green.

## Where this leaves the mainnet list

Parsing / malformed / sorting / expiry is largely closed, and the three-way drift risk is gone with it. Still outstanding from the review:

- Independent external audit (process, not something I can self-serve).
- Cycle profiling with large registries — the next concrete build; now there's one decoder to profile.
- Testnet drills for stale-dep and key-rotation, with written runbooks.
- Governance coordination transport — Officeyutong endorsed the shared signed-artifact git repo approach I was leaning toward, so that's the direction.

Still owe Neon the Nervos Talk thread from the first half of this log.

## What's next

- Self-enforcing bug bounty as the first structural-authorization proof build
- Cycle profiling of `registry-format` with large registries
- Testnet drills (stale-dep, key-rotation) + runbooks toward the mainnet bar
- Governance coordination via a shared signed-artifact git repo
- Owe Neon the Nervos Talk thread

## Refs / Sources

- [CKBuilder submission — issue #19](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/19)
- [PR #39 — shared registry-format crate + fuzz tests](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/39)
- [CKB Transaction Firewall](https://github.com/digitaldrreamer/ckb-transaction-firewall)
- [Security model / scope boundary](https://ckb-firewall.drreamer.digital/concepts/security-model/)
- [Structural Authorization repo](https://github.com/digitaldrreamer/ckb-structural-authorization)
