# kwatlp

A **kit for composing self-hosted nodes** — single, operator-owned public
websites that hold whatever their creator brings: apps, games, art, writing,
links-with-depth, or arbitrary HTML. A node builds to **plain static files** you
can drop on any host, loads with **zero external resource requests**, and stays
readable with JavaScript disabled.

A [Kwatlp](internal-docs/KwatlpTDD.md) studio project. MIT licensed. Node ≥ 20.

> `kwatlp` is a working name; final naming is the operator's call and follows
> the studio's Nlaka'pamux sourcing practice.

> **Status:** pre-release. The design is locked and detailed in the
> [Technical Design Document](internal-docs/KwatlpTDD.md); implementation
> proceeds in work-order sequence (TDD §11). Building the code? See
> [CONTRIBUTING.md](CONTRIBUTING.md) and [CLAUDE.md](CLAUDE.md).

## Locked principles

1. **Operator-write only.** Only the hosting operator (or a linked system given
   a scoped key) writes to a node. No visitor accounts, signups, or validation
   flows, anywhere.
2. **Visitors need nothing.** Browse, play, read, download — zero accounts, zero
   gatekeeping.
3. **Distribution is the link.** Sharing a node means sharing its URL. No
   federation protocol, no directory. The web is the network.
4. **Minimum floor = static files.** A complete node builds to plain files
   deployable on any static host or cheapest VPS. Docker/databases/daemons are
   strictly optional tiers.
5. **Zero external dependency to use a node.** No CDN fonts, scripts, styles, or
   emulator cores — every resource a page loads ships in `dist/`. (Outbound
   *navigation* links are the point, and allowed.)
6. **Fully customizable composition.** Layout, sections, and theme are
   creator-chosen via exposed, designer-friendly variables. Archetypes are
   presets, not products.
7. **Escape hatches are a feature.** Raw HTML sections and freeform manifest
   fields let a node hold what we didn't anticipate.
8. **Quality over schedule.** Modular, tested, documented; shareable when ready.

## How a node works

A creator's folder holds content packs and a composition manifest; the build
turns them into a static site:

```
my-node/
├── node.manifest.jsonc      ← composition + theme (Contract #2)
├── theme/                   ← custom.css (optional), self-hosted fonts/
├── static/                  ← copied verbatim to dist/ (favicon, CNAME, …)
├── content/
│   └── packs/<id>/          ← one folder + manifest.json each (Contract #1)
└── dist/                    ← build output; deploy this anywhere

pipeline:  scanner(content/) → catalog.json → renderer(catalog + node.manifest) → dist/
```

- **Packs** are the unit of everything publishable: `game | app | art | post |
  link | bundle`. A folder plus a `manifest.json`. Media on disk stays media on
  disk — no blobs in a database, ever.
- **The node manifest** composes ordered sections (`hero, links, packs, posts,
  gallery, embed, html`) over a layout (`scroll | pages | grid`) and a theme
  driven entirely by designer-facing tokens.

## Tiers

| Tier | What runs | Who it's for |
|---|---|---|
| **0 — Static** | `kwatlp build` → `dist/` of plain files | Everyone; the default |
| **1 — Dev** | `kwatlp dev` local preview + watch/rebuild | The operator, locally |
| **2 — Daemon** | `kwatlp serve`: watch-rebuild, upload API, linked-system keys | Operators who want remote publish or app integrations |

Tier 2 is additive; nothing in tiers 0–1 depends on it.

## Quick start (target UX)

```bash
npx kwatlp init author my-node   # scaffold from an archetype
cd my-node
npx kwatlp build                 # → dist/, deploy anywhere
# or:
npx kwatlp dev                   # local preview + live rebuild
```

Restyle the entire node by editing `theme.tokens` in `node.manifest.jsonc`. Drop
a folder + `manifest.json` into `content/packs/`, rebuild, and it appears — a web
game plays in-browser, a post renders with RSS.

## Archetypes (v0 ships four)

| Archetype | Layout | Focus |
|---|---|---|
| **link-hub** | scroll | linktree-with-depth; smallest promise |
| **author** | pages | writing-first; RSS on |
| **illustrator** | grid | image-first; gallery + lightbox |
| **game-designer** | scroll | packs of playable games/apps + dev log |

Each ships an annotated `node.manifest.jsonc`, `theme/` (OFL fonts vendored),
sample packs, and a `THEME.md` documenting every exposed variable.

## Repository map

- `packages/` — `schema`, `scanner`, `renderer`, `cli`, and (Tier 2) `serve`
- `archetypes/` — the four v0 presets
- `examples/` — fixture nodes used by tests
- `docs/` — public docs (the docs site is itself a node — dogfooding)
- `internal-docs/` — private planning, incl. the
  [TDD](internal-docs/KwatlpTDD.md)
- `code-requests/` — internal change-request workflow (see
  [CLAUDE.md](CLAUDE.md))

## Development

```bash
npm install
npm test          # vitest across all packages
npm run typecheck # tsc --build (strict)
```

Contributions follow the work-order sequence and conventions in the
[TDD](internal-docs/KwatlpTDD.md); see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE). All dependencies are OSI-approved; third-party
notices live in [THIRD_PARTY.md](THIRD_PARTY.md).
