The week opened with items still on the list from week 11: publish the Rust SDK to crates.io, add an examples/ folder, file the formal security review issue. None of those moved forward. The week turned into a browser dashboard, a docs restructure, and a governance authority fix.


Version housekeeping (May 26)

Started with a few deferred maintenance items. Bumped `@ckb-firewall/cli` to 0.3.1, updated SDK packages for GOV1 v3 compatibility, fixed a Rust SDK `serde` feature flag that had been broken since the v0.3.0 modularisation, refreshed canonical testnet deployment constants in the docs, and corrected a few stale CLI reference pages.


ckb-firewall gui (PR #28)

After publishing the CLI, the most common piece of feedback was that the governance flow was hard to follow through terminal commands alone. You'd run `inspect`, copy an address, run `propose`, copy a proposal ID, run `vote` four times, run `sign`, run `execute` -- and at no point did you have a way to see the full state in one place. So I built a browser dashboard.

`ckb-firewall gui` serves a governance dashboard over loopback. The CLI tries port 80 first and writes an `/etc/hosts` alias, so the URL is `http://ckb-firewall.localhost` with no port number. Falls back to `:7979` if port 80 is not available. On Linux, `sudo setcap cap_net_bind_service+eip $(which node)` makes the portless URL work without `sudo` on every launch. GUI source lives in `src/lib/gui/` as JSX components and CSS, assembled into `dist/lib/gui-bundle.html` by `scripts/build-gui.js` at build time. The bundle ships inside the npm tarball.

The dashboard shows live registry entries with status and expiry, treasury pool usage with a donation address, the proposal list with status and vote counts, and inline forms for creation, voting, and execution. The connection status dot in the header reflects the actual socket state rather than a static assumption.

Because the dashboard handles private keys, I did a dedicated security pass before the PR merged. Loopback enforcement was added at the request handler level in both `gui-server.ts` and `portless.ts` -- accepts any loopback address, rejects everything else before reading request data. `safeJson()` escapes `</script` in inline JSON rendered inside script blocks, which prevents XSS if proposal content contains attacker-controlled strings. `openBrowser()` was rewritten from `exec()` to `spawn()` with `shell: false` so the URL is a plain argument and cannot be interpolated as a shell string. `handleImport` now validates that the proposal `id` matches the embedded `proposalIdHash` before writing to disk, closing the path traversal vector. Oversized request bodies call `req.destroy()` to abort the stream. SHA-256 hashes on all three CDN vendor scripts are verified on both cache-hit and fresh-fetch paths. CLI bumped to 0.4.0.


Diátaxis docs restructure (PR #29, PR #30)

The docs site had been growing since week 10 and the organisation wasn't holding. Each new protocol section landed in whichever folder seemed closest. After a few weeks of that, the Getting Started section was doing three jobs at once and the Reference section mixed API docs with architecture explanation.

PR #29 restructured the site around the Diátaxis framework -- tutorials, how-to guides, reference, and explanations as four distinct modes with clear contracts for what belongs in each. Getting Started was slimmed to a tutorial entry and a choose-your-path router. A Guides section was added for task-oriented articles covering specific goals like running a preflight check or importing a proposal for offline voting. A concepts overview was added. The Rust SDK API reference was added as a formal reference entry. The sidebar was rebuilt and all internal cross-links updated. An editorial pass caught places where sections assumed knowledge that hadn't been introduced yet.

PR #30 was small: the `gui` command was missing from the CLI reference page entirely.

After both PRs merged I did a round of follow-up commits: rewrote the main README quick-start section to match real CLI output, updated the docs route table, fixed stale external links in both READMEs, addressed a round of Rust SDK API review comments, and added a GUI mode page with a real screenshot -- the first page in the site that shows the running interface.


Governance authority model fix (June 1)

Three commits on June 1 came out of a closer read of the governance authority model.

Two open security findings were closed: one covering a vote authorization gap, one covering an execute authorization gap. Both got fixed with tighter validation in the relevant CLI commands.

The more significant change was removing the signer layer entirely. The governance authority model had an incorrect assumption: proposal cells were being locked in a way that required the treasury private key to be available at execution time. The treasury is supposed to fund the anchor cell, not authorize the state transition. The governance-lock handles authorization through threshold signatures from the committee. Those two concerns are separate and should stay separate. Correcting the model meant locking proposal anchor cells to governance-lock rather than to anything that touches the treasury key. The same refactor also removed a VM blocker -- certain atomic instructions emitted by the signer layer are not supported by the CKB VM's RISC-V implementation. The GUI got a round of UX and correctness fixes in the same batch.


Status and what's next

The browser dashboard is working. The docs have a proper structural skeleton. The governance authority model is correct. The proposal anchor funding path is still not keyless -- creating an anchor cell still requires a signer to supply the CKB capacity. That's the remaining architectural gap. The treasury holds capacity but isn't yet wired to disburse it autonomously for anchoring. The examples/ folder, Rust SDK crates.io publish, and formal security review issue are still on the list.


Refs / Sources

- CKB Transaction Firewall repo - https://github.com/digitaldrreamer/ckb-transaction-firewall
- PR #28 (ckb-firewall gui) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/28
- PR #29 (Diátaxis restructure) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/29
- PR #30 (cli reference gui entry) - https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/30
