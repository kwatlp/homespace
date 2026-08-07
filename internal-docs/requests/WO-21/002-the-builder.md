---
id: 002
title: The Builder — zero-terminal creation: guided install + customization, ready from the start
milestone: WO-21
created: 2026-08-04
author: claude (chat)
status: ready
suggested_branch: feat/builder
---

## Objective

A person who has never seen a terminal opens one web page, answers three
groups of questions — **name of space → types of spaces required → rest of
setup** — watches a live preview, and downloads a finished homespace: source
folder plus built `dist/`, ready to drag onto any free static host. Proposed
as two new work orders: **WO-21** (browser build seam) and **WO-22** (the
Builder itself). Fixes the adoption gap found in user testing: `init/new/
build` all assume a command line.

## TDD references

- §2 pipeline, §6 renderer purity — the browser seam must not change either
- §4 homespace manifest, §8 archetypes — space types are composition
- §5.2 determinism — browser build must equal CLI build
- §5.3 a11y baseline, §10.2 offline budget — apply to the Builder page itself
- §11 — **amendment required**: append WO-21 and WO-22; add a Builder section
  to the TDD (do the amendment first, per CLAUDE.md)
- §5.4 — likely clarification: bundler as a devDependency (runtime budget
  unchanged)

## Context

Persona bar (from client-need roleplay, 2026-08-04): doesn't know what a
command line is; nearly walked away at the first mention of money; trust
hinges on "no account, no card, nothing leaves my computer." The Builder is
the product answer: not just an installer — it customizes the site so it's
**ready from the beginning**, never empty, never mid-setup.

Design stance (proposed): the Builder is **itself a static page**, shipped as
part of the docs homespace (dogfooding), zero external requests, works
offline once loaded. All work happens client-side: wizard state → in-memory
homespace (manifest + starter packs) → in-browser scan/render → live preview
in an iframe → **Download** (one zip: source + `dist/` + plain-language
guide). Nothing is uploaded anywhere; the UI says so explicitly.

## Scope

- **In scope:** the fs-access seam in scanner/renderer; schema loading
  without import-time `readFileSync` (embedded/precompiled schemas); a new
  `packages/builder/`; starter-pack content per space type; the humans guide;
  docs-homespace integration; TDD amendments above.
- **Out of scope / do NOT touch:** contracts §3/§4 semantics; CLI behavior
  (Node path stays byte-identical); the serve daemon; day-2 editing of an
  existing folder (see Notes — natural WO-23); any hosting-vendor
  integration or account flow. **Ruled:** the hosting guide *names* one
  golden-path host (vendor picked by the human) with click-by-click steps,
  plus a generic fallback page — but we never integrate, resell, or require
  an account on our side.

## Likely files / areas

- `packages/scanner/src/scan.ts` — inject a file-access interface (default
  `node:fs`); browser side supplies an in-memory tree
- `packages/renderer/src/render.ts` — same seam for its reads; `write.ts`
  stays Node-only — the browser path collects `OutputFiles`/`CopyOps` from
  memory and zips them
- `packages/schema/src/validate.ts` — schemas embedded at build time
- `packages/serve/src/zip.ts` — a zip *writer* already exists here for
  tests; decide a shared home rather than duplicating
- `packages/builder/` — new: wizard UI (hand-rolled, no framework, per house
  style), preview harness, zip download
- `docs/` — the Builder mounted in the docs homespace; hosting guide page
- `archetypes/` — starter-pack sources per space type

## Requirements (acceptance criteria)

### WO-21 — browser seam (gate for WO-22)

- [ ] Scanner and renderer accept an injectable file-access interface;
      default remains `node:fs` and **all existing tests pass unchanged**.
- [ ] A browser bundle builds the sample fixture from an in-memory tree;
      **golden test: output is byte-identical to `npx homespace build`** on
      the same source.
- [ ] Schema package no longer reads from disk at import time.

### WO-22 — the Builder

- [ ] **Step 1 — Name of Space:** display title, tagline, language; slug
      derived automatically (shown, editable, never required).
- [ ] **Step 2 — Types of Spaces (multi-select):** art gallery, writing,
      games, apps & toys, links — driven by the section registry, so music
      appears automatically once WO-15's `audio` section lands. Each
      selection contributes sections, nav entries, and a starter pack.
- [ ] **Step 3 — Rest of setup:** layout mode (three modes, described in
      plain language), theme via friendly controls mapped to the design
      tokens (colors, corner roundness, page width, font scale — **ruled:
      system font stacks only at v1**; bundled fonts are a later theme
      upgrade), footer text. Every change re-renders the live preview.
- [ ] **Plug in your own assets (ruled).** Every asset-bearing field in the
      wizard — site icon and banner, gallery images, a first post, game/app
      builds, link icons — accepts a local file, added client-side to the
      in-memory tree, so the site launches with *the user's* content
      wherever they have it ready. Skipped fields fall back to **basic
      neutral defaults** (simple geometric placeholders, no Kwatlp
      branding).
- [ ] **Ready from the beginning:** every chosen space renders non-empty —
      user assets where plugged in, neutral starter packs where skipped;
      the download includes a plain-language `START-HERE.md` ("to add art,
      put images in this folder…") with no jargon; nav is pre-built.
- [ ] **Download — two buttons (ruled):** **"Your website"** (the built
      `dist/` as a drag-this-online zip) and **"Your master copy"** (the
      source folder plus `START-HERE.md`, to keep safe). The website zip
      deploys as-is; the master copy rebuilds it byte-identically with
      `npx homespace build` (golden test again, from a wizard-produced
      site).
- [ ] **Mobile and PC from the start (ruled):** the wizard is fully usable
      on a phone — single-column flow, touch-sized controls, asset plug-in
      through the native mobile picker/camera roll, downloads that work in
      mobile browsers — and equally at home on desktop. The live preview
      gets a phone/desktop viewport toggle, and wizard-produced sites pass
      the same phone-width + desktop check.
- [ ] **Trust properties, enforced:** no network requests after page load
      (the Builder passes the offline-budget gate itself); no account, no
      telemetry, no upload — content never leaves the browser; keyboard
      accessible per §5.3. The docs homespace hosting it stays readable with
      JS disabled; the Builder page states plainly that it needs JS.

## Verification

- `npm run typecheck` and `npm test` pass; golden tests (fixture and
  wizard-output) prove browser ≡ CLI byte-for-byte.
- Manual: load the Builder from the docs homespace, go offline, create a
  site using every space type, download, serve `dist/` from a local static
  server, browse it with JS disabled.
- Repeat the entire run on a phone: wizard, asset plug-in from the camera
  roll, both download buttons, and the finished site browsed at phone
  width.
- Network panel shows zero requests after initial page load.

## Git / publish

- **Commit message:** `feat: the Builder (WO-21 browser seam + WO-22 wizard)`
- **Branch / PR:** `feat/builder` → PR to `main` (WO-21 may land as its own
  PR first)
- **Push?** leave to the human.

## References

- `internal-docs/HomespaceTDD.md` §2, §4–§6, §8, §10.2, §11
- `internal-docs/requests/_meta/001-v0.2.0-review-remediations.md` — roadmap this
  extends; WO numbering continues from it
- Client-need roleplay findings (chat, 2026-08-04)

## Notes for the human / Claude Code

- Amend §11 (WO-21, WO-22) and add the Builder TDD section **first**.
- WO-21 is a pure refactor and a clean standalone PR; WO-22 shouldn't start
  until its golden test is green.
- **Day-2 editing** — reopening an existing homespace folder in the Builder
  to add packs or re-theme — is the natural **WO-23**. Out of scope here,
  but the seam and zip layout must not preclude it.
- Doesn't block WO-13/14; runs parallel to the 001 roadmap. WO-15 enriches
  Step 2 when it lands.
- The zip writer currently lives in `serve` for tests — pick one shared home.
- Design rulings folded 2026-08-06 (human-approved): two-button download,
  golden-path + fallback hosting guide, neutral defaults with per-field
  asset plug-in, system fonts at v1. **Still open (human decision): which
  host is the golden path** — guide structure doesn't depend on the pick,
  but mobile-first narrows it: the vendor must offer a publish path that
  works from a phone browser (e.g. zip upload through a web form), because
  "drag the folder" is a desktop-only metaphor.
