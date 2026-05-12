# Week 9 — Phase 4 closure on `main`

This week’s work on [CKB Transaction Firewall](https://github.com/digitaldrreamer/ckb-transaction-firewall) continued on `main` after the week eight devlog snapshot. The theme is **Phase 4 program closure**: turning “we ran the drill once” into **repeatable gates** (CI, scripts, artifacts, and documentation) so another machine, another month, or another reviewer can see the same evidence you saw.

Concretely, that meant merging and following through on [PR #7](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/7) through [PR #10](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/10) in **`digitaldrreamer/ckb-transaction-firewall`** (not this devlog repo), plus a small tail of direct commits on `main` there. The bundle includes: governance evidence enforcement, pinned tooling for reproducibility, deeper **firewall lock** VM integration coverage, hardening of **Phase 4 shell** scripts that touch testnet and wallets, a coordinated **0.2.0** version bump across crates and SDKs, **TypeScript SDK** packaging aligned with how npm consumers expect ESM to look, and a **documentation** re-layout so landing pages, internal milestones, and deployment runbooks point at each other instead of drifting.

---

## Phase 4 closure and governance evidence — [ckb-transaction-firewall#7](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/7)

Phase 4 here is not a marketing label. It is the point where **governance drill output is treated as a release artifact**: scripts assert that scenario transactions reached a **chain-visible terminal state**, and CI can fail if the story in the repo does not match what a node would say.

- **`REAL_GOV_EVIDENCE_REQUIRED=1`** is wired into `scripts/phase3_closeout_check.sh` so pushes to `main` (and PRs targeting it) do not “pass closeout” on local optimism alone. The closeout step expects the Phase 4 evidence path to be satisfied when that flag is on, which is how you stop “green CI, fake chain” from creeping in.

- **`scripts/ci/install_ckb_cli.sh`** installs a **pinned** `ckb-cli` version and is invoked from `.github/workflows/tests.yml`. Pinning matters because governance scripts are sensitive to RPC flags, output shapes, and wallet behaviour across `ckb-cli` minor versions. CI that silently floats on “latest” is CI you cannot debug six months later.

- **`scripts/phase4_governance_tx_status.sh`** now treats **`committed`** and **`rejected`** as the only acceptable terminal states for drill scenarios when gates are strict, and it **polls** until it gets one of those or times out. That closes a common foot-gun: treating “submitted” or “pending” as success because the RPC returned something non-empty.

- **Artifacts** were refreshed so `tests/integration/governance_drill/chain_status_latest.json` matches testnet-backed runs that the scripts validate. The point of committing that file is not nostalgia. It is so reviewers can diff “what changed in chain evidence” the same way they diff code.

- **Documentation and decision records** landed as a set: Phase 4 ADR, go / no-go decision record, live governance drill runbook, security findings tracker, verification requirements matrix, verification status rollup, milestone notes under the Phase 4 artifact tree, and a **Phase 3 status snapshot** carried forward so the audit trail does not jump a discontinuity.

- **`contracts/blacklist-registry/CYCLE_REPORT.md`** documents registry-side cycle posture and links outward to the verification matrix expectations. That gives registry governance the same “we measured it” posture the firewall lock already had in `CYCLE_REPORT.md`.

---

## Firewall lock: integration depth

The firewall lock is easy to unit-test in isolation and still wrong in the VM. This week pushed the opposite direction: more **`ckb-testtool`** coverage against the **compiled** lock binary, including paths that depend on **median time** and **`header_deps`**, which are exactly the places people hand-wave in early prototypes.

Coverage additions (high level):

- **Median time and `header_deps`:** Temporary blacklist rows depend on median timestamp over the header dependency set. Tests now exercise odd and even header counts, permutations, boundaries, and degenerate cases (for example, no headers or single header behaviour) so the implementation is not “correct on the happy median only.”

- **Inner lock spawn:** Delegation to an inner lock is a real syscall path. Tests cover failure modes that map to the public error surface, including **missing inner cell dep** (error **13**) and a deliberately failing inner lock fixture (error **15**) using an **`always_failure`-style** binary with documented provenance in `tests/unit/fixtures/README.md`.

- **Stress and scale:** A **256-entry** registry happy path test pushes the “does the lock still behave with a large dep payload” question into CI instead of production.

- **Harness plumbing:** `build_tx_with_firewall_lock` now accepts header dependency hashes, and helpers insert synthetic headers into the test context so the harness matches how real transactions attach `header_deps`.

- **`contracts/firewall-lock/GAPS_ANALYSIS.md`** was updated so the registry portion reflects **`contracts/blacklist-registry`** as shipped work, not a future milestone. That is a small doc change with a large honesty payoff when someone new reads the repo cold.

---

## Phase 4 shell tooling: `phase4_prepare_tx_files.sh`

A large fraction of “Phase 4 feels hard” is not the contracts. It is **coin selection, wallets, prompts, and indexer reality** when you try to run the same flows the docs describe.

`scripts/phase4_prepare_tx_files.sh` picked up fixes that are boring in a diff and expensive in real time:

- **Wallet top-up** paths that do not treat lock args as wallet account identifiers, and behaviour that waits until a top-up is **committed** before chaining another send (avoids mempool conflicts such as `PoolRejectedRBF` on back-to-back transfers).

- **Output parsing** when `ckb-cli` mixes interactive prompts with JSON on stdout, including patterns that use `PIPESTATUS`, `/dev/tty`, and optional debug flags so automation does not silently swallow failures.

- **Cell discovery:** `get_cells` paging and capacity filters so the script does not miss a large new cell behind a small first page of results; merging outputs from **`get_transaction`** when **`get_cells`** lags behind what the node already knows about.

If you have ever watched a script “find zero cells” while your wallet balance is non-zero, this is the category of fixes that makes you less superstitious about testnet.

---

## CI, release, and follow-up — [ckb-transaction-firewall#8](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/8), [ckb-transaction-firewall#9](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/9)

[**PR #8**](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/8) is mostly “make CI behave like a machine you would trust”:

- `install_ckb_cli.sh` is **executable in git** and invoked with **`bash`** in the workflow so non-interactive runners do not depend on file mode quirks.

- **`curl`** retries and connect timeouts reduce flake on GitHub’s egress to GitHub Releases.

- **`deploy/`** is ignored so local deployment outputs (tx JSON, `info.json`, backups) do not get committed by accident.

- **`u8::try_from`** in test helpers removes a class of “it truncates on huge test data someday” footguns.

[**PR #9**](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/9) widens the same story into release hygiene:

- GitHub Actions upgraded to **`actions/checkout` / `setup-node` / `upload-artifact` v5**, Node **22** for SDK steps, and **`permissions: contents: read`** so the workflow principle of least privilege is explicit rather than accidental.

- **`CURL_MAX_TIME_SECONDS`** and **`CURL_RETRY_DELAY_SECONDS`** document and implement a total download budget, with README text that matches real **`curl --max-time`** semantics (entire operation including retries, not “per attempt”).

- More **`try_from`** coverage in tests continues the “no silent narrowing casts” theme.

- **`0.2.0`** was bumped consistently across on-chain crates, Rust SDK, TypeScript `package.json`, and the `tests/unit` harness so version strings, lockfiles, and human expectations line up.

---

## Documentation and TypeScript SDK — [ckb-transaction-firewall#10](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/10) and post-merge `main`

Documentation work this week was not cosmetic. It was about **navigation** and **role clarity**: who the project is for, what the SDK does and does not promise, and where internal planning artifacts live.

- **README** is now a real landing page: what the project is, why CKB, how the pieces connect, prerequisites, quick start, security framing, doc map, and CI or license badges where appropriate.

- **`ABOUT.md`** is back as the long narrative home for threat model, architecture story, governance, and security posture without forcing the README to carry a novella above the fold.

- **`docs/architecture.md`** gained explicit “**Why CKB fits this design**” material so the chain rationale is not trapped in marketing tone in README bullets.

- **Internal layout:** `PHASE3_PLAN.md`, `phase3_artifacts/`, and `phase4_artifacts/` moved under **`docs/internal/`** with an index README. That keeps the repo root readable while preserving milestone markdown for audits.

- **`research/README.md`** explains what belongs in `research/` so it does not become a junk drawer.

- **Typography:** Unicode em dashes were replaced with ASCII-friendly punctuation across long docs so diffs and tooling behave consistently.

- **Scope clarification:** README and ABOUT now spell out that the SDK and firewall lock apply to **any** CKB transaction construction path, not a single product category, and that blacklist enforcement is about **outputs** the transaction creates, not an automatic “who sent this” filter unless you build that separately.

- **Testnet operations:** `docs/deployments/testnet.md` documents the TypeScript path on public testnet, including **`ckb-cli` 2.x** RPC flag notes where **`--hash`** vs **`--tx-hash`** matters for scripts and `jq` pipelines.

- **TypeScript SDK publish shape:** `sdk/typescript` now has an ESM **`dist/`** build, `package.json` **`exports` / `types` / `files`**, stricter compiler options, typed errors (`FirewallSdkError`), a discriminated **`FirewallDecision`** union, and CI checks that the built tarball contains expected entrypoints plus **`@arethetypeswrong/cli`** in an ESM-only profile so npm consumers get fewer surprises.

---

## Bots and review noise

Automated review is useful when it catches things humans skim.

- **CodeRabbit** raised concrete issues: duplicate `CHANGELOG` date headings, inconsistent wording in `contracts/blacklist-registry/CYCLE_REPORT.md` between “production build” language and example commands, broken relative links in runbooks and artifact markdown, and the security-adjacent point that **`ckb-cli` archives are downloaded without an integrity check** beyond TLS. Some items were addressed via an autofix commit on the branch.

- **Gemini Code Assist** mostly validated direction and surfaced smaller correctness items: clarifying **`curl --max-time`** scope, and adding **`await`** in an example where async IO is implied.

These are not substitutes for running `./scripts/phase3_closeout_check.sh` with the same environment flags CI uses, but they shorten the loop when something is inconsistent on paper.

---

## Optional follow-up

- **Binary integrity for `install_ckb_cli.sh`:** add a pinned checksum or signature verification step before extracting the release archive. Transport retries reduce flake; integrity checks reduce trust-on-first-use.

---

## Repository status (end of week)

By the end of this week **`ckb-transaction-firewall`** reads like a project that is **close to production-ready** on implementation, documentation, and CI discipline. The remaining work is mostly **release operations**, not feature invention.

- **CKB (on-chain):** deploy lock and registry artifacts and operational cells for the **chosen target network** (staging or mainnet), and run the governance path there with the same rigor already proven on testnet. Testnet drill evidence in-repo proves the flow can work; production deployment is still a distinct step with different keys, fees, and operational risk.

- **npm:** publish **`sdk/typescript`** to the npm registry. The package layout, types, exports, and CI checks are aligned with what consumers expect; the missing piece is the actual **`npm publish`** (scope, OTP, provenance, and registry policy are outside the repo text but part of the real checklist).

If you want a single sentence summary: **the code and gates are in good shape; what is left is shipping bytes to the right chain and shipping the SDK to the right registry.**

---

## References

Links below are all under **`digitaldrreamer/ckb-transaction-firewall`** (the firewall repo).

- [Repository root](https://github.com/digitaldrreamer/ckb-transaction-firewall)
- [Pull request #7](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/7)
- [Pull request #8](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/8)
- [Pull request #9](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/9)
- [Pull request #10](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/10)
- [CKB script docs](https://docs.nervos.org/docs/script) (Nervos documentation)
