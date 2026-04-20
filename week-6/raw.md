Week 6 picked up where week 5 left off. Week 5 was me thinking and writing READMEs in private. Week 6 still had no chain time on my side, but it wasn't idle thinking. I wanted the Firewall repo to be something I could hand to another dev without them having to invent half the protocol from vibes.

Most of the week was falsification: hammering on drafts I'd already written to see where they broke. If you pin the registry outpoint in every lock arg, does that survive a real registry rotation, or do you quietly force a wallet migration story? Is "emergency expires in 72 hours" something a script can check, or is it policy cosplay? If two `cell_deps` both look like the registry, is "take the first match" ever safe? Should add and remove votes use the same bar? When something failed that kind of question, the spec moved. What stayed in the docs is what didn't fall over.

The repo is public now (`ckb-transaction-firewall`). On disk it's almost all markdown: twenty-one `.md` files, no `Cargo.toml`, no `main.rs`, no Lumos package. That probably sounds backwards after weeks of devnet tutorials, but I wanted the boring dangerous parts written down first, and stress-tested on paper before any Rust. Governance numbers. How a `cell_dep` is allowed to match. Two plausible registries. What "72 hours" means in bytes a lock can read. If I'd started with Rust I'd have encoded whatever was easy and called it policy afterward.

First messy step was scaffolding that matched the story. The root README described a tree (`contracts/`, `sdk/`, `docs/`, etc.) that didn't exist yet, so I made the folders and stub READMEs until the file browser matched the diagram.

```bash
# sanity check from repo root — only markdown, no compiler output yet
find . -name '*.md' | wc -l   # 21 at the time of writing
find . \( -name '*.rs' -o -name '*.ts' \) | wc -l   # 0
```

![Firewall repo root after scaffold](screenshots/week-6-firewall-repo-root-tree.png)

Then the grind. `docs/architecture.md` pulls the two-layer story into one place. `governance/voting.md` is the flow someone would actually follow. `docs/governance.md` is the longer "why these thresholds" writeup. The heavy file is `docs/lock-script-spec.md`: lock `args` layout, dep scan step by step, error codes starting at `5` because that's what the Nervos minimal-script docs use for "project-specific starts here."

Governance in short: nine active validators, one person one vote. Multisig carries out what the votes authorize. I treat the validator tally as the legitimacy signal, separate from who holds the keys. Blacklist adds are easier than removes on purpose. Meta changes get more review and a built-in delay before execution. Emergency is temporary add only, with evidence, a short vote window, and each temp row has `expires_at`. Expiry uses median chain time so every node evaluates `"72 hours"` with the same math.

The registry bit felt the most CKB-specific once I sat with it. If every lock arg pins the registry outpoint, every registry rotation becomes a migration headache. That fights the whole "shared blacklist as a cell dep" idea. So the frozen approach is the registry cell's type script identity (`code_hash`, `hash_type`, `args` as bytes, length-prefixed in the lock args). At validation you walk all `cell_deps`, count live cells whose type script matches that triple, and you only continue if the count is exactly one. Zero is missing dep. Two is ambiguous and should fail closed. Having that sentence in writing is why the week existed. Without it two implementers could both sound reasonable and still ship incompatible locks.

README examples line up with the spec now. SDK config spells out a type script object (`codeHash`, `hashType`, `args`) the way the lock will need it. The vague outpoint-only hand-wave in the examples is gone.

Docs shipped on a branch and merged. Week 5 had already picked a direction. Week 6 was kicking the joints until something wobbled, then writing down whatever still held. Next week I write Rust straight from that frozen spec.

`CHANGELOG.md` in the Firewall repo groups under one dated heading with sub-bullets. Before, the same date repeated five times in a row when you scrolled, which read like a glitch.

What I skipped again: Simple Lock tutorial and L1 course reading. They keep losing to the Firewall repo.

Next week is code: `ckb-std` firewall lock and registry type script under `contracts/`, traced against `docs/lock-script-spec.md` and the governance docs. Building and compiling.


Refs/Sources
CKB Transaction Firewall repo — https://github.com/digitaldrreamer/ckb-transaction-firewall
CKB script overview — https://docs.nervos.org/docs/script
`ckb-std` — https://github.com/nervosnetwork/ckb-std
Minimal script / error discussion — https://docs.nervos.org/docs/script/minimal-script
Cell deps explanation — https://docs.nervos.org/docs/tech-explanation/cell-deps
Claw & Order hackathon context (week 5 thread) — https://talk.nervos.org/t/claw-order-ckb-ai-agent-hackathon-results/10173
Perplexity for research
