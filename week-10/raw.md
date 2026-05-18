Week 10 was supposed to be xUDT and SSRI theory. I spent it shipping.

The week coming out of week 9 had a clear backlog: deploy the contracts to testnet, publish the SDK to npm, and get the repo into a state where an external developer could actually use it. I knocked all three out between May 13 and May 15, plus shipped a CLI that wasn't on the original plan at all.

The first thing to deal with was the go/no-go decision. I'd been tracking five gates across the release checklist. By the morning of May 14 they were all green: binary reproducibility verified, governance drill evidence committed, SDK type checks passing, testnet soak done, CI clean. Wrote the decision record explicitly -- GO (2026-05-14, digitaldrreamer) -- and moved into deployment.


Testnet deployment

Both contracts went out in a single transaction. `firewall-lock` at index 0, `blacklist-registry` at index 1:

```
tx: 0x11b0397cd58dce5c2bd704108ee6e1609128c0d828a3f3360237585e82bb7aed
block: 0x141be3d
```

The TYPE_IDs and `registryScript` stayed the same. That's the point of stable identity -- you can upgrade the cell without changing the on-chain identifier every tool and SDK has already hardcoded. `testnet.registry.example.json` got renamed to `testnet.registry.json` because it wasn't an example anymore.

The deployment itself was handled by the `scripts/phase4_prepare_tx_files.sh` flow that was hardened in previous weeks. No surprises there. The work that had gone into that script -- the committed-wait logic, the paging fixes, the indexer-lag handling -- paid off. The transaction went through cleanly.


npm publish

Published `@ckb-firewall/sdk` at 0.2.0. The ESM build, exports map, and type declarations that went in during week 9 made this straightforward. `@arethetypeswrong/cli` had been wired into CI to catch ESM consumer issues, and the profile passed clean.

I didn't stop at the SDK. I also rewrote the public-facing READMEs before publishing. The old README was written for someone already inside the project who knew what phase3 meant and what a governance drill was. The new one leads with npm install, shows real testnet registry values in the quick start, and links out to architecture and governance docs for depth. Internal phase3/phase4 artifacts got moved to `docs/internal/` and gitignored -- they served their purpose during development but they're noise to an external reader.


@ckb-firewall/cli

The CLI wasn't in the original plan for this week. It came out of realizing that after you publish the SDK, the next thing a developer needs isn't more documentation -- it's a way to inspect what's actually in the registry, propose changes, and move through the governance flow without writing raw JSON.

Built it as a standalone npm package using commander, chalk, and inquirer. Eight commands:

- `inspect` reads the live testnet registry and prints entries
- `add` and `remove` are the quick path for testnet and dev use
- `propose` creates a proposal file under `~/.ckb-firewall/proposals/`
- `vote` records validator votes with duplicate prevention
- `proposals` gives a table view with status, tally, and a review countdown
- `sign` produces the secp256k1 signatures the governance tx needs
- `execute` builds and submits the governance transaction via ckb-cli

The `sign` command was the part I had to think hardest about. CKB's secp256k1 convention expects a 65-byte signature in `[r|s|recovery_bit]` layout. Most JavaScript libraries return `[r|s]` by default and make you opt into the recovery bit. `@noble/curves` v2 does it with `format: 'recovered'`. Had to dig into the library docs to find the right call shape.

Before the CLI PR merged, review flagged a shell injection risk in the `add`, `remove`, and `execute` commands. I'd been building command strings as template literals and passing them to `execSync`. That works fine until someone passes a string with spaces or special characters in a flag value. Replaced those calls with `execFileSync` and explicit argument arrays -- no shell involved, no injection surface.

Published `@ckb-firewall/cli@0.1.0` the same day the PR merged.


Documentation site

May 15 was the docs site. Switched the repo's `docs/` folder from its previous use as an internal markdown dump to a proper Astro Starlight site. Had to move everything that was in `docs/` before to `notes/` first so they didn't collide.

The site has four sections: Getting Started, Concepts, Reference, and Operations. The Concepts section has the "Why this exists" material -- threat model, why CKB fits the design, how the lock script relates to the SDK. That context belongs in a public site, not buried in an `ABOUT.md` that nobody opens.

The link checker caught a class of problem I wasn't thinking about: relative `.md` file links in Starlight content generate verbatim `href` values in the built HTML, so they 404 at runtime even when the file exists. Fixed those by rewriting to `/concepts/.../` route paths and updating `check_markdown_links.py` to validate against the actual content directory structure.

Ended the week with `@ckb-firewall/sdk@0.2.5` and `@ckb-firewall/cli@0.1.2` on npm after a few rapid patch bumps for logo and link additions.


Security review

After all of that was done I sent the repo link to RobairEth -- whose project Nerve placed second in the Claw & Order hackathon -- and asked him to look it over. He came back about an hour later with a few things.

The main one was `verify_governance_multisig`. He pointed out that the function only checks signer index uniqueness and that the 65-byte signature field is non-zero. It never actually verifies a signature against a public key. So you can construct three distinct signer indices and any non-zero bytes, and the function passes. No cryptographic check happens. The governance is structural framing, not actual authorization.

The governance lock has the same problem from a different angle. It checks for a fixed marker string in args but does nothing with keys, signatures, or multisig state. Anyone who can construct a valid transaction can authorize themselves. Robaire's framing was direct: the community governance as written is not yet right.

On the CLI side he got stuck when actually running it. The RPC client has no timeout -- his node just hung and he had to close the terminal. He flagged that `res.ok` needed a check to prevent captive hangs, and suggested writing tests for RPC failure and success paths so the next reviewer has something to run.

He also spotted that the TypeScript and Rust implementations have a logic comparison disparity in the blacklist ordering check. Rust uses strict less-than so equal adjacent identifiers fail. TypeScript uses less-than-or-equal so duplicates pass. A payload the TypeScript SDK accepts can be rejected by the on-chain contract.

After I read through those I did my own diagnostic pass and found a few more things: the registry cell can be bootstrapped with arbitrary data because the structural signer check is the only gate on creation, the CLI execute path serializes whatever signatures are in the local proposal file without verifying them against a known signer set, the placeholder governance guard is not enforced by default on `add` and `remove`, and the `--signer-index` parser can produce NaN which the range check doesn't catch.

None of this is fixed yet. These are open. I'm working through them before the project goes up as a formal review issue for the team. The critical path is on-chain signer verification in the registry contract, registry cell instance uniqueness so the firewall can't be pointed at a fabricated alternate registry, and replacing the local-file trust model in the CLI before any of this goes near mainnet.

Shipping fast and getting a second set of eyes immediately is exactly how you want to find this kind of thing. The machinery was checking the wrong properties -- shape instead of cryptographic correctness, presence instead of authorization. Good time to find out.


Curriculum

xUDT and SSRI -- the actual week 10 curriculum topics -- didn't happen. Neither did RGB++ and iCKB, which are week 11. I'm a couple of weeks behind on the reading track but ahead on the build track in a way that I think is a reasonable trade.

The scheduler would say I should be reading xUDT RFCs right now. The practical situation is: I just shipped a deployed contract, two npm packages, a governance CLI, and a documentation site in three days, then immediately went back into the codebase because a security review found real problems. The curriculum will keep.


What's next

- Work through the open security issues before putting the project up for team review
- On-chain signer verification in the registry contract
- Registry cell instance uniqueness via Type ID
- CLI proposal verification and local trust model
- RPC client timeout and res.ok handling
- TypeScript/Rust ordering parity fix
- Remove `add` and `remove` from the CLI before submission -- they were only ever used during development to add test addresses for local testing and don't belong in a published package
- Add a small `examples/` folder with scripts showing real SDK usage before submission
- xUDT introduction and RFC reading (delayed from this week)
- SSRI introduction -- motivation and architecture
- Beginner app is still outstanding -- token minter or something using Spore


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
