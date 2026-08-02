# Code request template

Cowork fills this out to hand a code/git change to **Claude Code**. Cowork never
edits code or runs git directly (see [`CLAUDE.md`](../CLAUDE.md) → "Who does
what").

**How to use**

1. Copy everything below the `--- 8< ---` line into a new file.
2. Save it as `code-requests/<milestone>/<NNN>-<short-slug>.md`
   (e.g. `code-requests/WO-1/002-pack-schema.md`). `<NNN>` is the next global
   request number; see `code-requests/README.md`.
3. Fill every section. Leave a section as `n/a` rather than deleting it.
4. Tell the human the request is ready; they run it with Claude Code.

Keep requests **outcome-oriented**: say what should be true when it's done and
how to verify it, not line-by-line edits. Claude Code decides the
implementation, within the TDD's contracts and conventions.

--- 8< --- copy below this line --- 8< ---

---
id: NNN
title: <one line>
milestone: <e.g. WO-1 | _meta>
created: <YYYY-MM-DD>
author: cowork
status: ready            # draft | ready | in-progress | done | cancelled
suggested_branch:        # optional, e.g. feat/pack-schema
---

## Objective

One or two sentences: the outcome wanted and why it matters.

## TDD references

Which parts of `internal-docs/KwatlpTDD.md` govern this work (e.g. §3 pack
manifest, §11 WO-1). Flag if the request would require **amending** the TDD
(new dependency, section type, or manifest field) — that amendment is part of
the same change.

## Context

Background a fresh Claude Code session needs: current behavior, where it lives,
related requests, anything already tried.

## Scope

- **In scope:** what this request should change.
- **Out of scope / do NOT touch:** guard rails — files, behaviors, or areas to
  leave alone.

## Likely files / areas

Pointers to orient Claude Code (not prescriptive):
- `path/to/file` — why it's relevant

## Requirements (acceptance criteria)

- [ ] Concrete, checkable statement of done (map these to the WO's exit
      criteria where relevant).
- [ ] …

## Verification

How Claude Code proves it's done before committing:
- Commands to run (e.g. `npm test`, `npm run typecheck`, `npx kwatlp build`).
- Expected output / behavior to confirm (incl. the offline-budget gate from
  WO-3 onward).

## Git / publish

- **Commit message:** `<type>: <summary>`
- **Branch / PR:** <branch name, or "commit to main">
- **Push?** usually leave to the human — state if otherwise.

## References

- <TDD sections, prior requests, external docs>

## Notes for the human / Claude Code

- Anything else worth flagging (risks, sequencing, follow-ups).
