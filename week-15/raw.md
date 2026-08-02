Covers July 13 to August 3. The first three days went to the hackathon deadline. I committed nothing anywhere between July 16 and 27. The last four days took Fiber Atlas from a set of shelved specs to a deployed service on both networks.


One project per team (July 13)

I asked Neon whether a team can submit more than one project. The answer was one per team: there are a lot of participants, and judging gets difficult if each one submits several.

I had scaffolded Fiber Atlas the same day as a second entry, with a README, `SPEC-ATLAS.md`, `SPEC-FAULTLINE.md` and a build plan sized for a 60-hour window. That afternoon I changed the positioning to network-wide and on-chain, to mark it apart from single-node tools. Sluice tells you how the node you run is doing and whether a payment will go through. Atlas tells you about the other nodes on the network and how they have behaved on chain.

With one entry per team, Fiber Atlas stayed a set of specs and I left it there.


Picking the next build (July 28-30)

I had three CKB projects at spec stage and needed a way to choose between them. I wrote all three up for Neon and asked which to build, and whether any of them repeat work that already exists in the ecosystem.

`ckb-agent-control-hub` covers identity cells, encrypted config Spore cells, and permission cells for AI agents, with spending limits and expiry through CKB's native `since`. The permission cell has to be an input to any transaction the agent makes, and its type script checks the limits at consensus. Revoking a capability means spending the cell.

`veiled-ckb` is OAuth-shaped auth. It proves one claim about a user, such as wallet ownership, a balance range or a token holding, while keeping the wallet and the amounts private. A type script verifies the proof at consensus. Each site gets a different identifier for the same user, so nobody can link one person's activity across sites.

`fiber-atlas` reads gossip topology, capacity and liveness, and joins them against CKB L1 spends of channel funding cells, so that force-closes and penalties trace back to node pairs.

Neon asked what the realistic use case for veiled is, given that a user who signs in usually goes on to transact. I gave three. Token-gated access, where a Discord bot only needs to know you are above a threshold, and today it gets your address and ties your financial history to your handle for good. Airdrop eligibility, which is a read operation, but today you have to connect your wallet to a site that might be a phishing front, and that is how scammers find targets. And cross-app correlation, where several sites pool what they each learn about the same address.

His reply is the part that stuck. A site has to support veiled auth for veiled auth to protect you, and a site willing to add it is already one of the safer ones. The sites you most need protection from will carry on taking your address. The tech and the community need have to meet, and here they point in opposite directions.

He also said tooling around Fiber is more immediately relevant. Fiber Atlas reads data that already exists and works whether or not anyone integrates with it, so it is useful from the day it ships. He confirmed it as the starting point on July 30.


Prereq spike (July 31)

I checked the specs against what Fiber runs now before writing code. Four findings came out of it, and each one changed the plan.

There is no public Fiber RPC, and the design prevents one. The shipped testnet config sets `rpc.listening_addr: "127.0.0.1:8227"`, and the node refuses to start bound to a public IP unless `rpc.biscuit_public_key` is set. The public testnet nodes that are advertised are P2P relay peers identified by pubkey, for opening channels. So running an `fnn` instance is a permanent part of the system, for me and for anyone self-hosting Fiber Atlas.

`releases/latest` points at a version the network has moved past. The 0.9.x line ships as GitHub pre-releases, so latest still resolves to v0.8.1 from 2026-04-15. In a gossip snapshot of 64 nodes, 46 ran `0.9.0-rc7` and 8 ran `0.8.1`. A v0.8.1 node on that network connects to peers and then has them dropped. `list_peers` returns `[]`, `graph_channels` keeps answering from a stale partial graph frozen at 197 channels while L1 holds more than 1000 live funding cells, and the node logs nothing. Upgrading to `0.9.0-rc7` fixed the peering, and the graph RPC types are byte-identical between the two versions in `crates/fiber-json-types/src/graph.rs`, so nothing in the specs changed. Zero peers is now a hard health failure, and the ingest refuses to report a join rate when peers are zero.

Faultline gets its data from L1 alone. Scanning by the `CommitmentLock` code hash finds force-closes across the whole network with no Fiber node running. Gossip is what links an event to a node pair afterwards. I checked this against `https://testnet.ckbapp.dev/`: the indexer is enabled on the public endpoint, and all four queries by the two Fiber lock code hashes hit the 1000-row page cap. The hackathon plan had put Faultline last, assuming it sat downstream of Atlas, and its main risk was that testnet events would be too sparse to show anything. There is far more real data than needed, so Faultline could start on day one.

The specs were pinned to v0.6.1. v0.8.0 renamed `PeerId` to `Pubkey` across the RPC interfaces in PR #1154, so the node identity field in `graph_nodes` is `pubkey`. `ChannelUpdateInfo` also gained `outbound_liquidity: Option<u128>`. Fiber sets it from `get_local_balance()` and `get_remote_balance()`, and only for channels our own node is part of, so it comes back as `None` for every channel rebuilt from gossip. The balance limitation holds, and it picked up two clauses: treat `null` as missing information, and keep our own node's channels out of anything served as network-wide data.

I rewrote `plan.md` off the back of that. There is no deadline on it now, both halves are in scope, and the structural-authorization bond came back as a real phase 6.


Faultline (July 31)

The L1 scanner runs over `get_transactions` for both lock code hashes. The indexer cursor is saved per pass after each page and all writes are idempotent, so an interrupted run repeats at most one page. Classification covers cooperative close, force-close and penalty, and the penalty case is found by reading the revocation branch selector `unlock_count == 0x00` in the unlock witness.

The scanner treats an empty result as a configuration failure. Lock code hashes differ between testnet and mainnet, and a scanner pointed at the wrong set returns zero results in the same way it would if nothing had happened. It checks both hashes on startup and refuses to run if either one indexes nothing.

The crawl is archived, so I pay for it once. A full testnet backfill is about 190,000 RPC round-trips. Both the raw transactions and the indexer's grouping are stored, so a later change to a classification rule, or a field some future phase needs that this one skipped, becomes `npm run replay` against the local archive. `replay` is wired to an unreachable RPC so that it cannot reach the network. Mainnet is small enough to rescan any time: 459 funding-lock and 15 commitment-lock transactions for its whole history, well under a minute.

Attribution level is worked out at read time, so an event that arrives before its channel shows up in gossip gets attributed once the graph catches up.


Atlas ingest and the join (July 31)

`graph_nodes` and `graph_channels` go into SQLite with cursor pagination and `first_seen` / `last_seen` timestamps. The node runs observe-only.

The join key is `channel_outpoint`, and the two sources encode it differently. Fiber packs 36 bytes as `tx_hash ‖ index-LE`, and CKB returns `{tx_hash, index}`. Compared directly the join reads 0%, which looks the same as gossip having no record of these channels. The conversion lives in `src/ckb/outpoint.ts`, and the join rate is reported on every ingest run as acceptance test A+05.

`ChannelUpdate` coverage had looked like a blocker on derived liveness. It was a symptom of the isolated v0.8.1 node. On a correctly-versioned peered node it went from 2 of 394 directions to 902 of 936 within one refresh.


Docker stack (July 31)

Both networks run side by side. Each network gets an `fnn` node, an ingest loop, an L1 scan loop, a block-time pass and a geo pass, and the two share one API. Each also gets its own SQLite file, so a running deployment always serves the network it is labelled with. Testnet and mainnet tell opposite stories, so that separation is worth the duplication.

The API container publishes no host port, and Traefik is the only ingress. Three properties are set in `docker/fnn-entrypoint.sh` rather than in a config file. `announce_listening_addr` is false, because an announced observer adds a phantom node to the graph it is measuring, and mainnet's upstream config ships it as true. `auto_accept_channel_ckb_funding_amount` is 0, because the `fnn` default is on at 99 CKB and upstream leaves the key out, so absence means enabled. The wallet key is random and holds nothing, and a key with nothing in it cannot spend whatever the flags say. `FNN_VERSION` is pinned and follows what the network runs.


API, enrichment, UI (July 31 - August 1)

The API is read-only, built on `node:http` with no dependencies. Every route names its network and every response carries the network back. It opens the SQLite files with SQLite's read-only flag, so the serving process cannot corrupt the archive it shares with the scanner. `/v0` carries a `reading_the_data` block covering time, attribution and units. `/health` reports scan cursors and peer count per network.

Two enrichment passes run alongside. Block time fetches header timestamps for the blocks that are referenced, serves a block whose header has not arrived yet as `null`, and reports how many are outstanding in `summary.time_coverage`. Geo looks up only the IP addresses that nodes broadcast about themselves, never sends private or loopback ranges anywhere, caches results per IP, and exits 0 having done nothing when no token is set. The token is a Cloudflare Custom Token scoped to Account and Radar Read.

`web/` is three files over the public API. It is hash-routed with the network in the URL, has no framework, build step or dependencies, and is served by the same process on the same origin. `FIBER_ATLAS_WEB_DIR=""` serves the API on its own. The design brief is `specs/SPEC-FRONTEND.md`.


What the scan found

Mainnet, whole history, first close 2025-02-28, latest event block 20,016,810: 249 channels ever seen, 37 still open, 206 cooperative closes at 97.2%, 6 force-closes at 2.8%, and zero penalties. Every close on mainnet in seventeen months has been either cooperative or a plain force-close. The six force-closes cluster: three fall in the very first era, which held only four closes, and three more in 18M.

Testnet holds 44,158 channels, of which 39,126 have closed, with 16,483 force-closes and 3,595 penalties. That is a lifetime force-close rate of 42.1%, which describes the network during one past period rather than the network today. Close blocks carry header timestamps, so the eras are dated from the chain:

```text
era   closes    force-close   penalties   dated from headers
14M       83         16.9%            0   2024-08-26 -> 2024-10-23
15M      271          8.1%            0   2024-10-28 -> 2025-01-24
16M      679          6.5%            0   2025-02-03 -> 2025-04-27
17M      703         14.9%            1   2025-04-27 -> 2025-07-28
18M   11,372         33.0%        2,825   2025-07-29 -> 2025-10-30
19M   19,539         63.9%          769   2025-10-31 -> 2026-02-02
20M    4,797          0.5%            0   2026-02-02 -> 2026-05-06
21M    1,658          2.1%            0   2026-05-06 -> 2026-07-31
```

13M sits below the 30-close floor, so its rate is withheld. Most of the failures fall between 2025-07 and 2026-02, and the rate drops roughly a hundredfold after that. Penalties follow the same curve.

Freeze duration comes from chain headers. Testnet settlement after a force-close: n=50,610, median 4.0h, p75 18.2h, p95 95.8h, max 470h. Testnet penalty sweeps: n=3,595, median 2.6h, p95 16.3h. Mainnet settlement: n=8, median 4.0h, max 24.4h. A long settlement usually means a contract delay period running out. Cells the scan has never seen spent are counted separately, at 4,982 on testnet with the oldest from 2024-10-12, and 2 on mainnet.

Most channels are invisible to gossip. `is_public()` returns false when `public_channel_info` is unset, and those channels are never announced and never carry a `ChannelUpdate`. Comparing open funding cells against live announced channels gives 19 of 37 on mainnet, or 51.4%, and 722 of 5,032 on testnet, or 14.4%. The two numbers cover different sets, so the API serves the ratio with its own warning: it says something about coverage rather than about what share of Fiber channels are public.

Node attribution is thin by design of the protocol. 252 of 93,331 testnet events name a node pair, which is 0.27%, and 0 of 220 mainnet events do. A private channel's events can only ever be attributed to the channel, and waiting longer does not change that. `/faultline/nodes/{pubkey}` returns `observed: false` with null counts, so an unobserved node reads as unobserved.


Rules enforced in the response shape

A client author can skip documentation, so the specs' rules are enforced by what the API emits. The capacity field is named `capacity_shannons`, and channel payloads carry an explicit `capacity_is_not_balance` note under A+04. Every event carries `attribution` as one of `node_pair`, `channel` or `unattributed`, and unattributed events are served with that label under F-02 and F+04. Per-node routes require a window and return exposure-normalised rates beside the counts, and a rate over fewer than 30 samples is withheld with a stated reason under F+05. Reliability is served per window only. Every published figure names its network, since testnet's 42.1% and mainnet's 2.8% are an order of magnitude apart.

The UI keeps the same distinctions. A square marks the chain: complete, verifiable, and about the past. A circle marks node chatter: self-reported, heard by one listener, and about now. The lifetime rate is drawn struck through beside its numerator and denominator and links to the per-era view, so a reader can see it without dividing the two counts and quoting the result on their own. A withheld rate is drawn as a hatched placeholder carrying the raw count.


Prior art

CKB Explorer has a Fiber section at `explorer.nervos.org/fiber/graph`, built by Magickbase, with node lists, channel lists, capacity and fee-rate statistics and a node world map. It covers roughly the same ground as the Atlas half, and it is named in the README so that anyone evaluating this project finds it there.

Faultline covers ground that is open. Close classification, force-close, penalty, freeze duration and reliability are missing from the CKB Explorer Fiber routes and from Magickbase's standalone `fiber-explorer`. mempool.space has classified Lightning closes as mutual, force and force-with-penalty for years, so the idea is well established elsewhere, and what this adds is filling the gap on Fiber.

Checked again on 2026-08-01, `mainnet-api.explorer.nervos.org/api/v2/fiber/graph_nodes` returns `{"fiber_graph_nodes":[],"meta":{"total":0}}`. Their mainnet instance reports 0 nodes and 0 channels, and their testnet 12 channels, against the 249 mainnet channels this project found on L1. The URL sits in the README beside that claim, so anyone can recheck it if the indexer is repaired.

Their channel page also shows `Balance (Local/Remote)` and `TLC Balance (Offered/Received)`. Fiber only reports those for channels the querying node is part of.


Deployed (August 1)

Live at fiber-atlas.drreamer.digital, serving both networks read-only, with no wallet and nothing to sign. I sent the repo and the URL to Neon for review.


Where it goes next

Atlas is a read-only observatory. A person reading the pages can see who force-closed and how long money stayed locked, a wallet picking a peer automatically has nothing to act on, and a node's record costs it nothing either way.

Node reliability bonds attach money to the record. A node locks CKB in a cell whose rule slashes it when someone gives on-chain proof of a force-close or a penalty involving that node. The person who submitted the proof takes a bounty, and the rest is burned or goes to a treasury. Wallets can then suggest peers filtered to bonded nodes with clean records. Verified status would mean meeting a published spec: bond posted, clean record over N closes, name announced.

A decentralised watchtower pool pays for monitoring. Users pay into a shared pool when they open a channel, watchtowers lock bonds, and whoever submits a valid penalty transaction claims from the pool. A watchtower that stays idle while another one acts can be slashed. The pool cell holds only rules about which on-chain events trigger payouts and slashes, with no admin key. Faultline already indexes the event data a script like that would need.

Both are instances of the structural authorization pattern. I pitched them to Neon on August 1 and said I have not confirmed feasibility in practice.

The open question on the bond is the binding. Atlas's 0.27% attribution figure covers the whole history of the network, most of which is private channels, and a bonded node announces itself by definition, so the group that matters is the bonded set. What I still need to work out is how the script knows that the force-close it is shown belongs to the node whose capacity it is taking. A type script can read cells and the transaction it runs in, so the link between a channel and a bonded node has to be written on chain when the bond is posted. A penalty submission carries its own claimant, so the watchtower pool avoids that question and is the easier of the two to specify.


Status

Fiber Atlas is deployed and working on both networks. That covers the L1 scanner and classifier with full history backfilled, the gossip ingest, the join between them, block-time and geo enrichment, the read-only API, and the web UI. It is waiting on Neon's review and on wider community feedback. The license is still to be decided before a first release.


What's next

- Bond binding: how a channel commits to a bonded node on chain
- Watchtower pool spec, as the easier of the two to write
- A+01 proper: assert ingested counts against the source node's own graph RPC
- Cycle profiling of the firewall's registry-format crate with large registries
- Firewall testnet drills for stale deps and key rotation, with written runbooks
- Independent external audit of the firewall's on-chain scripts
- Governance coordination over a shared signed-artifact git repo
- The Nervos Talk thread I owe Neon, now three weeks running


Refs / Sources

- Fiber Atlas repo - https://github.com/digitaldrreamer/fiber-atlas
- Fiber Atlas, live - https://fiber-atlas.drreamer.digital/#/mainnet/overview
- Mainnet summary - https://fiber-atlas.drreamer.digital/v0/mainnet/summary
- Testnet eras - https://fiber-atlas.drreamer.digital/v0/testnet/eras
- CKB Agent Control Hub - https://github.com/digitaldrreamer/ckb-agent-control-hub
- veiled-ckb - https://github.com/digitaldrreamer/veiled-ckb
- Structural Authorization repo - https://github.com/digitaldrreamer/ckb-structural-authorization
- Fiber - https://github.com/nervosnetwork/fiber
- Fiber public nodes (v0.8.1) - https://github.com/nervosnetwork/fiber/blob/v0.8.1/docs/public-nodes.md
- PeerId to Pubkey rename (PR #1154) - https://github.com/nervosnetwork/fiber/pull/1154
- CKB Explorer Fiber graph - https://explorer.nervos.org/fiber/graph
