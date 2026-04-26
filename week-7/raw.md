Week 7 was supposed to be WASM, debugging, and Type ID from the script course. It wasn't. I spent the week writing actual Rust instead and I don't regret it.

The Firewall lock script compiled to RISC-V this week. Tests are green. CI is running. That's the transition from "frozen spec with big promises" to "thing that actually runs on the VM."

The hardest part wasn't the blacklist logic itself. It was build system friction, crate compatibility issues around current `ckb-std` APIs, environment quirks, the usual tax you pay when you're working close to the metal on a less mainstream toolchain. Once that stabilised everything moved fast.

Lock script binary came out at around 23K. Well under budget. 19 unit tests passing, 10 core integration behavior tests passing against the real binary using `ckb-testtool` (15 total tests in [`firewall_lock_tests.rs`](https://github.com/digitaldrreamer/ckb-transaction-firewall/blob/main/tests/unit/tests/firewall_lock_tests.rs) when cycle probes are included). The integration suite covers all the error paths from the frozen spec, missing registry dep, ambiguous registry dep, blacklisted lock args, blacklisted type args, invalid registry data, unsorted registry, all of them. Plus a clean happy path that passes.

Two things got fixed from PR review feedback. First, a defensive bound check on untrusted `entry_count` before allocation in the registry parser — without that an attacker could craft a registry cell with a huge claimed entry count and cause problems before any real validation runs. Second, the dep scan was optimised to avoid loading full cell data when all you need is type script identity matching. Both fixes verified by rerunning the full suite.

Added CI too. GitHub Actions running unit tests, the RISC-V release build, and integration tests on every push.

The interesting thing from this week is the cycle profiling. Added a profiling script and ran it across different registry sizes:

```
lock-only:                    182,073 cycles
type-only:                    186,942 cycles
both checks:                  187,705 cycles
512 entries, both checks:     719,042 cycles
2000 entries, both checks:  2,327,732 cycles
```

Which gives a rough scaling model: `cycles ≈ 188k + ~1,060 per entry`. That's useful. It means you can reason about headroom before you deploy, not after. These values are from the week’s profiling runs and are considered run-derived unless the same numbers are persisted in [`CYCLE_REPORT.md`](https://github.com/digitaldrreamer/ckb-transaction-firewall/blob/main/contracts/firewall-lock/CYCLE_REPORT.md).

Script course classes 4-6 carry into next week. Next week is also median-time expiry coverage for temporary blacklist entries and starting the registry type script implementation.


Refs/Sources
CKB Transaction Firewall repo — github.com/digitaldrreamer/ckb-transaction-firewall
CKB script docs — docs.nervos.org/docs/script
ckb-std — github.com/nervosnetwork/ckb-std