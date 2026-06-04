# Week 12

The week opened with items still on the list from week 11: publish the Rust SDK to crates.io, add an examples folder, file the formal security review issue. None of those moved. The week went into a browser dashboard, a docs restructure, and a governance authority model fix.

## Version housekeeping (May 26)

A few deferred maintenance items first. Bumped `@ckb-firewall/cli` to 0.3.1, updated SDK packages for GOV1 v3 compatibility, fixed a Rust SDK `serde` feature flag broken since the v0.3.0 modularisation, refreshed canonical testnet deployment constants, and corrected stale CLI reference pages.

## `ckb-firewall gui` — [PR #28](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/28)

After publishing the CLI, the most common feedback was that the governance flow was hard to follow through terminal commands alone. You'd run `inspect`, copy an address, run `propose`, copy a proposal ID, run `vote`, run `sign`, run `execute` — and at no point could you see the full state in one place. PR #28 adds a browser dashboard.

`ckb-firewall gui` serves the dashboard over loopback. The CLI tries port 80 first and writes an `/etc/hosts` alias so the URL is `http://ckb-firewall.localhost` with no port number, falling back to `:7979` if port 80 is unavailable. On Linux, `sudo setcap cap_net_bind_service+eip $(which node)` grants the low port without `sudo` on every launch. GUI source is in `src/lib/gui/` as JSX components and CSS, assembled into `dist/lib/gui-bundle.html` by `scripts/build-gui.js` at build time and shipped inside the npm tarball.

The dashboard shows live registry entries with status and expiry, treasury pool usage and donation address, the proposal list with vote counts, and inline forms for creation, voting, and execution. The connection dot in the header reflects the actual socket state.

A security pass before the PR merged covered the main attack surfaces. Loopback enforcement was added at the request handler level in both `gui-server.ts` and `portless.ts` — accepts any loopback address, rejects non-loopback before reading request data. `safeJson()` escapes `</script` in inline JSON rendered inside script blocks to prevent XSS. `openBrowser()` was rewritten from `exec()` to `spawn()` with `shell: false` so the URL is a plain argument and cannot be interpolated as a shell string. `handleImport` validates that proposal `id` matches the embedded `proposalIdHash` before writing to disk. Oversized bodies call `req.destroy()`. SHA-256 hashes on all three CDN vendor scripts are verified on both cache-hit and fresh-fetch paths. CLI bumped to 0.4.0.

## Diátaxis docs restructure — [PR #29](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/29), [PR #30](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/30)

The docs site had been accumulating sections since week 10 without a consistent structure. Getting Started was doing three jobs at once and the Reference section mixed API docs with architecture explanation. PR #29 restructured the site around the Diátaxis framework — tutorials, how-to guides, reference, and explanations.

Getting Started was slimmed to a tutorial entry and a choose-your-path router. A Guides section was added for task-oriented articles. A concepts overview was added. The Rust SDK API reference was added as a formal reference entry. The sidebar and all internal cross-links were rebuilt. An editorial pass found places where sections assumed knowledge that hadn't been introduced yet.

PR #30 added the missing `gui` command entry to the CLI reference page.

Follow-up commits after both PRs merged: rewrote the main README quick-start to match real CLI output, updated the docs route table, fixed stale external links in READMEs, addressed Rust SDK API review comments, and added a GUI mode page with a real screenshot.

## Governance authority model fix (June 1)

Three commits on June 1 addressed findings GOV-004 (vote authorization gap) and NEW-004 (execute authorization gap) with tighter validation in the relevant CLI commands.

The more significant change was `refactor: remove signer layer artifacts`. Proposal cells had been locked in a way that required the treasury private key at execution time. The treasury's role is to fund the anchor cell, not to authorize the state transition — the governance-lock handles authorization through committee threshold signatures. Correcting this meant locking proposal anchor cells to governance-lock rather than involving the treasury key. The same refactor removed a VM blocker: certain atomic instructions emitted by the signer layer are not supported by the CKB VM. GUI got UX and correctness fixes in the same batch.

## What's next

- Keyless anchor funding — the treasury holds capacity but isn't yet wired to disburse it autonomously for anchoring. Creating an anchor cell still requires a signer to supply the CKB.
- examples/ folder — still outstanding
- Rust SDK publish to crates.io — still outstanding
- Formal security review issue — still outstanding

## Refs / Sources

- [CKB Transaction Firewall](https://github.com/digitaldrreamer/ckb-transaction-firewall)
- [PR #28 — ckb-firewall gui](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/28)
- [PR #29 — Diátaxis docs restructure](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/29)
- [PR #30 — CLI reference gui entry](https://github.com/digitaldrreamer/ckb-transaction-firewall/pull/30)
