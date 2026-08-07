---
id: 004
title: Step 0 — fill the Builder from a folder or zip (WO-23)
milestone: WO-23
created: 2026-08-06
author: claude (chat)
status: ready
suggested_branch: feat/builder-import
---

## Objective

An optional **step 0** on the Builder: "Start from what you have." Drop in
a homespace folder or zip — a master copy, or any homespace — and the
wizard fills every field it can, so editing an existing site never needs a
terminal. This is the WO-23 reserved in request 002's notes; it closes the
day-2 loop: build → live → change → live again, all in a browser tab.
Ruled 2026-08-07.

## TDD references

- §15 Builder — new step, **TDD amendment first** (§11: append WO-23)
- §5.2 determinism — the round-trip identity criterion below
- §6.6 file-access seam — `memoryFiles` already reads arbitrary trees
- §2 pipeline — reuse the scanner to parse the import, never a second parser

## Context

The wizard starts blank every time. Master copies exist and rebuild
byte-identically, but changing one today means hand-editing files plus a
CLI build. Meanwhile the wizard can only express a subset of what a
homespace can be — hand-added packs, custom sections, edited manifests —
so a naive import would silently destroy customizations on re-download.
That risk shapes the core invariant below.

## Design decisions (proposed)

- **Two ways in:** a folder picker on desktop (`webkitdirectory`) and a
  **zip on any device** — the zip is the phone path (mobile-first rule):
  every phone file picker can hand over one `.zip`.
- **The preserve-unknowns invariant:** the Builder edits what it
  understands and carries everything else through *unchanged* into both
  downloads. Anything not representable in the wizard — extra packs,
  unrecognized sections, hand edits — survives byte-for-byte. The UI says
  plainly what it's keeping as-is.
- **Compose over a base:** the wizard becomes `compose(base, answers)` —
  pure and deterministic over an imported base tree plus the answers —
  instead of pure generation from answers alone. Blank start = empty base;
  nothing about today's behavior changes.
- **Zip reading in the browser:** move/share the zip *reader* into
  `packages/zip` beside the writer, with inflate via the platform's
  `DecompressionStream("deflate-raw")` in the browser and `node:zlib`
  under Node — zero new dependencies; stored entries need no inflate.

## Scope

- **In scope:** the step-0 UI, import parsing via the scanner, wizard
  prefill, base-tree composition, the shared zip reader, docs and
  `START-HERE.md` updates, TDD §11/§15 amendments.
- **Out of scope / do NOT touch:** editing *inside* imported packs beyond
  the fields the wizard already owns; the serve daemon; any host upload
  integration — downloads remain the only exit.

## Requirements (acceptance criteria)

- [ ] **Step 0 is optional and first.** Before "Name your space": pick a
      folder (desktop) or a zip (every device, phone included). Skipping it
      is exactly today's blank wizard.
- [ ] **Best-effort fill.** Importing a wizard-made master copy restores
      every field — title, tagline, slug, language, spaces, layout, theme,
      footer, plugged assets, alt text, post, links.
- [ ] **Round-trip identity.** Import a master copy, change nothing:
      the master-copy download reproduces the imported tree, and the
      website download is byte-identical to a CLI build of the same
      source. This is the feature's golden test.
- [ ] **Preserve-unknowns.** Import a homespace with a hand-added pack and
      a section type the wizard doesn't offer: both survive both downloads
      untouched, and the UI reports what it's carrying ("keeping N things
      exactly as they are").
- [ ] **Graceful rejection.** Something that isn't a homespace gets a
      plain-words explanation of what was expected; nothing is lost or
      half-loaded.
- [ ] **Phone-proof.** A zip from a phone's file app imports end to end;
      the step meets the mobile-first bar like every other control.
- [ ] All existing tests and goldens stay green; new tests cover fill,
      round-trip, preserve, and rejection.

## Verification

- Round-trip and preserve-unknowns tests are the gate; run the full suite.
- Manual: on the phone — export a master copy, reimport the zip, change one
  colour, re-download both; on desktop — import a deliberately hand-edited
  homespace and confirm the edits survive.

## Git / publish

- **Commit message:** `feat: Builder step 0 — start from an existing homespace (WO-23)`
- **Branch / PR:** `feat/builder-import` → PR to `main`
- **Push?** leave to the human.

## References

- `internal-docs/requests/WO-21/002-the-builder.md` — the note that reserved WO-23
  and required the seam not to preclude this
- `internal-docs/requests/_meta/003-v0.3.0-review-fixes.md` — lands first (CI +
  Pages give this a public home and a guard rail)

## Notes for the human / Claude Code

- Amend §11 (WO-23) and §15 first, per CLAUDE.md.
- Sequencing against WO-13 (`push`) is the human's call — neither blocks
  the other, but 003 should land before either.
- When this ships, update the setup instructions' "Changing your site
  later" section: the master-copy route stops needing a terminal.
- The operator's own site isn't blocked on this — current plan is to edit
  it to spec by hand once live.
