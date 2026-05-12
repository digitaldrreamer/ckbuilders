Work on `ckb-transaction-firewall` this week was on `main` after the week eight devlog snapshot. Pull request numbers below mean **[digitaldrreamer/ckb-transaction-firewall](https://github.com/digitaldrreamer/ckb-transaction-firewall)** pulls, not pulls in this `ckbuilders` repo.

PR #7 merged Phase 4 program closure: `REAL_GOV_EVIDENCE_REQUIRED=1` in `scripts/phase3_closeout_check.sh`, pinned `ckb-cli` via `scripts/ci/install_ckb_cli.sh` in GitHub Actions, stricter `scripts/phase4_governance_tx_status.sh` polling for terminal `committed` / `rejected` states, refreshed `tests/integration/governance_drill/chain_status_latest.json` on testnet. Added Phase 4 ADR, go/no-go record, live governance drill runbook, security findings tracker, verification requirements matrix, verification status rollup, milestone artifact notes under the Phase 4 artifact tree, and a Phase 3 status snapshot for continuity.

Firewall lock: extended `ckb-testtool` integration tests in `tests/unit/tests/firewall_lock_tests.rs` for `header_deps` and median-time paths, inner-lock spawn error paths (including an `always_failure`-style lock fixture), larger-registry happy path coverage. Updated `contracts/firewall-lock/GAPS_ANALYSIS.md` so the registry section matches shipped `contracts/blacklist-registry`.

`scripts/phase4_prepare_tx_files.sh`: fixes for wallet top-up, committed waits between transfers, parsing `ckb-cli` output when prompts mix with JSON, `get_cells` paging and capacity filters, merging live cells from `get_transaction` when indexing lags.

PR #8: executable bit on `install_ckb_cli.sh`, workflow runs installer with `bash`, `curl` retries and connect timeout, `deploy/` in `.gitignore`, `u8::try_from` in test helpers, changelog note.

PR #9: Actions `checkout` / `setup-node` / `upload-artifact` v5, Node 22 for SDK steps, `CURL_MAX_TIME_SECONDS` and `CURL_RETRY_DELAY_SECONDS` for downloads, more `try_from` in tests, `GAPS_ANALYSIS.md` registry section refresh, version bump to `0.2.0` for on-chain crates, Rust SDK, TypeScript package, and `tests/unit`.

PR #10 and following commits on `main`: README and `ABOUT.md` restructured; `docs/architecture.md` gained CKB-fit narrative; `PHASE3_PLAN.md`, `phase3_artifacts/`, and `phase4_artifacts/` moved under `docs/internal/` with index and link updates; ASCII punctuation pass on long docs; `docs/deployments/testnet.md` for TypeScript testnet path; `sdk/typescript` publish-oriented layout (`dist/`, `package.json` exports, stricter TS options, CI checks for built artifacts).

PR review: CodeRabbit flagged duplicate changelog date headings, inconsistent production-build wording vs example commands in `contracts/blacklist-registry/CYCLE_REPORT.md`, broken relative links in some markdown, and lack of checksum verification on the `ckb-cli` download; an autofix commit addressed part of that. Gemini review noted `curl --max-time` covering the whole download including retries and a missing `await` in a TypeScript example.

Where the repo is now: close to production-ready on code, tests, and CI gates. What is still open is real deployment on CKB for the target network (contracts and live governance path beyond the testnet drill evidence already in tree) and publishing the TypeScript SDK to npm (`sdk/typescript`).


Refs/Sources (all URLs are **`digitaldrreamer/ckb-transaction-firewall`**, not this devlog repo)

- [Repository](https://github.com/digitaldrreamer/ckb-transaction-firewall)
- [PR #7](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/7)
- [PR #8](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/8)
- [PR #9](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/9)
- [PR #10](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/10)
- [CKB script docs](https://docs.nervos.org/docs/script)
