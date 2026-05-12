## 2026-03-23
- Added `week-2/images.md` with contextual descriptions for all week-2 screenshots tied to `week-2/raw.md`.
- Renamed 13 screenshot files in `week-2/screenshots/` from timestamp names to descriptive workflow-based names.


## 2026-03-30
- Renamed `week-3/screenshots/` PNG files to descriptive names and embedded them in `week-3/raw.md`.
- Embedded the remaining unreferenced `week-3/screenshots/` PNGs in `week-3/raw.md`.
- Added `week-3/ai-cleaned.md` cleaned writeup for easier reading.
- Updated root `.gitignore` to ignore generated artifacts (e.g. `node_modules`, build caches, logs).

## 2026-04-14
- Renamed four `week-5/screenshots/` captures from generic screenshot filenames to firewall README–oriented names.
- Updated `week-5/raw.md` to embed all four firewall repo images and note Control Hub has no screenshots this week.

- Added `two_tier_experiment.py` and ran the two-tier falsification script; Real-CATS raw TSV URLs returned HTTP 404, so `output/two_tier_test_results.csv` records load failure only.

- Fixed Real-CATS raw URL base in `two_tier_experiment.py` from branch `main` to `master` per upstream repo; re-ran experiment (outputs under `output/`).

## 2026-04-21

- Rewrote `week-6/raw.md` devlog to match prior weeks style (narrative, commands, PR workflow, Refs).

## 2026-04-21 (edit)

- Tuned `week-6/raw.md`: drop PR-bot/tooling focus; frame as all-in spec freeze toward known build.

## 2026-04-20

- week-6 devlog: frame week as falsification and next week as all-in build on confirmed plans after spec stress-test.

## 2026-04-20

- week-6 devlog: humanize prose (drop mechanical bold/em dash pile-up, slogan closers; fix SO typo; keep falsification + spec-first story).

## 2026-04-20

- week-6 devlog: strip is/not/so contrast tics from closing section and tighten governance + falsification openers.

## 2026-04-21 (ai-cleaned)

- Added `week-6/ai-cleaned.md` as a structured, polished companion to `week-6/raw.md` (same substance: falsification, registry rule, doc map, refs).

## 2026-04-26

- Added `week-7/raw.md` (implementation-first devlog for Firewall contract build/test/CI/profiling week).
- Added `week-7/ai-cleaned.md` polished companion writeup with outcomes, commands, and next-week plan.

## 2026-04-26
- Rewrote `week-7/ai-cleaned.md` to match prior weeks style, with polished narrative sections, structured outcomes, cycle-profile summary, and standardized references.

## 2026-04-26
- Clarified week-7 accuracy notes in `week-7/raw.md` and `week-7/ai-cleaned.md`: integration count now distinguishes 10 core behavior tests vs 15 total including cycle probes; cycle figures marked as run-derived unless persisted in `contracts/firewall-lock/CYCLE_REPORT.md`.

## 2026-04-26
- Reworded week-7 consistency clarifications in `week-7/raw.md` and `week-7/ai-cleaned.md` to remove note-style phrasing and use direct GitHub file links for `firewall_lock_tests.rs` and `CYCLE_REPORT.md`.

## 2026-05-07

- Added `week-8/raw.md` documenting Week 8 as the Phase 3 closeout and post-merge hardening delivery centered on CKB Transaction Firewall PR `#5` and PR `#6`.
- Added `week-8/ai-cleaned.md` polished companion writeup with detailed breakdown of verification gates, governance drill mode-2 hardening, live-governance tooling, SDK follow-ups, and validation outcomes.

## 2026-05-07 (commit-detail pass)
- Expanded `week-8/raw.md` with commit-sequence insights from PR #5/#6 (gate ratcheting, deploy edge-case fixes, ckb-cli compatibility fixes, VM remediation, and review-thread followups).
- Expanded `week-8/ai-cleaned.md` with commit-level timeline signals and explicit PR #6 commit-granularity notes.

## 2026-05-07 (week-8 devlog voice rewrite)
- Rewrote `week-8/ai-cleaned.md` from PR-summary/report style into first-person devlog format aligned with weeks 1-7 (narrative flow, friction-first context, and direct carry-over plan).

## 2026-05-07 (week-8 raw devlog rewrite)
- Rewrote `week-8/raw.md` from report-style breakdown into first-person devlog format aligned with weeks 1-7, preserving shipped facts while restoring narrative flow and author voice.

## 2026-05-07 (week-8 raw style iteration)
- Re-iterated `week-8/raw.md` after re-reading weeks 1-7, reducing commit-graph tone and rewriting into narrative devlog voice consistent with prior weeks.

## 2026-05-07 (week-8 raw prose pass)
- Tightened `week-8/raw.md` toward week-5 style: folded bullet lists into flowing paragraphs, kept refs block.

## 2026-05-07 (week-8 ai-cleaned sync)
- Updated `week-8/ai-cleaned.md` to align with the rewritten `week-8/raw.md` narrative (same chronology and substance, cleaner structure, reduced commit-graph tone).

## 2026-05-07 (week-8 raw humanizer pass)
- Humanized `week-8/raw.md` to remove remaining AI/report tells (formulaic contrasts, stacked list cadence, and tidy signposting) while preserving technical content and timeline.

## 2026-05-12

- Added `week-9/raw.md` and `week-9/ai-cleaned.md`: post–week-8 Firewall Phase 4 closure (PRs #7–#10), CI and governance evidence gates, firewall-lock integration depth, `0.2.0` and TypeScript SDK publish-ready work, docs/internal layout and testnet deployment guide; curriculum week 9 (DAO + Spore) noted as deferred.

## 2026-05-12 (week-9 raw voice)
- Rewrote `week-9/raw.md` in first-person devlog voice aligned with weeks 1–8 (curriculum vs shipped work, friction-first narrative, simple Refs block).

## 2026-05-12 (week-9 humanizer pass)
- Humanized `week-9/raw.md` (cut significance framing, tail negations, and listy cadence; straighter refs; tighter first-person).

## 2026-05-12 (week-9 raw tone)
- Tightened `week-9/raw.md`: factual PR and script list, removed dramatic or clever phrasing and pause/quiet-day mentions.

## 2026-05-12 (week-9 programme refs removed)
- Removed Builders programme / curriculum carry-forward and schedule framing from `week-9/raw.md`; dropped DAO and Spore refs there.
- Updated `week-9/ai-cleaned.md`: removed curriculum vs shipped and carry-forward sections; retitled; optional follow-up is only install checksum hardening; refs trimmed.

## 2026-05-12 (week-9 repo status)
- Documented current `ckb-transaction-firewall` state in `week-9/raw.md` and `week-9/ai-cleaned.md`: near production-ready; remaining CKB on-chain deployment for target network and npm publish for `sdk/typescript`.

## 2026-05-12 (week-9 ai-cleaned expanded)
- Expanded `week-9/ai-cleaned.md` with richer context: Phase 4 rationale, firewall-lock test story, dedicated `phase4_prepare_tx_files.sh` section, CI and docs depth, review bots, and clearer repository status.

## 2026-05-12 (week-9 PR link clarity)
- Clarified in `week-9/raw.md` and `week-9/ai-cleaned.md` that PR numbers refer to `digitaldrreamer/ckb-transaction-firewall`; added markdown links in headings and refs; disambiguated repository status wording.
