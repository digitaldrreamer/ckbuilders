Covers August 3 to August 10. Week 15 ended with Fiber Atlas deployed on both networks and waiting on feedback. Both reviews I was waiting on arrived. Neon's pointed outward, at the UI and at what other people built on the same topic. Dang Ty's pointed at two defects, and answering them cost three commits and a schema migration.


Neon's review (early August)

Two notes, both short. Look at the Fiber infrastructure hackathon roundup (https://talk.nervos.org/t/gone-in-60ms-fiber-infrastructure-hackathon-roundup/10561) to see what other people did on the same topic, for ideas and improvements. And the UI could do with improvement for readability.

The roundup turned up FiberScope by duongja, which overlaps directly with the Atlas half. Both ingest the public Fiber graph, index nodes and channels, enrich channel funding outpoints with CKB data, and serve an API and a web explorer. The divergence is in what gets built on top. FiberScope goes toward route readiness, liquidity recommendations and payment diagnostics. Fiber Atlas runs on mainnet as well as testnet, and goes toward Faultline: the full historical record of channel closures and reliability.

Real overlap, not duplicated effort. The two halves answer different questions off a shared substrate -- can this payment get through, versus how has this node behaved when channels closed. So there is an integration opportunity rather than a race. Have not approached duongja about it yet.

The UI note stands on its own and I have not acted on it. Readability was never designed. The web UI exists because the API needed a face.


Asking for review (early August)

I posted Fiber Atlas in the CKBuilders community under request review/feedback/testing. Deployed service, both networks, read-only API, web UI. The ask was for someone to actually run it rather than look at the README.

Dang Ty did. He tested locally against synthetic CKB transactions, confirmed the core close/settlement/penalty classification worked, and came back with two issues and a recommended fix for each:

- `/faultline/unresolved` can include already-spent but unclassified cells. Use `spend_tx_hash IS NULL` for unresolved.
- Duplicate unattributed events can be stored. Use a non-null identifier such as `commitment_outpoint` for deduplication.

Both were right. Both were exactly the fix. Synthetic transactions found them because synthetic transactions can produce the awkward cases the real archives happen not to contain, which is the point of testing that way.


A spent cell is not a stuck cell (August 9)

`/faultline/unresolved` and `/faultline/timing` selected on `spend_kind IS NULL`. That predicate is true of two different things: a cell nobody has spent, and a cell that was spent by a transaction whose witness could not be read. Only the first is unresolved. The second was appearing under a heading that reads "Funds in them have not moved", when the funds had moved.

Switching to `spend_tx_hash IS NULL` fixes the wrong claim, but on its own it makes those cells vanish -- `resolution_hours` requires `spend_kind IS NOT NULL`, so they would drop out of both buckets and be reported nowhere. So they get a `spent_unclassified` count of their own, which is the same distinction `bin/stats.ts` was already drawing internally. Every cell now lands in exactly one bucket, and there is a test that asserts that.

Neither archive currently holds such a cell, so no published figure changed. The endpoint was making a claim it could not have supported, not a claim that was currently wrong.

This was also where the test setup went in: `npm test`, and `test/` brought under typecheck.


Event identity (August 9)

The second issue was worse than reported, in both directions.

The unique key was `(kind, tx_hash, channel_outpoint)`. SQLite treats NULLs as distinct in a unique index, so for a quarantined event -- one with no `channel_outpoint`, which is the F+04 case the spec explicitly requires us to keep -- the `ON CONFLICT` never fired at all and duplicates accumulated freely. Replaying every archived page over the existing testnet database grew the feed from 93,321 rows to 133,301. A 43% inflation, landing entirely in the quarantine bucket that sits behind the published coverage figure. That is not a hypothetical: a crash mid-page does it, because the cursor is only persisted after a page is applied, and `scan --restart` does it on purpose.

The same key was simultaneously too tight. Two different commitment cells swept by one transaction collapsed into a single event.

Events are now keyed on their subject: the commitment cell for a penalty or a settlement, the channel for a close. That is non-null and immutable for every kind. `commitment_outpoint` is promoted out of the detail JSON into a column, uniqueness moves to an expression index because SQLite forbids expressions in a UNIQUE constraint, and a CHECK rejects a row with neither subject rather than letting the NULL behaviour quietly come back.

The migration rebuilds the table, since SQLite has no DROP CONSTRAINT and will not drop a constraint's implicit index. It drops the attribution view first, because `ALTER TABLE ... RENAME` validates every view and the view references the table being replaced. It backfills `commitment_outpoint` from the detail JSON, and dedupes before creating the index, since `CREATE UNIQUE INDEX` over dirty data raises. That last part matters more than it sounds: migration runs in the Store constructor, so a raise there is not a failed migration, it is the scanner, replay and ingest all being unable to open the file. No replay and no network access needed. 926 ms on testnet, every row preserved, and a full replay of all 190,090 archived hits reproduces the feed exactly.

`reconcileAttribution()` lost its `UPDATE OR IGNORE`, which only ever existed to survive colliding with duplicates of the row it was attributing, and which silently left those duplicates unattributed forever.


Replay was wiping gossip (August 9)

Found while writing tests for the above, not reported. `resetDerived()` deleted the `channel` table outright, but that table is not purely derived. Its L1 columns come from the archive and replay rebuilds them. Its gossip columns come from a live Fiber node and exist nowhere else.

So an offline replay -- the thing advertised as costing nothing, the whole reason the crawl is archived -- reset node attribution to 0.0% until the next ingest. On testnet that silently discarded all 267 node-attributed events. On mainnet, already at 0%, nobody would have noticed.

The L1 half is now cleared in place, the gossip half is left alone, and rows gossip never touched are removed so replay recreates them. `bin/replay.ts` reports the retained count, because that is the number this used to destroy without saying anything.


One bad row should not brick the archive (August 9)

The rebuild above read every legacy row with a bare `json_extract` and copied it into a table carrying `CHECK (commitment_outpoint IS NOT NULL OR channel_outpoint IS NOT NULL)`. Two ways that ends badly, and they end the same way, because of the constructor problem: `json_extract` raises on a detail that is not valid JSON, and one such row anywhere takes the whole migration with it; and a row with neither subject fails the CHECK, rolls the transaction back, and reports "CHECK constraint failed", which is true and useless.

Detail is now read through `json_valid()`, so an unparseable payload becomes a NULL the migration can reason about instead of an exception. Rows left with no subject at all move to `event_unkeyable`, retained verbatim with a reason and a timestamp, and the count is warned about. That is the same call F+04 already makes for an event that cannot be tied to a channel: keep what was observed, say so plainly, and do not let one bad row decide whether the database opens.

Unreachable from the current writers. `processFundingRows` always supplies a `channel_outpoint` and `processCommitmentRows` always supplies a `commitment_outpoint`, so this is for rows left by an older version or edited by hand. Both archives migrate with zero rows quarantined and identical output: testnet 93,321 events and 267 node-attributed, mainnet 220.


PR #1 (merged August 9)

909 insertions, 13 deletions, 9 files. Three test files covering event identity, the migration itself, reset behaviour, replay preservation and unresolved-cell reporting. BattleTest ran a security review and found nothing. CodeRabbit hit its free OSS review limit partway through, so its pass covered the last commit only.

The deletion count is the honest summary of the week. Almost none of this was rewriting logic. It was making the database say what the code already believed.


Status

Fiber Atlas is deployed on both networks with the reported issues fixed and a test suite behind them. Community review produced two real defects on the first outside test, and chasing them produced a third. Neon's review is in and neither of its two points is answered yet: the UI readability work and the FiberScope conversation are both outstanding. License still undecided before a first release.


What's next

- UI readability pass, per Neon's review
- Approach duongja about where FiberScope and Fiber Atlas fit together
- Bond binding: how a channel commits to a bonded node on chain
- Watchtower pool spec, as the easier of the two to write
- A+01 proper: assert ingested counts against the source node's own graph RPC
- Cycle profiling of the firewall's registry-format crate with large registries
- Firewall testnet drills for stale deps and key rotation, with written runbooks
- Independent external audit of the firewall's on-chain scripts
- Governance coordination over a shared signed-artifact git repo
- The Nervos Talk thread I owe Neon, now four weeks running


Refs / Sources

- Fiber Atlas PR #1 (event identity and unresolved cells) - https://github.com/digitaldrreamer/fiber-atlas/pull/1
- Fiber Atlas repo - https://github.com/digitaldrreamer/fiber-atlas
- Fiber Atlas, live - https://fiber-atlas.drreamer.digital/#/mainnet/overview
- Gone in 60ms, Fiber infrastructure hackathon roundup - https://talk.nervos.org/t/gone-in-60ms-fiber-infrastructure-hackathon-roundup/10561
- FiberScope, by duongja - https://github.com/duongja/FiberScope
- Faultline spec (F+04 quarantine) - https://github.com/digitaldrreamer/fiber-atlas/blob/main/specs/SPEC-FAULTLINE.md
