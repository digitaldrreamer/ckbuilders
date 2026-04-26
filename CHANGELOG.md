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
