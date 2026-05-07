# Week 8 - hardening sprint instead of curriculum track (AI-cleaned)

Week 8 on paper was Script Course classes 7-10 plus sUDT reading/tutorial.  
Week 8 in practice was deep hardening and closeout work for the Firewall repo.

The week revolves around two PRs:

- [PR #5](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/5)
- [PR #6](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/6)

I count these as the week output because this is where real shipping happened.

## What shipped

PR #5 was the major delivery. It was not a single feature branch; it was a readiness pass that pushed the project toward repeatable, gated, and auditable operation.

Phase 3 flow was tightened first:

- `scripts/phase3_verify.sh` now drives builds, guards, tests, cycle probes, and artifacts in one run.
- `scripts/phase3_closeout_check.sh` became the central readiness gate for evidence, docs, runbooks, and security checks.
- `scripts/phase3_status_report.sh`, `scripts/phase3_repro_build.sh`, and `scripts/phase3_compat_check.sh` closed the reproducibility and compatibility loop.

Governance drill behavior was hardened in parallel:

- mode-2 scripts now enforce scenario-level signer policy and preflight discipline,
- signer-separation evidence is persisted in `tests/integration/governance_drill/mode2_signer_state.json`.

Deploy/live paths also got stricter:

- `scripts/deploy.sh` was hardened for repeatable execution,
- Phase 4 helper scripts were added for tx prep, submit, status polling, and evidence verification:
  - `scripts/phase4_governance_autorun_live.sh`
  - `scripts/phase4_prepare_tx_files.sh`
  - `scripts/phase4_submit_tx.sh`
  - `scripts/phase4_governance_tx_status.sh`
  - `scripts/phase4_governance_evidence_check.sh`

SDK and runtime compatibility moved forward too:

- Rust and TypeScript SDK paths were filled out with parity checks,
- registry/runtime compatibility updates landed in `contracts/blacklist-registry/src/main.rs`.

## What the week felt like

The final PR looks tidy, but the actual week was iterative hardening under friction.

The pattern repeated: add gate -> hit edge case -> tighten behavior -> rerun.  
That happened across verification, governance drill flow, and deploy flow.

Two technical frictions stood out:

1. `ckb-cli` compatibility details (`get_live_cell` behavior and outpoint index format split by context) needed explicit handling.
2. VM constraints forced registry-path changes away from atomic-heavy assumptions, plus earlier preflight checks.

Review feedback changed behavior materially, not cosmetically: bounds/overflow handling was tightened, policy detection logic for `dev-signer-keys` was corrected, and mode-2 CI-safety was refined late in the PR.

## PR #6 follow-up

PR #6 was the post-merge quality pass. Smaller diff, high leverage:

- stronger `dev-signer-keys` detection in closeout checks,
- explicit `jq` prerequisite failure behavior,
- stricter secp args validation in governance lock preflight,
- safer CLI arg handling in tx-status tooling,
- artifact retention fix to preserve `*_latest`,
- TypeScript `FirewallDecision` union/test alignment,
- docs/evidence sync with actual gate behavior.

## Validation run this week

```bash
bash -n <changed-scripts>
./scripts/phase3_closeout_check.sh
cd sdk/typescript && npm test
```

Governance drill artifacts were also refreshed with strict mode-2 signer-state validation.

## Curriculum deviation

Week 8 curriculum topics were deferred intentionally.  
Given project state, hardening and closeout reliability had higher immediate value than tutorial progression.

## Next week carry-over

- Script course classes 7-10 (Duktape, performant WASM, cycle optimization, language choices).
- sUDT standard reading and CLI tutorial.
- beginner-app polish work aligned with curriculum sequence.

## Refs / Sources

- CKB Transaction Firewall repo - https://github.com/digitaldrreamer/ckb-transaction-firewall
- PR #5 - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/5
- PR #6 - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/6
- CKB script docs - https://docs.nervos.org/docs/script
