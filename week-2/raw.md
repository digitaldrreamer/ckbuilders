This week was less theory and more actually getting hands dirty with the environment. The goal was to install OffCKB, get a local devnet running and actually compile and deploy something. Not read about cells anymore, actually touch the chain.

OffCKB is basically a local CKB development environment manager. Think of it like how you'd use Hardhat or Foundry on Ethereum, except for CKB. It downloads the CKB binary for you, spins up a local devnet, gives you 20 pre-funded test accounts out of the box and even pre-deploys common scripts like Omnilock and xUDT into the genesis block so you don't have to do that yourself.

Installing it is just:

```bash
npm install -g @offckb/cli
```

One thing I found out, don't install via Bun. There's a native module issue that causes a "Cannot find module" error. npm only for this one.

Then to start the devnet:

```bash
offckb node
```

First time it ran, it said the CKB binary wasn't found and just went ahead and downloaded it automatically. After that it started the node and the RPC proxy was running on http://127.0.0.1:28114.

![OffCKB install and node start](screenshots/offckb-install-and-node-start.png)

Ran `offckb accounts` to confirm and the 20 accounts showed up fine.

![OffCKB devnet pre-funded accounts](screenshots/offckb-devnet-prefunded-accounts.png)

Now the actual project. I created a new project using:

```bash
offckb create my-first-ckb-project
```

I picked a script template which turned out to scaffold a Rust/JS hybrid project. The contracts folder had a hello-world contract inside it.

![Project scaffold and Rust version check](screenshots/project-scaffold-and-rust-version-check.png)

This is where it got interesting. The contracts here aren't Solidity. They're not even Rust exactly, well the compilation pipeline involves Rust but the actual contract I was looking at was TypeScript, compiled down to JavaScript, then compiled to RISC-V bytecode using a tool in the build pipeline. That's the thing about CKB-VM, because it runs RISC-V, anything that can compile to it works. The template uses esbuild to bundle the TS, then a separate step converts that to bytecode.

Building:

```bash
npm run build
```

Worked fine after I sorted out two missing dependencies. `cargo-generate` wasn't installed and my system only had Clang 14, both of which the build pipeline needs.

![Missing cargo-generate error](screenshots/missing-cargo-generate-error.png)

Fixed cargo-generate first:

```bash
cargo install cargo-generate
```

![cargo-generate installation](screenshots/cargo-generate-installation.png)

Then for Clang 16, it wasn't in the default Ubuntu repos so had to pull from the LLVM repo directly:

```bash
wget https://apt.llvm.org/llvm.sh
chmod +x llvm.sh
sudo ./llvm.sh 16
```

![Clang 16 install failure and LLVM script download](screenshots/clang16-install-failure-and-llvm-script-download.png)

![Clang 16 install from LLVM repo](screenshots/clang16-install-from-llvm-repo.png)

After that the build went through clean. Output was two files per contract, a `.js` bundle and a `.bc` bytecode file.

![Contract build success output](screenshots/contract-build-success-output.png)

Then I ran the tests:

```bash
npm test
```

There are two test suites. The mock test passed immediately, that one runs the contract logic in a simulated environment without needing the actual node. The devnet test failed at first with a TypeScript error about `hello-world.bc` not existing on the scripts index.

![Initial test run before deploy](screenshots/initial-test-run-before-deploy.png)

![Devnet test failure — missing deployed script](screenshots/devnet-test-failure-missing-deployed-script.png)

That was because the contract hadn't been deployed yet SO the deployment config was empty. Ran `npm run deploy` with the devnet node running in a separate terminal:

![Deploy command confirmation prompt](screenshots/deploy-command-confirmation-prompt.png)

![Deploy success — artifacts generated](screenshots/deploy-success-artifacts-generated.png)

Then ran tests again and both suites passed.

![Tests pass after deploy](screenshots/tests-pass-after-deploy.png)

The mock test output showed something useful:

```
Run result: 0
All cycles: 539
```

and for the type script:

```
Script log: [DEBUG] hello-world script loaded: {}
Run result: 0
All cycles: 3957269(3.8M)
```

Run result 0 means success on CKB-VM. The cycle count is basically the computational cost of running the script. Lower is cheaper. The lock script used 539 cycles, the type script used 3.8 million. That difference is worth thinking about more later when I get to optimization.

So by end of week I have a working local CKB devnet, a compiled and deployed hello-world contract, and passing tests for both mock and devnet environments. Next week is the actual beginner tutorials, Transfer CKB and Store Data on Cell.


Refs/Sources
OffCKB docs and quick start - offckb.com
"cargo-generate and Clang 16 required for script projects" - docs.nervos.org/docs/script
LLVM apt repo - apt.llvm.org
CKB-VM cycle counting - docs.nervos.org/docs/tech-explanation/ckb-vm
Perplexity for internet-wide research prompts.