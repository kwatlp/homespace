# code-requests/

Structured change requests written by **Cowork** for **Claude Code** to execute.
Cowork doesn't edit code or run git on this repo (see [`CLAUDE.md`](../CLAUDE.md)
→ "Who does what"); instead it drops a request here, and the human runs it with
Claude Code.

## Layout

```
code-requests/
  README.md                         this file
  _meta/                            infra/workflow requests (not tied to a work order)
    001-<slug>.md
  WO-1/                             requests for work order WO-1
    002-<slug>.md
  WO-2/
    ...
```

- **Organized by work order.** One folder per TDD work order (`WO-1`, `WO-2`, …;
  see `internal-docs/HomespaceTDD.md` §11). Requests that aren't tied to a work
  order — tooling, CI, repo hygiene — go in `_meta/`.
- **Global IDs.** Each request gets the next zero-padded number (`001`, `002`,
  …) across the whole tree, so it's uniquely referenceable regardless of folder.
- **Filename:** `<NNN>-<short-slug>.md`.

## Lifecycle

`draft` → `ready` → `in-progress` → `done` (or `cancelled`). The `status` lives
in the request's front matter. Claude Code updates it to `done` (and notes the
commit) when finished. Done requests stay in place as a record of what was asked.

## Writing one

Copy `internal-docs/CODE_REQUEST_TEMPLATE.md`, fill it in, save it here. Keep
requests outcome-oriented (what should be true + how to verify), not line-by-line
edits — Claude Code owns the implementation, within the TDD's contracts (§3, §4),
dependency budget (§5.4), and conventions (Appendix A).
