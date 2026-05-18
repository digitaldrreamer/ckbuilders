# Week 10

The week had a clear backlog coming in: deploy the contracts to testnet, publish the SDK, and get the repo into a state where an external developer could use it. That happened between May 13 and May 15. A CLI also shipped — it wasn't in the original plan.

## Go/no-go

Five release gates. By the morning of May 14 they were all green: binary reproducibility verified, governance drill evidence committed, SDK type checks passing, testnet soak done, CI clean. Decision record committed: GO (2026-05-14, digitaldrreamer).

## Testnet deployment

Both contracts went out in a single transaction — `firewall-lock` at index 0, `blacklist-registry` at index 1:

```text
tx:    0x11b0397cd58dce5c2bd704108ee6e1609128c0d828a3f3360237585e82bb7aed
block: 0x141be3d
```

TYPE_IDs and `registryScript` are unchanged from the previous deployment. `testnet.registry.example.json` was renamed to `testnet.registry.json`. The deployment used the `scripts/phase4_prepare_tx_files.sh` flow from earlier weeks; committed-wait logic and indexer-lag handling worked without issues.

## npm publish

Published `@ckb-firewall/sdk@0.2.0`. The ESM build, exports map, and type declarations from week 9 made this straightforward. `@arethetypeswrong/cli` was already in CI and the profile passed clean.

The public-facing README was rewritten before publishing. The old one assumed familiarity with project internals. The new one leads with `npm install`, shows real testnet registry values in the quick start, and links to the architecture and governance docs. Internal phase3/phase4 artifacts moved to `docs/internal/` and added to `.gitignore`.

## @ckb-firewall/cli

After publishing the SDK, the next useful thing was a way to inspect the live registry, propose changes, and step through the governance flow without writing raw JSON. Built as a standalone npm package with commander, chalk, and inquirer. Eight commands:

- `inspect` — reads the live testnet registry and prints entries
- `add` and `remove` — quick path used during development to add test addresses
- `propose` — creates a proposal file under `~/.ckb-firewall/proposals/`
- `vote` — records validator votes with duplicate prevention
- `proposals` — table view with status, tally, and review countdown
- `sign` — produces secp256k1 signatures for the governance tx
- `execute` — builds and submits the governance transaction via ckb-cli

The `sign` command needed care. CKB's secp256k1 convention expects a 65-byte signature in `[r|s|recovery_bit]` layout. `@noble/curves` v2 produces this with `format: 'recovered'`.

Review flagged a shell injection risk in `add`, `remove`, and `execute` before the PR merged — the commands were building strings with `execSync`. Replaced with `execFileSync` and explicit argument arrays.

Published `@ckb-firewall/cli@0.1.0` the same day the PR merged.

## Documentation site

May 15 was the docs site. The repo's `docs/` folder was previously an internal markdown dump. Moved everything to `notes/`, then built an Astro Starlight site in its place.

Four sections: Getting Started, Concepts, Reference, Operations. The Concepts section covers the threat model and why the lock script design works the way it does.

The link checker caught an issue: relative `.md` links in Starlight content produce verbatim `href` values in the built HTML, so they 404 at runtime even when the source file exists. Fixed by rewriting to route paths like `/concepts/.../` and updating `check_markdown_links.py` to validate against the content directory structure.

Ended on `@ckb-firewall/sdk@0.2.5` and `@ckb-firewall/cli@0.1.2` after patch bumps for logo and link additions.

## Security review

After the week's work was done I sent the repo to [RobairEth](https://github.com/RobairEth) — whose project Nerve placed second in the Claw & Order hackathon — and asked him to look it over. He came back with findings on May 16.

`verify_governance_multisig` only checks signer index uniqueness and that the 65-byte signature field is non-zero. It never verifies a signature against a public key. Three distinct signer indices and any non-zero bytes will pass the function. No cryptographic check happens.

The governance lock has the same gap. It checks for a fixed marker string in args but doesn't validate keys, signatures, or multisig state. Anyone who can construct a valid transaction can satisfy it. RobairEth's read: the community governance framing is not yet right.

On the CLI side, the RPC client has no timeout. His node hung during testing and he had to close the terminal. He flagged that `res.ok` needs a check, and suggested tests for RPC failure and success paths.

He also caught a logic comparison disparity between the TypeScript and Rust implementations. Rust uses strict less-than on the ordering check, so equal adjacent identifiers fail. TypeScript uses less-than-or-equal, so duplicates pass. A payload the SDK accepts can be rejected on-chain.

After reading his notes I did my own pass through the code. A few more issues came up: the registry cell can be bootstrapped with arbitrary data because structural signer checking is the only gate on creation; the CLI execute path serializes whatever signatures are in the local proposal file without checking them against a known signer set; the placeholder governance guard on `add` and `remove` is not enforced by default; the `--signer-index` parser can produce NaN which the range check doesn't catch.

None of these are fixed yet. I'm working through them before filing a formal review issue for the team.

## What's next

- Work through the open security issues before team review
- On-chain signer verification in the registry contract
- Registry cell instance uniqueness via Type ID
- CLI proposal verification and local trust model
- RPC client timeout and `res.ok` handling
- TypeScript/Rust ordering parity fix
- Remove `add` and `remove` from the CLI before submission — they were only used during development to add test addresses and don't belong in a published package
- Add a small `examples/` folder with scripts showing real SDK usage before submission
- Beginner app still outstanding — token minter or something using Spore

## Refs / Sources

- [CKB Transaction Firewall](https://github.com/digitaldrreamer/ckb-transaction-firewall)
- [PR #11 — release readiness](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/11)
- [PR #12 — public release prep](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/12)
- [PR #14 — @ckb-firewall/cli](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/14)
- [PR #17 — Starlight docs site](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/17)
- [@ckb-firewall/sdk on npm](https://www.npmjs.com/package/@ckb-firewall/sdk)
- [@ckb-firewall/cli on npm](https://www.npmjs.com/package/@ckb-firewall/cli)
- [CKB Firewall Docs Site](https://ckb-firewall.drreamer.digital/)
