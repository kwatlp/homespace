# Homespace — Technical Design Document

**Name:** `homespace` — npm package, CLI bin, and unit noun (a creator runs "a homespace"). The kit ships fully generic; operator instances carry their own names — the author's instance is **kʷátɬp**.
**Status:** v1.2 — amended for the WO-12 review remediations and the adopted v0.3 sequence (WO-12…WO-20); actionable
**Supersedes:** `docs/CREATIVE_NODE_STACK.md` (retained as "the rough idea")
**Repo:** `homespace` (renamed from `kwatlp-node` in WO-11) — an independent platform, not a tmíxʷ feature. tmíxʷ participates as a *pack*.
**License:** MIT. All dependencies OSI-approved only.

---

## 0. How to use this document (Claude Code)

- Build strictly in **work-order sequence** (§11). Each work order (WO) has explicit exit criteria; do not start WO-N+1 until WO-N's tests pass.
- The two contracts in §3 and §4 are the source of truth. If implementation pressure suggests changing a contract, amend this TDD first, then code.
- New runtime dependencies require an amendment to §5.4 (dependency budget). Do not add packages ad hoc.
- Every WO lands with tests (vitest). The **offline-budget test** (§10.2) is a permanent CI gate from WO-3 onward.
- Conventions for all sessions are in Appendix A.

---

## 1. Product definition

A **homespace** is one independently operated, self-hosted public website that holds whatever its creator brings: apps, games, art, writing, links-with-depth, or arbitrary HTML. The platform is a **kit** for composing such homespaces, not a fixed site.

### 1.1 Locked principles (decisions, not aspirations)

1. **Operator-write only.** Only the hosting system (the operator) writes to a homespace — or *linked systems explicitly granted permission* (scoped keys, §9.3). There are no visitor accounts, no signup, no validation flows, anywhere.
2. **Visitors need nothing.** Browse, play, read, download — zero accounts, zero gatekeeping.
3. **Distribution is the link.** Peer-to-peer means sharing your homespace's URL — in a bio, a message, a QR code. No federation protocol, no directory, no ActivityPub. The web is the network.
4. **Minimum resources floor = static files.** A complete homespace must build to plain files deployable on any static host or cheapest VPS. Docker, databases, and daemons are strictly optional tiers.
5. **Zero external dependency to use a homespace.** No CDN fonts, scripts, styles, or emulator cores. Every resource a page loads ships in `dist/`. (Outbound *navigation* links are of course allowed — that's the point.)
6. **Fully customizable composition.** Layout, sections, and theme are creator-chosen via exposed, designer-friendly variables. Archetypes are presets, not products.
7. **Escape hatches are a feature.** Raw HTML sections and freeform manifest fields exist so the homespace can hold what we didn't anticipate.
8. **Quality over schedule.** No time constraint. Modular, tested, documented; shareable when ready.

### 1.2 Tier model

| Tier | What runs | Who it's for |
|---|---|---|
| **0 — Static** | `homespace build` → `dist/` of plain files | Everyone; the default; author/link-hub/illustrator homespaces live here entirely |
| **1 — Dev** | `homespace dev` local preview server + watch | The operator, locally |
| **2 — Daemon** (§9) | `homespace serve` on operator hardware: watch-rebuild, upload API, linked-system keys | Operators who want remote publish or app integrations (e.g. tmíxʷ) |

Tier 2 is additive. Nothing in tiers 0–1 depends on it.

---

## 2. System overview

```
creator's folder (my-homespace/)
├── homespace.manifest.jsonc      ← Contract #2: composition/theme
├── theme/                   ← custom.css (optional), fonts/ (self-hosted)
├── static/                  ← copied verbatim to dist/ (favicon, CNAME, anything)
├── content/
│   └── packs/<id>/          ← Contract #1: one folder + manifest.json each
│       ├── manifest.json
│       └── …files (builds, images, index.md, …)
└── dist/                    ← build output; deploy this anywhere

pipeline:  scanner(content/) → catalog.json → renderer(catalog + homespace.manifest) → dist/
```

- **scanner**: walks packs, validates manifests, verifies checksums (flagged), emits deterministic `catalog.json`.
- **renderer**: pure function of `(catalog, homespace manifest, theme files)` → static HTML/CSS + minimal inline/self-hosted vanilla JS. No framework in output.
- **cli**: `init | new | validate | build | dev | serve*` (*tier 2, separate optional package).

---

## 3. Contract #1 — Pack manifest (`content/packs/<id>/manifest.json`)

Everything publishable is a pack: a directory plus `manifest.json`. Evolves the rough-idea format; changes are marked ★.

```json
{
  "id": "solterra-demo",
  "type": "game",
  "title": "Solterra Demo",
  "summary": "One short sentence.",
  "version": "1.0.0",
  "entrypoint": {
    "web": "index.html",
    "download": "dist/game.zip",
    "post": "index.md",
    "link": "https://elsewhere.example/thing"
  },
  "media": {
    "cover": "cover.webp",
    "gallery": ["a.webp", "b.webp"]
  },
  "checksums": { "dist/game.zip": "sha256:…" },
  "tags": ["rpg", "html5"],
  "license": "MIT",
  "created": "2026-08-01T00:00:00Z",
  "updated": "2026-08-01T00:00:00Z",
  "discussion_url": "https://…",
  "sandbox": "standard",
  "extra": {}
}
```

**Field rules**

- `type` ★: `"game" | "app" | "art" | "post" | "link" | "bundle"`.
  - `post` ★ — long-form writing; `entrypoint.post` points at a markdown file. Dev logs are posts. Writing rides the same seam as everything else.
  - `link` ★ — an outbound destination *with depth*: cover, summary, gallery, tags. This is the "linktree but deeper" unit.
- `entrypoint`: only the keys relevant to the type are required (`web` and/or `download` for game/app; `post` for post; `link` for link; none required for art).
- `checksums`: required for every `download` entry; scanner verifies with `--verify`.
- `sandbox` ★: `"standard" | "strict"` — player isolation level, see §6.4. Default `standard`.
- `extra` ★: freeform object, passed through to templates untouched. Escape hatch per principle 1.1.7.
- Unknown top-level fields: **warn, keep, pass through**. Never a hard error (forward compatibility + "holds whatever the creator brings").
- All paths are relative to the pack folder; scanner rejects any path escaping it (§12).

**Media on disk stays media on disk.** Files are served as files. No blobs in a database, ever.

---

## 4. Contract #2 — Homespace manifest (`homespace.manifest.jsonc`)

The composition layer. JSONC (JSON + comments) so archetype presets can be annotated inline for designers; parser strips comments before schema validation.

```jsonc
{
  "$schema": "https://…/homespace.manifest.schema.json",
  "name": "cedar",                 // machine slug
  "title": "Cedar Grove",                // display
  "tagline": "cedar, roots, worlds",
  "lang": "en",

  // ── Browser-tab icon ─────────────────────────
  // Homespace-relative path, resolved like a section's `media`. Any image
  // format the browser knows; the renderer emits <link rel="icon"> with the
  // matching `type`, so an icon keeps whatever format it arrived in.
  "icon": "static/icon.png",

  // ── Local address (dev/serve) ────────────────
  // The homespace's local URL is part of its identity: http://<host>.local:<port>
  "local": { "host": "cedar", "port": 4321, "mdns": false },

  // ── Layout mode ──────────────────────────────
  // "scroll" = one long scrollable page (the "scrollable web")
  // "pages"  = each section becomes its own page + nav
  // "grid"   = landing grid of section tiles
  "layout": "scroll",

  // ── Designer-facing variables ────────────────
  "theme": {
    "tokens": {
      "color":  { "bg": "#14100c", "surface": "#1f1813", "text": "#f3e9dd", "accent": "#d97b4a" },
      "font":   { "body": "theme/fonts/inter.woff2", "display": "theme/fonts/fraunces.woff2", "scale": 1.0 },
      "space":  { "unit": 8 },
      "radius": 10,
      "maxWidth": 760
    },
    "css": "theme/custom.css"       // optional; loaded last; full override power
  },

  "nav": [ { "label": "Play", "href": "#packs" } ],

  // ── Sections: ordered composition ────────────
  "sections": [
    { "type": "hero",    "heading": "…", "sub": "…", "media": "static/hero.webp" },
    { "type": "links",   "title": "Elsewhere", "source": { "types": ["link"] } },
    { "type": "packs",   "title": "Games & Apps", "source": { "types": ["game", "app"] }, "style": "cards" },
    { "type": "posts",   "title": "Dev Log", "source": { "types": ["post"] }, "style": "feed", "rss": true },
    { "type": "gallery", "title": "Art", "source": { "types": ["art"] } },
    { "type": "embed",   "src": "static/toy.html", "height": 420 },
    { "type": "html",    "file": "sections/anything.html" }   // escape hatch: raw, verbatim
  ],

  "footer": { "text": "© Cedar Grove", "links": [] }
}
```

**Section registry (v0):** `hero, links, packs, posts, gallery, embed, html`. Each is a renderer module with a config schema. Adding a section type = new module + schema + golden test; the registry is the extension point.

**`source` filters:** `{ "types": [...], "tags": [...], "ids": [...], "sort": "created|updated|title", "limit": n }` — resolved against `catalog.json`.

**Archetype = preset.** An archetype is exactly: one annotated `homespace.manifest.jsonc` + `theme/` defaults + sample packs + a `THEME.md` explaining every exposed variable in designer language. Nothing else. `homespace init <archetype>` copies it.

**Detail pages** are generated regardless of layout: `dist/packs/<id>/` for game/app/art/bundle, `dist/posts/<slug>/` for posts. `link` packs render as cards only (their destination *is* the page).

> **Amendment (request `003`, item 7) — `icon`.** Optional,
> homespace-relative, resolved exactly like a section's `media` (so
> `static/icon.png` lands at the dist root). Every page emits
> `<link rel="icon" href="…" type="…">`, the type inferred from the extension;
> an unknown extension emits the link without a `type` rather than guessing.
> A missing file is a **warning**, not an error — a tab icon is never worth
> failing a build over. Rationale: before this, the Builder wrote any uploaded
> bytes to `static/favicon.ico`, so a PNG was served as an ICO and browsers
> that respect the declared format showed nothing.

---

## 5. Repository structure & module boundaries

```
homespace/
├── packages/
│   ├── schema/       # JSON Schemas (pack, homespace, catalog) + generated TS types + validate()
│   ├── scanner/      # content/ → catalog.json  (pure; no rendering knowledge)
│   ├── renderer/     # (catalog, homespace manifest) → dist/  (pure; no fs-walking knowledge)
│   ├── cli/          # homespace init|new|validate|build|dev  (thin orchestration)
│   ├── serve/        # TIER 2 ONLY — optional daemon; nothing else imports it
│   ├── zip/          # dependency-free, isomorphic ZIP writer (one shared home)
│   └── builder/      # the Builder (§15): browser build path + wizard; no fs, no network
├── archetypes/
│   ├── link-hub/     # linktree-with-depth
│   ├── author/
│   ├── illustrator/
│   └── game-designer/
├── examples/         # fixture homespaces used by tests
├── docs/             # docs site is itself a homespace (dogfooding, WO-10)
├── LICENSE           # MIT
└── THIRD_PARTY.md
```

### 5.1 Runtime & language
TypeScript (strict), Node ≥ 20, npm workspaces. CLI bundled with esbuild; runnable via `npx homespace`.

> **WO-11 amendment (naming):** the `@homespace` npm scope was not claimed, so
> packages publish **unscoped** — `homespace-schema`, `homespace-scanner`,
> `homespace-renderer`, `homespace-cli`, `homespace-serve` — with a thin public
> launcher package named `homespace` exposing the `homespace` bin.

### 5.2 Output constraints (hard)
- Output is static HTML + CSS + minimal vanilla JS (lightbox, player shell). **No framework, no bundle, no external request** in `dist/`.
- Core browsing/reading must work with JavaScript disabled. JS enhances (lightbox, player chrome); it never gates content.
- Deterministic builds: stable ordering, no timestamps in output (build stamp behind `--stamp` flag only).
- **`dist/` is wholly build-owned** (ruled WO-12). A build writes exactly its render result — generated files, asset copies, thumbnails — and **prunes anything else it finds there**, listing every removed path as a warning. Deleting or renaming a pack, section, or theme file therefore leaves no orphans. Hand-placed deploy files (`CNAME`, `_headers`, `_redirects`, host config) belong in **`static/`**, which is copied verbatim to the dist root and so survives pruning; that is the supported passthrough. Never hand-edit `dist/`, and never point `--out` at a directory that holds anything else.

### 5.3 Accessibility & responsive baseline
Semantic HTML landmarks; every media entry supports `alt` (manifest `media.alt` map, ★ add to schema); token defaults in archetypes pass WCAG AA contrast; keyboard-reachable player and lightbox.

**Mobile and PC are first-class from the start** (ruled 2026-08-06). Every user-facing work order's exit criteria include a **phone-width check and a desktop check**. Layouts reflow to a single column at phone width with no horizontal scrolling; media and embeds scale to the viewport; interactive controls (player chrome, lightbox, and later the Builder wizard) are touch-sized and reachable one-handed. Responsive behavior is part of this baseline, not a polish pass.

**Known gaps** (found in the WO-12 spot-check across all four archetypes; fix in the next user-facing WO, per the ruling that WO-12 records rather than fixes them):

- `base.css` constrains `.hero img`, `.card img`, `.gallery img`, and `.prose img`, but a **detail page's cover image carries no class** — a cover wider than the viewport scrolls the page sideways on a phone. A single `img { max-width: 100%; height: auto }` rule closes it.
- Markdown **tables** (GFM) have no styling and no overflow container, so a wide table in a post overflows at phone width.

### 5.4 Dependency budget (runtime deps; amend here before adding)
| Package | Purpose | License |
|---|---|---|
| `ajv` | schema validation | MIT |
| `micromark` (+gfm ext) | markdown for posts; raw HTML **off** by default | MIT |
| `sharp` | *optional* thumbnails; build degrades gracefully without it | Apache-2.0 |
| `chokidar` | dev/serve watch | MIT |
| `bonjour-service` | *optional* mDNS advertising for `local.host` (§7.1) | MIT |
| `esbuild` | (dev-time) CLI bundling | MIT |
| `vitest` | (dev-time) tests | MIT |

No postinstall scripts. Lockfile committed. Anything else needs a TDD amendment.

> **Clarification (WO-21):** `esbuild` covers the Builder's browser bundle as
> well as CLI bundling. Both are **dev-time**; the runtime budget above is
> unchanged, and nothing the Builder ships to a visitor is a dependency.

---

## 6. Renderer specification

### 6.1 Pipeline
`render(catalog, homespaceManifest, themeDir, staticDir) → dist/` — pure, testable, no network.

1. Compile `theme.tokens` → CSS custom properties (`tokens.css`), embed fonts via `@font-face` (self-hosted files only; error on http(s) font paths).
2. Base stylesheet (`base.css`) consumes tokens exclusively — restyling = editing tokens, matching "designer-friendly variables exposed".
3. Render layout shell per `layout` mode; render sections in order via the section registry.
4. Generate detail pages, `catalog.json` (public copy), `feed.xml` (RSS) for any posts section with `rss: true`, `sitemap.txt`.
5. Copy `static/` verbatim; copy pack files; write `.thumbs/` if sharp present.

### 6.2 Layout modes
- **scroll** — sections stacked on `index.html`; nav anchors.
- **pages** — `index.html` = first section or hero; each other section at `/<section-slug>/`; shared nav.
- **grid** — `index.html` = tile per section linking into page-mode routes.
Same section modules everywhere; layout only changes placement/chrome.

### 6.3 Markdown (posts)
micromark, GFM, raw HTML disabled by default. Homespace-level opt-in `"markdown": { "allowHtml": true }` for operators who want it (operator-authored content; documented risk). Relative links/images resolve within the pack folder.

### 6.4 Player & downloads (game/app packs)
- Detail page embeds `entrypoint.web` in an `<iframe>`:
  - `sandbox="allow-scripts allow-pointer-lock allow-fullscreen"` +, in **standard** mode, `allow-same-origin` (needed by Godot/Unity persistence).
  - **strict** mode (`"sandbox": "strict"` in the pack) omits `allow-same-origin` → opaque origin. Recommend strict for any pack the operator didn't author.
- Player chrome: fullscreen button, load-on-click (no autoload of heavy WASM), gamepad note.
- Downloads: plain `<a>` to the file + rendered sha256. Range requests are the host's job; document nginx/Caddy one-liners for tier-2/VPS operators.
- Tier-2 daemon supports an optional second listen address for a separate games origin; static-tier docs show the two-subdomain pattern for operators who want it.

**Enforcement point (amended WO-12).** The **default stays `standard`** — a strict sandbox gives the frame an opaque origin, which breaks Godot/Unity web builds (their `.pck`/`.wasm` fetches become cross-origin) and kills save-game `localStorage`. `strict` is therefore not a global default but an *enforced* mode for content the operator didn't author:

- A pack installed through a **scoped key** (§9.3) has `"sandbox": "strict"` written into its manifest **at install time**; the uploader cannot override it.
- The renderer never offers a **same-origin top-level** path to a strict pack's HTML. The no-JS fallback for a strict pack is its **download link** (or a plain note when it has no download), not "open the build directly" — a top-level document would run with the homespace's origin and defeat the sandbox.
- Docs state plainly: manually relaxing `strict` on a pack a linked system published means trusting that system with your origin. **WO-19** (cross-origin pack serving) is the structural fix; this is the interim control.

### 6.5 `html` section & `extra`
`{ "type": "html", "file": … }` is inserted verbatim (operator-authored by definition). `pack.extra` is exposed to templates untouched. These are the "holds whatever the creator brings" guarantees.

### 6.6 File-access seam (WO-21)
`scan()` and `render()` read the filesystem through a small injected interface —
`kind` / `list` / `read` / `readText` — defaulting to `node:fs`. The Builder
passes an in-memory tree instead, so the identical code produces the identical
bytes in a browser (§15). `writeDist` stays Node-only: it is the one module that
writes, and the browser path takes the render result and zips it instead.

---

## 7. CLI specification

| Command | Behavior |
|---|---|
| `homespace init <archetype> [dir]` | Copy archetype preset; print next steps. Errors if dir non-empty. |
| `homespace new pack <type> <id>` | Scaffold `content/packs/<id>/` with a commented manifest for that type. |
| `homespace validate` | Validate homespace manifest + all packs; `--verify` also checks checksums. Exit ≠ 0 on error; warnings listed. |
| `homespace build` | validate → scan → render → `dist/`. `--out`, `--verify`, `--stamp`. |
| `homespace dev` | build, serve `dist/` on localhost, watch & rebuild. Correct MIME + COOP/COEP headers toggle (`--coi`) for threaded WASM builds. |
| `homespace serve` | Tier 2 (§9); only if `homespace-serve` is installed. |

Error voice: plain language, path + fix suggestion. The audience is designers, not sysadmins.

### 7.1 Local address customization

`localhost` is an OS convention, not a brand. The homespace's local address is creator-configurable via `homespace.manifest.local` — the address is part of the identity:

- **Port** — `local.port` (default 4321); `--port` overrides.
- **Hostname** — `local.host` (defaults to `name`). With `local.mdns: true`, `dev`/`serve` advertise `<host>.local` via mDNS/Bonjour: the homespace becomes `http://cedar.local:4321` for every device on the network — zero-infrastructure LAN sharing. Enabling mDNS also binds to the LAN interface; the default (`mdns: false`) binds 127.0.0.1 only, so LAN visibility is always an explicit operator choice.
- **Naming rules** — `.local` is the mDNS standard; `.test` is safe for hosts-file use. Never suggest `.dev` or other real TLDs (`.dev` is HSTS-preloaded — browsers force HTTPS and break plain-HTTP local serving). `homespace dev --hosts-hint` prints the `/etc/hosts` line for a machine-only custom name without mDNS.
- **Caveat** — `localhost` is a secure context; `<host>.local` over plain HTTP is not. Packs relying on secure-context APIs (WebGPU, service workers) may need the localhost URL or a future local-TLS option. Startup output prints both URLs.

---

## 8. Archetypes (v0 ships four)

| Archetype | Layout | Sections (preset) | Notes |
|---|---|---|---|
| **link-hub** | scroll | hero, links, posts(limit 3) | The linktree-with-depth; adoption entry point; tier-0 only; smallest promise |
| **author** | pages | hero, posts(rss), links | Writing-first; RSS on |
| **illustrator** | grid | hero, gallery, links | Image-first; thumbnails matter; lightbox |
| **game-designer** | scroll | hero, packs(cards), posts(rss), links | The game-studio shape (the author's kʷátɬp instance); tmíxʷ lives here as a `type: app` pack |

Each ships: annotated `homespace.manifest.jsonc`, `theme/` (OFL-licensed fonts only, licenses vendored), 2–4 sample packs, `THEME.md` documenting every variable in designer language.

---

## 9. Tier 2 — daemon (`homespace-serve`) — build LAST

Optional package for operators who want remote publish or app integrations. Static tiers must never require it.

### 9.1 Behaviors
Watch `content/` + manifests → rebuild; serve `dist/` with range requests; structured logs.

### 9.2 Operator write API
`PUT /api/packs/:id` (zip) → zip-slip-safe unpack to temp → validate → move into `content/packs/` → rebuild. Auth: single operator bearer key from env/config. No user system.

**Hardening (amended WO-12).** The write API is the one place a homespace accepts bytes it did not author, so:

- **Bodies are spooled to a temp file, never buffered in RAM**, under a configurable cap — **1 GiB default**, sized for full game builds rather than short posts. Over the cap → `413`, connection destroyed.
- **Archive expansion is capped**: per entry, in total, and by entry count; entries are inflated straight to disk. A zip bomb returns `400`, never an OOM.
- Every entry's **CRC-32 is verified**; archives the reader cannot faithfully represent (ZIP64, encrypted entries, unsupported compression methods, the u16 entry-count ceiling) are rejected with a clear error rather than half-read.
- **Installation is atomic**: the prior pack is renamed aside, the new one moved in, and the prior one restored if the move fails. There is no window in which a successful publish leaves the pack directory missing.
- **Keys are compared with `crypto.timingSafeEqual`** (length-guarded), operator and scoped alike.
- The operator key is read from **`HOMESPACE_OPERATOR_KEY` first**, `homespace.serve.json` second; that file is gitignored and never rendered into `dist/` (§12).

### 9.3 Linked systems ("linked systems with permissions")
Scoped keys: `{ key, scopes: ["packs:write"], allowedTypes?, allowedIdPrefix? }`. Example: tmíxʷ holds a key scoped to `allowedIdPrefix: "tmixw-"` and publishes world-template packs to the operator's homespace. Keys are config entries the operator writes; there is no key-issuance UI in v0.

**A scoped key buys publishing, never the origin** (amended WO-12). Packs installed through a scoped key are forced to `"sandbox": "strict"` at install time and lose the same-origin direct-open path (§6.4). A linked system can put content on the homespace; it cannot run script as the homespace.

### 9.4 Explicitly absent
Accounts, sessions, comments, federation endpoints, analytics.

---

## 10. Testing strategy

1. **Schema fixtures** — valid/invalid manifest suites per type; unknown-field warn-and-keep covered.
2. **Offline-budget gate (permanent CI)** — crawl the build's **generated** HTML/CSS: no external URL may appear as a *resource load* (`<link href>`, `<script src>`, `<img src|srcset>`, `<video|audio|embed src>`, `<object data>`, `<source src|srcset>`, `<iframe src>`, `<video poster>`, CSS `url()` and `@import`). External `<a href>` allowed — navigation is the network. Build fails otherwise.
   - **Scope (affirmed WO-12).** The gate covers what the renderer *generates*. `static/` copies and **pack-authored HTML** — a game's own `index.html` — are deliberately **not** scanned: that is the escape hatch (principle 1.1.7), because a third-party web build is a black box the operator chose to host. Both still ship as files in `dist/`, so nothing loads from the network unless the operator put it there. `homespace doctor` (WO-20) surfaces bypassed files as **non-fatal warnings**, which is where that visibility belongs.
3. **Golden output** — snapshot `dist/` HTML per archetype × layout; deterministic builds make this cheap.
4. **Scanner snapshots** — fixture content trees → `catalog.json`.
5. **E2E CLI** — `init → build` per archetype in temp dir; assert structure, exit codes, error voice.
6. **Security tests** — path traversal fixtures (scanner), zip-slip fixtures (serve), markdown raw-HTML off by default.
7. **A11y smoke** — landmarks present, imgs have alt, token contrast check on archetype defaults.

---

## 11. Work orders (build sequence for Claude Code)

> Each WO = branch + tests + docs touched. Exit criteria are the acceptance tests.

- **WO-0 — Scaffold.** npm workspaces, TS strict, vitest wired, LICENSE, empty packages compile. *Exit:* `npm test` green.
- **WO-1 — Schemas.** `packages/schema`: pack/homespace/catalog schemas, TS types, `validate()`. *Exit:* fixture suites pass; unknown-field policy proven.
- **WO-2 — Scanner.** content → `catalog.json`; deterministic; `--verify` checksums; traversal-safe. *Exit:* snapshots + security fixtures green.
- **WO-3 — Renderer core.** tokens→CSS, scroll layout, sections `hero/links/packs/posts`, post markdown, detail pages. *Exit:* golden tests + **offline-budget gate live**.
- **WO-4 — CLI.** `init/new/validate/build/dev` (dev: serve+watch+`--coi`+local address per §7.1). *Exit:* e2e green, incl. port/host config paths (mDNS advertise mocked).
- **WO-5 — Layouts & sections complete.** `pages`, `grid`; `gallery/embed/html`; RSS; sitemap. *Exit:* goldens per layout; feed validates.
- **WO-6 — Player & downloads.** iframe player, standard/strict sandbox, load-on-click, checksum display; fixture web-build plays under `homespace dev`. *Exit:* manual checklist + dom tests.
- **WO-7 — Archetypes ×4.** Presets, THEME.md each, sample packs, OFL fonts vendored. *Exit:* `init X && build` clean for all four; a11y smoke green.
- **WO-8 — Media pipeline.** Optional sharp thumbnails; graceful absence. *Exit:* builds pass with and without sharp installed.
- **WO-9 — Daemon.** `homespace-serve` per §9. *Exit:* integration tests incl. zip-slip, scope enforcement.
- **WO-10 — Release.** docs/ rebuilt as a homespace (dogfood), THIRD_PARTY.md, `npx` path verified, v0.1.0. *Exit:* Definition of Done (§14) demonstrated end-to-end on a clean machine.
- **WO-11 — Rename to `homespace` & republish.** *(v0.2.0 — complete)* Sweep the codebase to match this document: packages `homespace-*` (claim the npm scope at publish; if unavailable, fall back to `homespace-schema` etc. and amend §5), CLI/bin `homespace`, repo `homespace`, manifest filename `homespace.manifest.jsonc` (loader accepts legacy `node.manifest.jsonc` with a deprecation warning for one minor version), scaffold dirs `my-homespace/`, all docs/THEME.md/error strings; no instance branding in samples or scaffolds. Publish `homespace` v0.2.0 to npm. Golden-diff guard: `dist/` output identical to v0.1.0 except renamed strings. *Exit:* §14 stranger-test passes against the **published** package on a clean machine; `grep -ri kwatlp` returns nothing; `grep -riE '\bnode\b'` returns only Node-runtime references.

### v0.3 sequence (adopted 2026-08-06 — request `001`)

Sequencing after WO-13 is flexible: WO-15, 16, 18, and 20 are independent of each other. No §5.4 dependency-budget changes are anticipated anywhere in this sequence — Node's `crypto` covers ed25519, and search/audio are hand-rolled per convention. Every user-facing WO below carries the §5.3 phone-width + desktop check in its exit criteria.

- **WO-12 — Review remediations.** Close the v0.2.0 full-code review: `dist/` pruning (§5.2), scoped-key packs forced `strict` with no same-origin direct-open (§6.4/§9.3), spooled 1 GiB uploads with decompression caps, timing-safe key comparison, key-file hygiene, atomic pack install, offline-budget pattern coverage, zip CRC/ZIP64 rejection, `escapeAttr` quoting, honest upload response codes, malformed-percent-encoding `400`, and the §10.2 escape-hatch documentation. *Depends:* —. *Exit:* new tests for pruning (incl. the `static/` passthrough), forced-strict installs, body cap + bomb zip, atomic install, and a regression case per small fix; archetypes and `docs/` still pass the budget gate.
- **WO-13 — `homespace push` (write-API client).** `homespace push <pack-dir> --to <url>` zips a pack, fills in missing sha256 checksums, and PUTs it with a bearer key (`HOMESPACE_PUSH_KEY` or `--key`) — the tmíxʷ → Kwatlp publishing seam. *Depends:* 12. *Amends:* §7. *Exit:* a fixture pack pushes to an in-process daemon and appears in `dist/` after rebuild; missing `checksums[entrypoint.download]` auto-added; 401/403/413/422 surface as path + problem + fix.
- **WO-14 — Dist manifest + incremental rebuild.** `writeDist` emits a deterministic manifest of every emitted path (+ hash); pruning diffs against it; the serve watcher maps changed sources to affected packs/pages and re-renders only those. *Depends:* 12. *Amends:* §5.2, §9.1. *Exit:* touching one pack rebuilds only that pack's pages plus shared indexes; incremental output byte-identical to a full rebuild.
- **WO-15 — `audio` section + musician archetype.** A playlist of local audio files from selected packs via native `<audio>`; no-JS degrades to file links. **Album model:** one pack = one album/EP, its media files are the tracks, ordered by a `tracks` list in the manifest. Fifth archetype: `musician`. *Amends:* §3 (`tracks`), §4 (registry), §8. *Exit:* section plays from a fixture; no-JS fallback works; budget gate and §5.3 baseline (incl. touch) pass.
- **WO-16 — Blog depth.** `posts` sections gain a page size; per-tag index pages and a date archive, linkable from nav. *Amends:* §4, §6. *Exit:* a 30-post fixture paginates; `/tags/<tag>/` and `/archive/` exist and are reachable; `feed.xml` unchanged; output deterministic.
- **WO-17 — Static search.** Build-time index (titles, tags, summaries, post text) + a search page with a small inline script; no dependency, no external request; JS off degrades to browsing. *Depends:* 14 (soft). *Amends:* §4. *Exit:* fixture queries return the expected packs; budget gate passes; usable as progressive enhancement only.
- **WO-18 — Pack signatures.** Optional detached ed25519 signature over a pack's checksums block via Node `crypto`. **Author-level:** pack authors sign, so provenance travels with the pack; operator countersigning can layer later. `--verify` checks signatures when the author's public key is configured. *Amends:* §3 (optional signature field), §7. *Exit:* signed fixture verifies; tampered file or signature fails clearly; unsigned packs unaffected.
- **WO-19 — Cross-origin pack serving (design-first).** Daemon option to serve `packs/*/files/**` from a second port so pack HTML is cross-origin to the shell; docs give the equivalent `packs.` subdomain pattern for static hosts. Resolve first: the renderer must emit absolute pack-asset URLs when configured, and §10.2 needs a "configured self-origins are not external" allowance. *Depends:* 12. *Amends:* §6, §9.1, §10.2. *Exit:* with the option on, player iframes and direct links use the pack origin while shell pages stay on the main origin; budget gate passes with the allowance.
- **WO-20 — `homespace doctor`.** One command checking a built homespace end to end: internal link/asset 404s, image alt coverage, checksum `--verify`, and a budget scan of the *whole* `dist/` — including `static/` copies and pack HTML — reported as warnings per §10.2. *Amends:* §7. *Exit:* fixtures with a broken link / missing alt / tampered checksum each report path + problem + fix; a clean homespace exits 0.

### The Builder (adopted 2026-08-06 — request `002`)

Runs parallel to the v0.3 sequence; does not block WO-13/14. Full design in §15.

- **WO-21 — Browser build seam.** Scanner and renderer take an injectable
  read-only file-access interface (default `node:fs`); the schema package stops
  reading from disk at import time; a browser bundle builds a fixture from an
  in-memory tree. A pure refactor — a clean standalone PR, and the gate for
  WO-22. *Amends:* §5.4 (bundler is dev-time), §6 (§6.6 seam), §15.
  *Exit:* all existing tests pass **unchanged**; golden test proves the browser
  bundle's output is **byte-identical** to `homespace build` on the same source.
- **WO-22 — The Builder.** A static, offline, no-account wizard — name → space
  types → rest of setup — with a live preview and two downloads ("your website"
  = `dist/`, "your master copy" = source + `START-HERE.md`). Ships inside the
  docs homespace (dogfooding). *Depends:* 21. *Amends:* §15, §8 (starter packs).
  *Exit:* every space type renders non-empty; the master copy rebuilds the
  website byte-identically with `homespace build`; zero network requests after
  page load; wizard and output both pass the §5.3 phone-width + desktop check.

---

## 12. Security & threat model

Content is operator-authored or operator-installed; there is no hostile-user write surface in tiers 0–1. Residual risks and controls:

| Risk | Control |
|---|---|
| Supply chain | Dependency budget (§5.4), lockfile, no postinstall |
| Malicious third-party pack the operator installs | `strict` sandbox recommendation; checksums; docs |
| Pack published by a **linked system** running script on the homespace origin | `strict` forced at install time for scoped-key uploads, not overridable by the uploader; no same-origin top-level path to a strict pack's HTML (§6.4); WO-19 is the structural fix |
| XSS via markdown | raw HTML off by default; opt-in is homespace-level and documented |
| Path traversal / zip-slip | scanner + serve normalize & confine; fixture tests |
| Upload resource exhaustion (huge body, zip bomb) | body spooled to disk under a configurable 1 GiB cap → `413`; per-entry, total, and entry-count decompression caps → `400`; CRC-32 verified; ZIP64/encrypted archives rejected (§9.2) |
| Daemon key leakage | keys in env/config only (`HOMESPACE_OPERATOR_KEY` preferred; `homespace.serve.json` gitignored); timing-safe comparison; scoped keys for linked systems; never rendered into `dist/` |
| Legal exposure of operators | Docs state plainly: the operator owns and answers for what their homespace serves, under their jurisdiction. The kit ships no content. |

---

## 13. Non-goals (v0 — deliberate)

Visitor accounts or identity of any kind; comments/forum in core (a future *linked system with permissions* may add one — out of scope here); federation protocols, ActivityPub, webring registries; centralized discovery, search-as-a-service (a prebuilt client-side index is a possible later WO); analytics/tracking; payments; CDN; recommendation; SaaS onboarding.

---

## 14. Definition of done (v0.1.0)

A stranger with Node 20 can:
1. `npx homespace init author my-homespace && cd my-homespace && npx homespace build`
2. Upload `dist/` to any static host (or run `homespace dev`) → a complete, branded homespace
3. Load it with **zero external resource requests** and JS disabled → still readable
4. Drop a folder + manifest into `content/packs/`, rebuild → it appears; a web game plays in-browser; a post renders with RSS
5. Restyle the entire homespace by editing `theme.tokens` only
6. Share the URL — that *is* distribution
7. (Tier 2, optional) run `homespace serve`, publish a pack remotely with the operator key; a scoped key lets tmíxʷ publish a world-template pack

No cloud API keys, no accounts, no external services for any of the above.

---

## 15. The Builder (WO-21 seam, WO-22 wizard)

`init`, `new`, and `build` all assume a command line. User testing found that
this is the adoption wall: the person we most want to reach has never opened a
terminal, and reaches for the exit at the first mention of an account or a card.
The Builder is the answer — **one web page** that asks three groups of
questions, shows a live preview, and hands back a finished homespace.

### 15.1 Trust properties (non-negotiable)

- **Nothing leaves the browser.** No upload, no account, no telemetry, no
  network request after page load. The Builder passes the offline-budget gate
  itself (§10.2), and says so on the page in plain language.
- It is a **static page inside the docs homespace** — the kit building the kit.
- The docs homespace stays readable with JavaScript off; the Builder page states
  plainly that it needs JavaScript, because a build engine does.

### 15.2 The browser seam (WO-21)

The browser runs the **same** scanner and renderer as the CLI. Only the edges
differ:

| Concern | Node (CLI) | Browser (Builder) |
|---|---|---|
| Reading sources | `node:fs` via the §6.6 interface | an in-memory tree from wizard state + the user's picked files |
| Schemas | embedded in the package (no import-time disk read) | same |
| Writing output | `writeDist` → `dist/` | render result → zip, offered as a download |
| Hashing (`--verify`) | `node:crypto` | not used; the shim refuses loudly |

The interface is declared **once per package** (scanner and renderer each own
their copy) so the two never import each other — the §5 boundary holds, and
structural typing means one implementation satisfies both.

**Determinism is the contract:** the browser build must be byte-identical to
`homespace build` on the same source (§5.2). That is a permanent golden test,
run both on a fixture and on a wizard-produced homespace.

### 15.3 The wizard (WO-22)

Three groups, in this order — the order a person thinks in:

1. **Name of Space** — display title, tagline, language; slug derived
   automatically, shown, editable, never required.
2. **Types of Spaces** (multi-select) — art gallery, writing, games, apps &
   toys, links. Driven by the section registry (§4), so a new section type
   (e.g. WO-15's `audio`) appears here automatically. Each choice contributes
   sections, nav entries, and a starter pack.
3. **Rest of setup** — layout mode in plain language, theme through friendly
   controls mapped to `theme.tokens` (colors, corner roundness, page width,
   font scale — **system font stacks only at v1**), footer text. Every change
   re-renders the live preview.

**Plug in your own assets.** Every asset-bearing field accepts a local file,
added client-side to the in-memory tree: site icon, banner, gallery images, a
first post, a game or app build, link icons. Skipped fields fall back to
**neutral geometric placeholders** — never studio branding.

**Ready from the beginning.** Every chosen space renders non-empty, nav is
pre-built, and the download carries a jargon-free `START-HERE.md`.

**Two downloads, deliberately:** *"Your website"* is the built `dist/` — drag it
online as-is. *"Your master copy"* is the source folder plus `START-HERE.md` —
keep it safe; `npx homespace build` reproduces the website from it byte for byte.

**Mobile and PC from the start** (§5.3): single-column flow and touch-sized
controls on a phone, asset plug-in through the native picker/camera roll,
downloads that work in mobile browsers, a phone/desktop viewport toggle on the
preview, and wizard-produced sites that pass the same checks.

> **Amendment (request `003`, items 2–8).** Six clarifications,
> all of them things the ruled criteria above already implied:
>
> - **One build slot per kind.** "Plug in your own assets" is per field, so a
>   game build and an app build are separate slots landing in separate packs.
>   One shared slot fed only the game pack, so an app upload went nowhere.
> - **Descriptions are collected, not invented.** Every chosen gallery image
>   gets a short description field, and what is typed lands in the pack's
>   `media.alt`. Blank keeps the numbered fallback — nothing ever ships with an
>   empty `alt` (§5.3). `START-HERE.md` teaches editing them later.
> - **Flat files only.** A browser's file picker hands over files without the
>   folders they were in, so a build with subdirectories (Unity, Godot) cannot
>   come through the page. The limit is **stated at the input**, and the
>   foldered export goes in through the master copy. A folder picker is future
>   work, deliberately not held against this release.
> - **The page is a classic script.** A module is fetched under CORS rules, and
>   `file://` has no origin to satisfy — so the page bundle is `iife`. Saving
>   the Builder and double-clicking it is a supported way to run it, which also
>   makes it usable with no internet at all.
> - **A picked asset can be un-picked.** Every asset field carries a control
>   back to the placeholder, and cancelling the picker keeps the prior choice —
>   an empty selection is a cancel, not a clear.
> - **The slug field shows the slug.** The folder-name input settles to the
>   value state holds when focus leaves it, so the download filename is never a
>   surprise.

### 15.4 Packaging the downloads

ZIP writing has **one home**: `packages/zip` (`homespace-zip`) — dependency-free
and isomorphic, so the browser, the daemon's tests, and WO-13's `homespace push`
all use the same writer. It stores entries uncompressed by default (a homespace
is mostly already-compressed images and wasm) and takes an optional `deflate`
hook, so nothing in the budget changes and nothing needs `zlib` in a browser.
`packages/serve` keeps its Node **reader** — streaming, capped, CRC-checked
(§9.2) — and re-exports the shared writer.

### 15.5 Hosting guide

**Golden path: Neocities** (ruled 2026-08-06). It is the only well-known free
host whose *whole* publish flow — sign up, upload a zip, get a URL — works in a
phone browser, which the mobile-first rule (§5.3) demands, and an
operator-owned page of files is exactly what it hosts. The guide gives
click-by-click steps for it plus a generic "any static host" fallback page. We
never integrate with, resell, or require an account on any host; the guide is
prose, and the zip it describes is the same zip every other host takes.

### 15.6 Out of scope here

No hosting-vendor integration, resale, or account flow of any kind. Day-2
editing — reopening an existing homespace folder to add packs or re-theme — is
**WO-23**; the seam and zip layout must not preclude it.

---

## Appendix A — Conventions for Claude Code sessions

- TS strict; named exports only; small modules over clever ones.
- `scanner` never renders; `renderer` never touches the filesystem tree outside its inputs/outputs; `serve` imports the others, never the reverse.
- Every behavior lands with a test in the same WO. Goldens update only with an explanatory commit message.
- Determinism: stable sorts, no wall-clock in output (except `--stamp`).
- Error messages: path, problem, fix — in designer-readable language.
- Do not add dependencies, section types, or manifest fields without amending this TDD in the same PR.
- Naming: `homespace` is the product name — package, bin, and unit noun. Instance names belong to operators (the author's is kʷátɬp); never bake an instance name into the kit, samples, or scaffolds.
