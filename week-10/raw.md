Week 10 was supposed to be xUDT and SSRI theory. I spent it shipping.

The week coming out of week 9 had a clear backlog: deploy the contracts to testnet, publish the SDK to npm, and get the repo into a state where an external developer could actually use it. I knocked all three out between May 13 and May 15, plus shipped a CLI that wasn't on the original plan at all.

The first thing to deal with was the go/no-go decision. I'd been tracking five gates across the release checklist. By the morning of May 14 they were all green: binary reproducibility verified, governance drill evidence committed, SDK type checks passing, testnet soak done, CI clean. Wrote the decision record explicitly — GO (2026-05-14, digitaldrreamer) — and moved into deployment.


Testnet deployment

Both contracts went out in a single transaction. `firewall-lock` at index 0, `blacklist-registry` at index 1:

```
tx: 0x11b0397cd58dce5c2bd704108ee6e1609128c0d828a3f3360237585e82bb7aed
block: 0x141be3d
```

The TYPE_IDs and `registryScript` stayed the same. That's the point of stable identity — you can upgrade the cell without changing the on-chain identifier every tool and SDK has already hardcoded. `testnet.registry.example.json` got renamed to `testnet.registry.json` because it wasn't an example anymore.

The deployment itself was handled by the `scripts/phase4_prepare_tx_files.sh` flow that was hardened in previous weeks. No surprises there. The work that had gone into that script — the committed-wait logic, the paging fixes, the indexer-lag handling — paid off. The transaction went through cleanly.


npm publish

Published `@ckb-firewall/sdk` at 0.2.0. The ESM build, exports map, and type declarations that went in during week 9 made this straightforward. `@arethetypeswrong/cli` had been wired into CI to catch ESM consumer issues, and the profile passed clean.

I didn't stop at the SDK. I also rewrote the public-facing READMEs before publishing. The old README was written for someone already inside the project who knew what phase3 meant and what a governance drill was. The new one leads with npm install, shows real testnet registry values in the quick start, and links out to architecture and governance docs for depth. Internal phase3/phase4 artifacts got moved to `docs/internal/` and gitignored — they served their purpose during development but they're noise to an external reader.


@ckb-firewall/cli

The CLI wasn't in the original plan for this week. It came out of realizing that after you publish the SDK, the next thing a developer needs isn't more documentation — it's a way to inspect what's actually in the registry, propose changes, and move through the governance flow without writing raw JSON.

Built it as a standalone npm package using commander, chalk, and inquirer. Eight commands:

- `inspect` reads the live testnet registry and prints entries
- `add` and `remove` are the quick path for testnet and dev use
- `propose` creates a proposal file under `~/.ckb-firewall/proposals/`
- `vote` records validator votes with duplicate prevention
- `proposals` gives a table view with status, tally, and a review countdown
- `sign` produces the secp256k1 signatures the governance tx needs
- `execute` builds and submits the governance transaction via ckb-cli

The `sign` command was the part I had to think hardest about. CKB's secp256k1 convention expects a 65-byte signature in `[r|s|recovery_bit]` layout. Most JavaScript libraries return `[r|s]` by default and make you opt into the recovery bit. `@noble/curves` v2 does it with `format: 'recovered'`. Had to dig into the library docs to find the right call shape.

Before the CLI PR merged, review flagged a shell injection risk in the `add`, `remove`, and `execute` commands. I'd been building command strings as template literals and passing them to `execSync`. That works fine until someone passes a string with spaces or special characters in a flag value. Replaced those calls with `execFileSync` and explicit argument arrays — no shell involved, no injection surface.

Published `@ckb-firewall/cli@0.1.0` the same day the PR merged.


Documentation site

May 15 was the docs site. Switched the repo's `docs/` folder from its previous use as an internal markdown dump to a proper Astro Starlight site. Had to move everything that was in `docs/` before to `notes/` first so they didn't collide.

The site has four sections: Getting Started, Concepts, Reference, and Operations. The Concepts section has the "Why this exists" material — threat model, why CKB fits the design, how the lock script relates to the SDK. That context belongs in a public site, not buried in an `ABOUT.md` that nobody opens.

The link checker caught a class of problem I wasn't thinking about: relative `.md` file links in Starlight content generate verbatim `href` values in the built HTML, so they 404 at runtime even when the file exists. Fixed those by rewriting to `/concepts/.../` route paths and updating `check_markdown_links.py` to validate against the actual content directory structure.

Ended the week with `@ckb-firewall/sdk@0.2.5` and `@ckb-firewall/cli@0.1.2` on npm after a few rapid patch bumps for logo and link additions.


Security review

After the week's shipping was done I asked RobairEth — whose project Nerve placed second in the Claw & Order hackathon — to look over the work. That review hit harder than I expected.

The headline finding was that the governance authorization in `blacklist-registry` is structural, not cryptographic. The contract parses the GOV1 witness, checks signer index range and uniqueness, validates signature field shape, and confirms bytes are non-zero. It never verifies any signature against a signer public key. A witness with distinct signer indexes and correctly shaped 65-byte blobs can satisfy the contract without any real authorization. I'd built and tested the shape of the envelope without checking whether the letters inside were signed.

Related: the `governance-lock` contract only checks for a fixed marker string in args. It does not validate multisig, proposal state, or signer ownership. Any transaction that can satisfy the expected args string can unlock it. As written it is a marker, not an authorization primitive.

The third critical issue was registry cell cloning. The type script allows bootstrap creation with zero registry inputs and one registry output. Because signer validation is only structural, nothing prevents a new cell from being created with the same type identity and arbitrary registry data. The firewall lock accepts any cell dep whose type script matches the configured registry identity, so if the registry identity is not made unique at the cell-instance level — via Type ID or equivalent binding — an attacker can introduce an alternate registry cell that the firewall will trust. That breaks the core guarantee.

The CLI had its own problem along the same axis. The governance execute path reads votes and signatures from local proposal files and serializes whatever is present without independent verification. Proposal JSON can be fabricated or edited locally. The execute path has no way to know.

Below the critical tier, three more things came out of the review. The RPC client in `sdk/cli/src/lib/rpc.ts` had no abort timeout and didn't check `res.ok` before parsing JSON, so stalled connections would hang the CLI indefinitely and non-JSON error responses would produce unhelpful failures. The TypeScript parser and the Rust firewall lock disagreed on duplicate registry entries — Rust rejects equal adjacent identifiers with strict ordering, TypeScript only rejects strict descent, which means a payload the SDK accepts can be rejected on-chain. And the CLI `add` and `remove` commands were building GOV1 witnesses using `placeholderSigners(3)` by default, with no guard against operators accidentally running placeholder-governance update transactions in a real environment.

Some of these were fixed the same day the review notes landed. The RPC timeout and `res.ok` check went in immediately. The TypeScript parser was corrected to reject duplicates with `RegistryNotSorted`, matching the Rust contract. `add` and `remove` now require `CKB_FIREWALL_ALLOW_PLACEHOLDER_GOVERNANCE=1` before they will build a transaction. The `--signer-index` NaN path was closed with an exact `[0-4]` parser.

The critical issues — on-chain signer verification, governance-lock authorization, registry cell uniqueness, and CLI trust model — are open. I'm working through those now before the project goes up for team review. The plan is to either restore real on-chain signer verification in the registry contract or remove the documentation claim that it enforces governance signatures cryptographically, make the registry cell identity unique at the instance level rather than just by governance lock identity, and replace the local-file governance trust model before anything resembling mainnet use.

This is what happens when you ship fast and get a second set of eyes immediately after. I'd built all the machinery, run it end to end, and the tests passed. What RobairEth caught was that the machinery was checking the wrong things — shape instead of correctness, presence instead of authorization. Good time to find out.


Curriculum

xUDT and SSRI — the actual week 10 curriculum topics — didn't happen. Neither did RGB++ and iCKB, which are week 11. I'm a couple of weeks behind on the reading track but ahead on the build track in a way that I think is a reasonable trade.

The scheduler would say I should be reading xUDT RFCs right now. The practical situation is: I just shipped a deployed contract, two npm packages, a governance CLI, and a documentation site in three days, and then immediately went back into the codebase because a security review found real problems. The curriculum will keep.


What's next

- Work through the open critical security issues before the project review issue goes up
- On-chain signer verification in the registry contract
- Registry cell instance uniqueness via Type ID
- CLI proposal verification and local trust model replacement
- xUDT introduction and RFC reading (delayed from this week)
- SSRI introduction — motivation and architecture
- Beginner app is still outstanding — token minter or something using Spore


Refs / Sources

- CKB Transaction Firewall repo - https://github.com/digitaldrreamer/ckb-transaction-firewall
- PR #11 (release readiness) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/11
- PR #12 (public release prep) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/12
- PR #14 (@ckb-firewall/cli) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/14
- PR #17 (Starlight docs site) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/17
- @ckb-firewall/sdk on npm - https://www.npmjs.com/package/@ckb-firewall/sdk
- @ckb-firewall/cli on npm - https://www.npmjs.com/package/@ckb-firewall/cli
- RobairEth / Nerve (Claw & Order hackathon) - https://github.com/RobairEth
- CKB script docs - https://docs.nervos.org/docs/script
