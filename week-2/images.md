# Week 2 Image Notes

This file documents each screenshot from `week-2/screenshots/` and maps it to the workflow described in `week-2/raw.md`.

## 1) `offckb-install-and-node-start.png`
- **What it shows:** `npm install -g @offckb/cli`, then `offckb node` downloading the missing CKB binary and starting a local devnet RPC proxy on `127.0.0.1:28114`.
- **Context from raw.md:** Matches the initial setup phase where OffCKB is installed and the node is launched for the first time with automatic binary download.

## 2) `offckb-devnet-prefunded-accounts.png`
- **What it shows:** Output of `offckb accounts` with the warning banner and pre-funded devnet accounts.
- **Context from raw.md:** Supports the note that OffCKB provides 20 funded test accounts out of the box for local development.

## 3) `project-scaffold-and-rust-version-check.png`
- **What it shows:** Navigation around the scaffolded project folders and `rustc --version` check.
- **Context from raw.md:** Aligns with creating the first project (`offckb create my-first-ckb-project`) and inspecting generated contract structure.

## 4) `missing-cargo-generate-error.png`
- **What it shows:** `cargo generate --version` fails with `no such command: generate`, while `clang --version` shows an older LLVM/Clang.
- **Context from raw.md:** Captures the first blocker before build: missing `cargo-generate` and outdated Clang toolchain.

## 5) `cargo-generate-installation.png`
- **What it shows:** `cargo install cargo-generate` running and downloading dependencies.
- **Context from raw.md:** Corresponds to the fix for the missing Rust templating tool required by the script project flow.

## 6) `clang16-install-failure-and-llvm-script-download.png`
- **What it shows:** `sudo apt install clang-16` initially fails, then `llvm.sh` is downloaded from `apt.llvm.org`.
- **Context from raw.md:** Matches the workaround path to obtain Clang 16+ using LLVM's official apt helper script.

## 7) `clang16-install-from-llvm-repo.png`
- **What it shows:** Package installation output for LLVM/Clang 16 from the LLVM repository.
- **Context from raw.md:** Represents the successful toolchain upgrade needed before contract compilation could proceed.

## 8) `contract-build-success-output.png`
- **What it shows:** `npm run build` succeeds; `hello-world.js` and `hello-world.bc` are generated.
- **Context from raw.md:** Confirms the build pipeline completion and expected output artifacts per contract.

## 9) `initial-test-run-before-deploy.png`
- **What it shows:** Start of `npm test` run after a successful build step.
- **Context from raw.md:** This is the first test attempt that later reveals devnet-specific issues before deployment.

## 10) `devnet-test-failure-missing-deployed-script.png`
- **What it shows:** Devnet test TypeScript errors referencing missing `hello-world.bc` script index entries; mock suite passes and cycle data is printed.
- **Context from raw.md:** Matches the failure mode explained in the notes: deployment config was empty because contracts were not deployed yet.

## 11) `deploy-command-confirmation-prompt.png`
- **What it shows:** `npm run deploy` preparing `hello-world.bc` for `devnet` and asking for deployment confirmation.
- **Context from raw.md:** Represents the corrective action taken while the local devnet is running.

## 12) `deploy-success-artifacts-generated.png`
- **What it shows:** Successful deploy output including contract tx hash, generated `deployment.toml`, migration JSON, and `scripts.json`.
- **Context from raw.md:** Confirms that deployment artifacts are produced and the devnet deployment state is now populated.

## 13) `tests-pass-after-deploy.png`
- **What it shows:** Final `npm test` output where both `mock` and `devnet` suites pass; includes cycle metrics and a transaction send log.
- **Context from raw.md:** Validates the end state described in the week summary: compiled, deployed, and fully passing tests in both environments.
