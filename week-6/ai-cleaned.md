# Week 6 — Firewall spec hardening (AI-cleaned)

## Context

Week 6 continued from week 5: thinking and README work that had stayed private. There was still no on-chain time on this side, but the week was not idle theory. The goal was to make the [Firewall repo](https://github.com/digitaldrreamer/ckb-transaction-firewall) something another developer could pick up without having to reconstruct half the protocol from intuition.

## Approach: falsification

Most of the week was stress-testing drafts that were already written. Examples of the questions that drove edits:

- If the registry outpoint is pinned in every lock argument, does that survive a real registry rotation, or does it quietly force a wallet-migration story?
- Is “emergency expires in 72 hours” something a script can enforce, or is it policy cosplay?
- If two `cell_deps` both look like the registry, is “take the first match” ever safe?
- Should add and remove votes use the same threshold?

When an answer failed that kind of scrutiny, the spec moved. What remains in the docs is what did not fall apart under those questions.

## Repo state

The repo is public (`ckb-transaction-firewall`). On disk it was almost entirely Markdown: twenty-one `.md` files, no `Cargo.toml`, no `main.rs`, no Lumos package. That order is intentional after weeks of devnet tutorials: the risky parts were written down first and stress-tested on paper before any Rust. That includes governance numbers, how a `cell_dep` may match, two plausible registries, and what “72 hours” means in bytes a lock can read. Starting with Rust would have tempted encoding whatever was convenient and retro-fitting policy afterward.

## Scaffolding

The root README described a tree (`contracts/`, `sdk/`, `docs/`, and so on) that did not exist yet. Folders and stub READMEs were added until the file browser matched the diagram.

```bash
# Sanity check from repo root — Markdown only, no compiler output yet
find . -name '*.md' | wc -l   # 21 at time of writing
find . \( -name '*.rs' -o -name '*.ts' \) | wc -l   # 0
```

![Firewall repo root after scaffold](screenshots/week-6-firewall-repo-root-tree.png)

## Documentation set

- **`docs/architecture.md`** — Two-layer story in one place.
- **`governance/voting.md`** — The flow someone would actually follow.
- **`docs/governance.md`** — Longer rationale for thresholds.
- **`docs/lock-script-spec.md`** — Lock `args` layout, dependency scan step by step, error codes starting at `5` (aligned with Nervos minimal-script guidance that project-specific codes start there).

### Governance (summary)

Nine active validators; one person, one vote. A multisig executes what votes authorize. The validator tally is treated as the legitimacy signal, separate from who holds the keys. Blacklist adds are intentionally easier than removes. Meta changes get more review and a built-in delay before execution. Emergency is temporary add-only, with evidence, a short vote window, and each temporary row has `expires_at`. Expiry uses median chain time so every node evaluates “72 hours” with the same math.

### Registry matching (CKB-specific)

Pinning the registry outpoint in every lock argument makes every registry rotation a migration problem and undercuts the idea of a shared blacklist as a `cell_dep`. The frozen approach is the registry cell’s type script identity (`code_hash`, `hash_type`, `args` as bytes, length-prefixed in the lock args). At validation, all `cell_deps` are walked; live cells whose type script matches that triple are counted, and execution continues only if the count is exactly one. Zero means a missing dependency; two is ambiguous and should fail closed. Stating that rule explicitly is a large part of why the week existed—without it, two implementers could both sound reasonable and still ship incompatible locks.

README examples were aligned with the spec. SDK configuration spells out a type script object (`codeHash`, `hashType`, `args`) the way the lock will need it; the vague outpoint-only hand-wave in examples was removed.

Docs shipped on a branch and merged. Week 5 had already chosen a direction; week 6 was kicking the joints until something wobbled, then recording whatever still held. **Next week:** Rust implementation directly from the frozen spec.

### Changelog housekeeping

`CHANGELOG.md` in the Firewall repo groups entries under one dated heading with sub-bullets. Previously the same date repeated five times in a row when scrolling, which read like a glitch.

## Deferred again

Simple Lock tutorial and L1 course reading—again deferred in favor of the Firewall repo.

## Next week

Code: `ckb-std` firewall lock and registry type script under `contracts/`, traced against `docs/lock-script-spec.md` and the governance docs—building and compiling.

---

## References and sources

| Topic | Link |
|--------|------|
| CKB Transaction Firewall repo | https://github.com/digitaldrreamer/ckb-transaction-firewall |
| CKB script overview | https://docs.nervos.org/docs/script |
| `ckb-std` | https://github.com/nervosnetwork/ckb-std |
| Minimal script / error codes | https://docs.nervos.org/docs/script/minimal-script |
| Cell deps | https://docs.nervos.org/docs/tech-explanation/cell-deps |
| Claw & Order hackathon context (week 5 thread) | https://talk.nervos.org/t/claw-order-ckb-ai-agent-hackathon-results/10173 |

Perplexity was used for research.
