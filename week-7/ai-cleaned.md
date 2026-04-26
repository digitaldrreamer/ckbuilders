# Week 7 — Firewall lock shipped, tested, and profiled (AI-cleaned)

Week 7 in the script course was supposed to focus on WASM, debugging, and Type ID. I parked that plan and used the week to ship real Rust in the Firewall project instead. That trade-off paid off: the lock script now compiles to RISC-V, the test suite is green, CI is running, and there is a baseline cycle profile for different registry sizes.

## From frozen spec to running contract

The biggest friction this week was not blacklist logic. It was toolchain and environment work: build-system quirks, crate compatibility with current `ckb-std`, and the usual low-level setup tax. Once that stabilized, implementation moved quickly.

The lock binary came out at about **23 KB**, comfortably under budget. This is the first point where the project clearly shifted from “spec that sounds good” to “contract behavior that actually executes on VM.”

## Test status

Validation is now split across two layers:

- **Unit tests:** `19/19` passing
- **Integration tests (`ckb-testtool` + real lock binary):** `10/10` core behavior tests passing (`15` total tests in [`firewall_lock_tests.rs`](https://github.com/digitaldrreamer/ckb-transaction-firewall/blob/main/tests/unit/tests/firewall_lock_tests.rs) when cycle probes are included)

Integration coverage includes the full frozen-spec error path set:

- missing registry dependency
- ambiguous registry dependency
- blacklisted lock args
- blacklisted type args
- invalid registry data
- unsorted registry data
- plus a clean happy path

## PR feedback fixes that mattered

Two review issues were important and were fixed immediately:

1. Added a defensive bound check on untrusted `entry_count` before allocation in the registry parser.
2. Optimized dependency scanning so identity checks do not load full cell data when type-script identity is enough.

Both fixes were validated by rerunning the full test suite.

## CI and repeatability

A GitHub Actions workflow now runs:

1. contract unit tests
2. RISC-V release build
3. integration tests

on pushes and pull requests.

## Cycle profiling baseline

This week also introduced cycle profiling to establish scaling behavior early.

Recorded samples:

```text
lock-only:                    182,073 cycles
type-only:                    186,942 cycles
both checks:                  187,705 cycles
512 entries, both checks:     719,042 cycles
2000 entries, both checks:  2,327,732 cycles
```

A rough model from observed points:

`cycles ≈ 188k + ~1,060 per entry`

This gives practical planning signal before deployment and helps estimate headroom for larger registries. The values above are run-derived measurements for this week unless the same numbers are persisted in [`CYCLE_REPORT.md`](https://github.com/digitaldrreamer/ckb-transaction-firewall/blob/main/contracts/firewall-lock/CYCLE_REPORT.md).

## What moved to next week

- Script Course Classes 4–6 (WASM, debugging, Type ID)
- median-time expiry coverage for temporary blacklist entries
- start of the registry type script implementation

## Refs / Sources

- CKB Transaction Firewall repo — https://github.com/digitaldrreamer/ckb-transaction-firewall
- CKB script docs — https://docs.nervos.org/docs/script
- `ckb-std` — https://github.com/nervosnetwork/ckb-std
