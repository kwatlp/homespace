# internal-docs/requests/

Structured change requests written by **Cowork** for **Claude Code** to execute.
Cowork doesn't edit code or run git on this repo (see [`CLAUDE.md`](../../CLAUDE.md)
→ "Who does what"); instead it drops a request here, and the human runs it with
Claude Code.

This file is the one home for the request process. Everywhere else — the root
[`README.md`](../../README.md), [`CLAUDE.md`](../../CLAUDE.md),
[`CONTRIBUTING.md`](../../CONTRIBUTING.md) — points here rather than restating it.

## Layout

```
internal-docs/requests/
  README.md                         this file
  _meta/                            infra/workflow requests (not tied to a work order)
    001-v0.2.0-review-remediations.md
    003-v0.3.0-review-fixes.md
  WO-21/                            requests for work order WO-21
    002-the-builder.md
  WO-23/
    004-builder-import-step0.md
```

- **Organized by work order.** One folder per TDD work order (`WO-1`, `WO-2`, …;
  see [`HomespaceTDD.md`](../HomespaceTDD.md) §11). Requests that aren't tied to a
  work order — tooling, CI, repo hygiene — go in `_meta/`.
- **Global IDs.** Each request gets the next zero-padded number (`001`, `002`,
  …) across the whole tree, so it's uniquely referenceable regardless of folder.
- **Filename:** `<NNN>-<short-slug>.md`.

## Lifecycle

`draft` → `ready` → `in-progress` → `done` (or `cancelled`). The `status` lives
in the request's front matter. Claude Code updates it to `done` (and notes the
commit) when finished. Done requests stay in place as a record of what was asked.

## Writing one

Copy [`../CODE_REQUEST_TEMPLATE.md`](../CODE_REQUEST_TEMPLATE.md), fill it in,
and save it here under the right milestone folder with the next global number.
Keep requests **outcome-oriented** — what should be true when it's done and how
to verify it, not line-by-line edits. Claude Code owns the implementation,
within the TDD's contracts (§3, §4), dependency budget (§5.4), and conventions
(Appendix A).

A request that grows new findings before it's executed **absorbs them as extra
numbered items** rather than spawning a follow-up request; a new number is for
new work, not for amendments to work already specified.
