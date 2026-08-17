# Week 17

Covers August 10 to August 17. Week 16 ended with two items on the next list: bond binding, and a watchtower pool spec. Both turned out to rest on a question I had not asked — whether a CKB script can see the evidence Faultline classifies on. I spent the week answering that instead. No commits landed in the repo. The output is a design correction, a negative result, and a spike that verifies.

## Two proposals (mid August)

The idea was to turn Fiber Atlas from a read-only observatory into something a wallet or a routing node can act on automatically. Atlas shows who is announcing, who force-closed, and how long money stayed locked. A person can read that; software cannot act on it, and no economic consequence is attached to any of it.

**Node Reliability Bonds.** A node locks CKB in a cell. If someone provides on-chain proof the node misbehaved, the bond is slashed — a bounty to whoever spotted it, the rest burned or sent to a treasury. No judge, just the script checking the proof. Wallets then suggest peers that have a bond and a clean record, and a node without one shows as unverified.

**Decentralized Watchtower Pool.** Users pay into a shared pool when they want monitoring. Watchtowers bond. When a channel force-closes with a revoked state, any watchtower can submit the penalty and claim a reward. A tower that fails to act while another one does gets slashed.

Both use the structural authorization pattern, so the cell has no admin key — only rules about what transaction shape it will permit.

## Slashing a force close is backwards

The first thing that fell over was the slashing condition.

Force-closing is the safety mechanism. When your peer goes dark you force-close to get your money out. Under the original design that party is the one who gets slashed, which teaches nodes not to close, which leaves funds at risk. And you often cannot tell which side broadcast anyway — [SPEC-FAULTLINE](https://github.com/digitaldrreamer/fiber-atlas/blob/main/specs/SPEC-FAULTLINE.md) already says side-level attribution is medium confidence and only sometimes derivable.

So slashing is for provable cheating only. `unlock_count == 0x00` is unambiguous: a revoked commitment was broadcast and swept, and the loser of that branch is the cheater. Force-close rate stays what it already is — a weighted input to a reliability profile.

That leaves a hole, because mainnet has had zero penalties in seventeen months. A cheating-only bond would likely never slash anyone. The fix is to notice that slashing and staking are different mechanisms, and only the second one was needed. Make force-close rate a listing criterion attached to the bond: force-closing then costs verified status, which costs peers and routing fees, while the capital sits locked and stops earning. The consequence is real, and it lands on the node that chose to close rather than on whoever happened to broadcast.

The bond does something else I had not seen at first, and it is the stronger argument. Faultline attributes **0.39%** of events to a node pair; mainnet is at 0%. The ceiling exists because the chain does not know what a node is — commitment-lock args carry per-channel derived key hashes, not gossip pubkeys. A bond does not work around that, it removes it. A node that signs a binding from its channel's funding outpoint to its own pubkey has made itself attributable by construction. **The bond is the fix for the attribution ceiling, and the incentive layer is the side effect.**

## What the watchtower pool cannot do

Rewarding a tower for a successful sweep is provable: a penalty transaction exists on chain, and the claimant can be named inside it.

Slashing a tower that failed is not. If the tower sleeps and the cheater wins, the chain shows an ordinary settlement spend. There is no on-chain evidence the state was revoked at all. The only party who knows is the victim, who holds the revocation secret and has just lost their money. The fault is undetectable exactly when it matters. Proving which channels a tower was assigned would also mean publishing the assignments, which destroys the privacy the tower exists to protect.

So the accountability half cannot be built, and what is left is a bounty rather than a service contract. Then the economics from our own data finish it off: zero mainnet penalties means expected tower revenue is zero, and testnet's 3,595 are an artifact of the failure era. A market with no revenue attracts no suppliers. This is roughly why Lightning's watchtower market never materialised either.

Parking it, and publishing it as an open problem with the zero-penalty data as the reason. That is better than shipping a weaker thing under the original description.

## The evidence is in the witness (August 17)

The bond design needs a script to verify a penalty happened. Faultline's penalty predicate lives in the unlock witness, which is the hardest thing on chain for a script to reach: the commitment cell is spent, so it cannot be a `cell_dep`, and a script cannot query past transactions. The only route is a Merkle inclusion proof against a header supplied through `header_deps`.

Nobody has written that down for Fiber as far as I can tell, so I built it. No dependencies — a spike answering "can a script do this" should not answer it with a package the script could not use.

Three pieces: BLAKE2b-256 with CKB's `ckb-default-hash` personalisation; molecule serialisation of `RawTransaction` and `Transaction`, which is what `tx_hash` and `witness_hash` are taken over; and CKB's complete binary Merkle tree.

Each is pinned by the one below it. BLAKE2b-512 of `abc` matches [RFC 7693](https://www.rfc-editor.org/rfc/rfc7693). All **411** `tx_hash` values in testnet block 19,209,683 are reproduced from my serialisation. And `merge(raw_transactions_root, witnesses_root)` equals that block's `transactions_root`, `0xc39d747c…3370`. That last check confirms the tree layout empirically instead of from my reading of the Rust — which is the part I would otherwise have got wrong quietly.

## The proof verifies, and it is small

Two levels are needed, because a penalty transaction names the commitment cell it spent, not the channel. **L1** proves the penalty transaction and its witnesses are in a block, which is what carries the cheating. **L2** proves the force-close transaction that created that commitment cell, which is what reaches the funding outpoint.

Sampled 60 penalties spread evenly across the whole history — blocks 17,958,375 to 19,160,358, every 59th of 3,595. One lost to a transient RPC failure.

- Both levels verified for **59 of 59**.
- `unlock_count` came back `0` for **59 of 59**, read out of the proven bytes rather than from the RPC.
- Proof size min **1,309 B**, p50 **2,319 B**, p90 **2,949 B**, max **3,536 B**. Merkle depth 1 to 11; largest block in the sample 1,309 transactions.

The worst case is 0.67% of CKB's 512 KB transaction limit. Proof bytes live in the witness, so they cost fee and not capacity: about 0.00002 CKB at the default 1,000 shannons/KB.

I had expected proof size to be the thing that killed this. It is not close to being the thing that kills this.

## Half the unattributed penalties are not unattributable

The funding outpoint L2 recovered matched Faultline's own indexed `channel_outpoint` for 30 of 59. That looked bad for about a minute. It is not: exactly 30 of the 60 sampled had a `channel_outpoint` at all. It matched every single one Faultline had attributed.

The other half is the interesting part. **1,712 of 3,595** testnet penalties carry no `channel_outpoint`. The reason is that their commitment cell was created by spending *another commitment cell* rather than the funding cell directly, so the funding cell is more than one hop back and the scanner never links it.

I walked the chain on 25 of them and recovered the funding cell for **25 of 25**. Median 2 hops, max 7.

So those events are not unattributable in principle. They are unattributed because the scanner does not walk commitment to commitment. That is a real improvement to Atlas available today — no bond, no script, no new data source — and it is worth more than the bond work is right now.

Proof cost for the deeper chains is an estimate, not a measurement: roughly 2 KB median and 8 KB worst on top of L1, assuming a ten-deep path per hop.

## Three args layouts under one code hash

Fell out of the same sample. `classify.ts` carries `COMMITMENT_LOCK_ARGS_BYTES = 57`, cited from the contract source. Every penalty in my sample had 56.

Across the testnet archive: **46,557** cells with 57-byte args, **9,752** with 56, **2,878** with 36 — all three under the same code hash, `hash_type: type`. Which is the explanation, because `hash_type: type` means the code can be upgraded in place while the hash stays put. The block ranges line up: 56-byte args from 14,876,050 to 19,200,801, 36-byte overlapping, 57-byte from 19,256,108 onward. Mainnet has 7 at 57 bytes and 3 at 36.

So the constant is right for current cells and wrong for **21%** of testnet history. No live bug — `classify.ts` only ever parses the witness, and the constant is exported but unused. It matters for the bond design though: a slash proof that read identity out of the commitment args, which is the obvious first thing to try, would break on a fifth of the record.

## What this does not prove

Verified in JavaScript. Nothing has been compiled to RISC-V or run in CKB-VM, so the cycle cost of BLAKE2b over a 1 KB transaction plus a ten-deep Merkle path is unmeasured. That is now the likely binding constraint, not size.

`load_header` via `header_deps` is assumed and not exercised.

And the binding from a funding outpoint to a node pubkey does not exist. That is the part the bond has to add, and the only part of the chain that is not already on-chain data. Worth checking whether Fiber's `ChannelAnnouncement` signature scheme is verifiable in CKB-VM — if it is, the announcements Atlas already collects *are* the binding, and no protocol change is needed.

## FiberScope, and taking Neon's advice

Neon's week-16 review pointed at the hackathon roundup, which turned up [FiberScope](https://github.com/duongja/FiberScope). I spent enough time in it this week to stop guessing at the overlap.

The facts: created 14 July, last pushed 20 July, 28 commits, no licence file, testnet only. Fastify API, Next.js UI, Postgres behind Prisma, a pnpm/Turborepo monorepo deployed across Railway, Supabase and Vercel. Its non-goals are stated explicitly — not a wallet, no channel opening, no payment sending, no custody, no private payment tracing.

The overlap is the substrate and nothing more. Both ingest the public graph, index nodes and channels, and enrich funding outpoints with CKB data. But FiberScope's CKB use is optional enrichment for funding outpoints when CKB data happens to be available. There is no close classification, no penalty detection, no historical backfill. **Faultline is not duplicated anywhere in it.**

The directions compose rather than compete. FiberScope asks whether a payment can get through now; Faultline asks how a node has behaved when channels closed. A route-readiness engine that weights candidate hops by force-close and penalty history is strictly better than one that does not, and Faultline is the only place that data exists.

So the first proposal is the cheap one: FiberScope consumes `/v0/{network}/faultline/nodes/{pubkey}` as an optional scoring input. Read-only, already public, already running on both networks, and it costs me nothing to offer. Nothing needs merging — the stacks are opposites, Postgres and a monorepo against zero dependencies and a single SQLite service, and a merge would be the worst available version of this.

Two things to raise honestly. FiberScope has no licence, so none of its code is legally reusable by anyone right now; mine is undecided too, which makes it a shared problem rather than a complaint. And it has not been touched since 20 July, so this may have been a hackathon push and then a stop. The first message should offer something and ask for nothing.

Enough tinkering. I am taking Neon's advice and reaching out to duongja.

## Status

No code shipped to fiber-atlas this week. The bond design survived contact with the chain, in a different shape than it started: slashing narrowed to provable cheating, consequence moved from slashing to staked listing, and the real argument for it turning out to be attribution rather than incentives. The watchtower pool did not survive, and is parked with a written reason. The spike verifies against real testnet penalties, and the code is in this week's folder.

Of Neon's two week-16 review points, the FiberScope one is now answered well enough to act on and I am reaching out. The UI readability pass is still untouched. The Nervos Talk thread is now five weeks running.

## What's next

- Teach the scanner to walk commitment to commitment back to the funding cell — highest-value item, and independent of everything else here
- Loosen the 57-byte args assumption, and record which layout a cell used
- Cycle-profile the proof in CKB-VM, since that is the open feasibility question
- Check whether `ChannelAnnouncement` signatures verify in CKB-VM
- **SPEC-BOND**: cell shape, the binding, unbonding delay, verified-status criteria
- Write up the watchtower negative result properly
- UI readability pass, per Neon's review
- Message duongja: offer the Faultline node endpoint as a scoring input for route readiness, and ask about licensing on both sides
- **A+01** proper: assert ingested counts against the source node's own graph RPC
- Cycle profiling of the firewall's `registry-format` crate with large registries
- Firewall testnet drills for stale deps and key rotation, with written runbooks
- Independent external audit of the firewall's on-chain scripts
- Governance coordination over a shared signed-artifact git repo
- The Nervos Talk thread I owe Neon
- License decision before a first release

## Refs / Sources

- [Fiber Atlas repo](https://github.com/digitaldrreamer/fiber-atlas)
- [Fiber Atlas, live](https://fiber-atlas.drreamer.digital/#/mainnet/overview)
- [Faultline spec](https://github.com/digitaldrreamer/fiber-atlas/blob/main/specs/SPEC-FAULTLINE.md)
- [FiberScope, by duongja](https://github.com/duongja/FiberScope)
- [FiberScope, live API](https://fiber-scope-api.vercel.app)
- [Gone in 60ms — Fiber infrastructure hackathon roundup](https://talk.nervos.org/t/gone-in-60ms-fiber-infrastructure-hackathon-roundup/10561)
- Spike code: [`week-17/slash-proof-spike`](./slash-proof-spike)
- [RFC 7693 — BLAKE2](https://www.rfc-editor.org/rfc/rfc7693)
- [Molecule](https://github.com/nervosnetwork/molecule)
- [fiber-scripts](https://github.com/nervosnetwork/fiber-scripts)
- [fiber](https://github.com/nervosnetwork/fiber)
- CKB testnet RPC used throughout: `https://testnet.ckbapp.dev/`
