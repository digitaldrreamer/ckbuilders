Week 8 was supposed to be Script Course classes 7-10 plus sUDT reading/tutorial.
I spent the week on Firewall hardening and Phase 3 closeout work.

The week centers on two PRs:

- PR #5: https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/5
- PR #6: https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/6

I count them as Week 8 output because this week was implementation and verification, not planning.

PR #5 carried most of the workload. The main change was operational discipline. `scripts/phase3_verify.sh` now runs build, production-guard checks, unit/integration tests, cycle probes, and artifact generation in one pass. The cycle budget checks were also formalized for lock-only, type-only, both-checks, 512-entry registry, and 2000-entry registry scenarios.

Closeout checks became explicit with `scripts/phase3_closeout_check.sh`, backed by `scripts/phase3_status_report.sh`, `scripts/phase3_repro_build.sh`, and `scripts/phase3_compat_check.sh`. That gave me a concrete way to answer: do we have evidence, can we reproduce, and are we still compatible with the written spec.

Governance drill flow got a serious cleanup in mode-2:

- bootstrap requires signer indices `0,1,2,3,4`,
- update requires at least three unique signers,
- negative scenarios require declared signer evidence.

The signer-separation output now lands in `tests/integration/governance_drill/mode2_signer_state.json`.

Deploy/live drill tooling grew during the same pass. `scripts/deploy.sh` was hardened for repeat runs, and these helpers were added for live governance execution:

- `scripts/phase4_governance_autorun_live.sh`
- `scripts/phase4_prepare_tx_files.sh`
- `scripts/phase4_submit_tx.sh`
- `scripts/phase4_governance_tx_status.sh`
- `scripts/phase4_governance_evidence_check.sh`

Rust SDK and TypeScript SDK work moved in parallel, with parity checks and test alignment. `contracts/blacklist-registry/src/main.rs` also got governance witness and runtime compatibility updates.

The biggest lesson this week came from friction, not from merged file count.

`ckb-cli` behavior differences kept surfacing at runtime. I had to handle `get_live_cell` compatibility details carefully, use decimal outpoint index format in RPC paths, keep hex formatting where tx JSON expects it, and add guards so governance steps wait until outpoints are genuinely live on chain.

VM constraints also forced deeper fixes in registry paths. Some atomic-heavy assumptions had to be removed, and VM preflight checks were wired into the flow so incompatible binaries fail early.

Review feedback changed behavior in meaningful ways:

- bounds and allocation safety were tightened in registry/SDK paths,
- closeout policy detection for `dev-signer-keys` was corrected using `jq any()` logic,
- mode-2 validation got CI-safe refinements late in PR #5.

PR #6 was the focused post-merge pass. Smaller diff, important reliability wins:

- stronger `dev-signer-keys` detection in closeout checks,
- explicit `jq` prerequisite failure in governance prereq checks,
- stricter secp args validation in governance lock preflight,
- safer CLI argument handling in tx-status tooling,
- retention logic fix that preserves `*_latest` aliases,
- TypeScript `FirewallDecision` union typing/test alignment,
- docs and evidence files synchronized with actual gate behavior.

Validation this week included:

```bash
bash -n <changed-scripts>
./scripts/phase3_closeout_check.sh
cd sdk/typescript && npm test
```

Governance drill artifacts were refreshed with strict mode-2 signer-state validation.

The original week plan was advanced script classes, sUDT, and beginner app polish. I deferred that track this week and prioritized hardening because the Firewall repo needed operational reliability before new feature work.

What moves to next week:

- Script course classes 7-10 (Duktape, performant WASM, cycle optimization, language choices).
- sUDT standard reading and CLI tutorial.
- beginner app polish expected by the curriculum sequence.


Refs/Sources
CKB Transaction Firewall repo - https://github.com/digitaldrreamer/ckb-transaction-firewall
PR #5 - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/5
PR #6 - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/6
CKB script docs - https://docs.nervos.org/docs/script
