# homespace

A **kit for composing self-hosted homespaces** — single, operator-owned public
websites that hold whatever their creator brings: apps, games, art, writing,
links-with-depth, or arbitrary HTML. A homespace builds to **plain static files** you
can drop on any host, loads with **zero external resource requests**, and stays
readable with JavaScript disabled.

A [kʷátɬp](internal-docs/HomespaceTDD.md) studio project. MIT licensed. Node ≥ 20.

> `homespace` is a working name; final naming is the operator's call and follows
> the studio's Nlaka'pamux sourcing practice.

> **Status: v0.3.0.** All eleven work orders (TDD §11) are complete — schema,
> scanner, renderer (three layouts, seven section types, player, thumbnails),
> the `homespace` CLI, the four archetypes, and the optional Tier-2 daemon.
> v0.2.0 renamed the kit to **homespace** (WO-11); v0.3.0 adds the browser build
> seam (WO-21) and **the Builder** (WO-22) — zero-terminal creation. The design
> is detailed in the
> [Technical Design Document](internal-docs/HomespaceTDD.md). Building the code?
> See [CONTRIBUTING.md](CONTRIBUTING.md) and [CLAUDE.md](CLAUDE.md).

## Locked principles

1. **Operator-write only.** Only the hosting operator (or a linked system given
   a scoped key) writes to a homespace. No visitor accounts, signups, or validation
   flows, anywhere.
2. **Visitors need nothing.** Browse, play, read, download — zero accounts, zero
   gatekeeping.
3. **Distribution is the link.** Sharing a homespace means sharing its URL. No
   federation protocol, no directory. The web is the network.
4. **Minimum floor = static files.** A complete homespace builds to plain files
   deployable on any static host or cheapest VPS. Docker/databases/daemons are
   strictly optional tiers.
5. **Zero external dependency to use a homespace.** No CDN fonts, scripts, styles, or
   emulator cores — every resource a page loads ships in `dist/`. (Outbound
   *navigation* links are the point, and allowed.)
6. **Fully customizable composition.** Layout, sections, and theme are
   creator-chosen via exposed, designer-friendly variables. Archetypes are
   presets, not products.
7. **Escape hatches are a feature.** Raw HTML sections and freeform manifest
   fields let a homespace hold what we didn't anticipate.
8. **Quality over schedule.** Modular, tested, documented; shareable when ready.

## How a homespace works

A creator's folder holds content packs and a composition manifest; the build
turns them into a static site:

```
my-homespace/
├── homespace.manifest.jsonc      ← composition + theme (Contract #2)
├── theme/                   ← custom.css (optional), self-hosted fonts/
├── static/                  ← copied verbatim to dist/ (favicon, CNAME, …)
├── content/
│   └── packs/<id>/          ← one folder + manifest.json each (Contract #1)
└── dist/                    ← build output; deploy this anywhere

pipeline:  scanner(content/) → catalog.json → renderer(catalog + homespace.manifest) → dist/
```

- **Packs** are the unit of everything publishable: `game | app | art | post |
  link | bundle`. A folder plus a `manifest.json`. Media on disk stays media on
  disk — no blobs in a database, ever.
- **The homespace manifest** composes ordered sections (`hero, links, packs, posts,
  gallery, embed, html`) over a layout (`scroll | pages | grid`) and a theme
  driven entirely by designer-facing tokens.

## Tiers

| Tier | What runs | Who it's for |
|---|---|---|
| **0 — Static** | `homespace build` → `dist/` of plain files | Everyone; the default |
| **1 — Dev** | `homespace dev` local preview + watch/rebuild | The operator, locally |
| **2 — Daemon** | `homespace serve`: watch-rebuild, upload API, linked-system keys | Operators who want remote publish or app integrations |

Tier 2 is additive; nothing in tiers 0–1 depends on it. Its operator key comes
from `HOMESPACE_OPERATOR_KEY` (preferred) or a gitignored `homespace.serve.json`,
and a pack published through a **scoped key** is forced into the `strict`
sandbox — a linked system can publish to your homespace, never run script as it.

## Quick start (target UX)

```bash
npx homespace init author my-homespace   # scaffold from an archetype
cd my-homespace
npx homespace build                 # → dist/, deploy anywhere
# or:
npx homespace dev                   # local preview + live rebuild
```

No terminal? **The Builder** (`/builder/` in the docs homespace) asks three
groups of questions, previews the result live, and hands back the finished site
and its master copy as two zips. It runs the same scanner and renderer in the
browser — byte-identical output, no account, nothing uploaded.

Restyle the entire homespace by editing `theme.tokens` in `homespace.manifest.jsonc`. Drop
a folder + `manifest.json` into `content/packs/`, rebuild, and it appears — a web
game plays in-browser, a post renders with RSS.

`dist/` is owned by the build: every run makes it match your homespace exactly,
listing anything it removes. Files your host needs at the site root (`CNAME`,
`_headers`) belong in `static/`, which is copied verbatim into `dist/`.

## Archetypes (v0 ships four)

| Archetype | Layout | Focus |
|---|---|---|
| **link-hub** | scroll | linktree-with-depth; smallest promise |
| **author** | pages | writing-first; RSS on |
| **illustrator** | grid | image-first; gallery + lightbox |
| **game-designer** | scroll | packs of playable games/apps + dev log |

Each ships an annotated `homespace.manifest.jsonc`, `theme/` (OFL fonts vendored),
sample packs, and a `THEME.md` documenting every exposed variable.

## Repository map

- `packages/` — `schema`, `scanner`, `renderer`, `cli`, `zip`, (Tier 2) `serve`,
  and `builder` (the Builder: the same scanner and renderer running in a
  browser over an in-memory homespace, plus the wizard page)
- `archetypes/` — the four v0 presets
- `examples/` — fixture homespaces used by tests
- `docs/` — public docs (the docs site is itself a homespace — dogfooding)
- `internal-docs/` — private planning, incl. the
  [TDD](internal-docs/HomespaceTDD.md)
- `code-requests/` — internal change-request workflow (see
  [CLAUDE.md](CLAUDE.md))

## Development

```bash
npm install
npm test          # vitest across all packages
npm run typecheck # tsc --build (strict)
```

Contributions follow the work-order sequence and conventions in the
[TDD](internal-docs/HomespaceTDD.md); see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE). All dependencies are OSI-approved; third-party
notices live in [THIRD_PARTY.md](THIRD_PARTY.md).
