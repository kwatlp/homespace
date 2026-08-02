# Homespace — Technical Design Document

**Name:** `homespace` — npm package, CLI bin, and unit noun (a creator runs "a homespace"). The kit ships fully generic; operator instances carry their own names — the author's instance is **kʷátɬp**.
**Status:** v1.1 — amended for the homespace rename (WO-11); actionable
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

---

## 5. Repository structure & module boundaries

```
homespace/
├── packages/
│   ├── schema/       # JSON Schemas (pack, homespace, catalog) + generated TS types + validate()
│   ├── scanner/      # content/ → catalog.json  (pure; no rendering knowledge)
│   ├── renderer/     # (catalog, homespace manifest) → dist/  (pure; no fs-walking knowledge)
│   ├── cli/          # homespace init|new|validate|build|dev  (thin orchestration)
│   └── serve/        # TIER 2 ONLY — optional daemon; nothing else imports it
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

### 5.2 Output constraints (hard)
- Output is static HTML + CSS + minimal vanilla JS (lightbox, player shell). **No framework, no bundle, no external request** in `dist/`.
- Core browsing/reading must work with JavaScript disabled. JS enhances (lightbox, player chrome); it never gates content.
- Deterministic builds: stable ordering, no timestamps in output (build stamp behind `--stamp` flag only).

### 5.3 Accessibility baseline
Semantic HTML landmarks; every media entry supports `alt` (manifest `media.alt` map, ★ add to schema); token defaults in archetypes pass WCAG AA contrast; keyboard-reachable player and lightbox.

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

### 6.5 `html` section & `extra`
`{ "type": "html", "file": … }` is inserted verbatim (operator-authored by definition). `pack.extra` is exposed to templates untouched. These are the "holds whatever the creator brings" guarantees.

---

## 7. CLI specification

| Command | Behavior |
|---|---|
| `homespace init <archetype> [dir]` | Copy archetype preset; print next steps. Errors if dir non-empty. |
| `homespace new pack <type> <id>` | Scaffold `content/packs/<id>/` with a commented manifest for that type. |
| `homespace validate` | Validate homespace manifest + all packs; `--verify` also checks checksums. Exit ≠ 0 on error; warnings listed. |
| `homespace build` | validate → scan → render → `dist/`. `--out`, `--verify`, `--stamp`. |
| `homespace dev` | build, serve `dist/` on localhost, watch & rebuild. Correct MIME + COOP/COEP headers toggle (`--coi`) for threaded WASM builds. |
| `homespace serve` | Tier 2 (§9); only if `@homespace/serve` is installed. |

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

## 9. Tier 2 — daemon (`@homespace/serve`) — build LAST

Optional package for operators who want remote publish or app integrations. Static tiers must never require it.

### 9.1 Behaviors
Watch `content/` + manifests → rebuild; serve `dist/` with range requests; structured logs.

### 9.2 Operator write API
`PUT /api/packs/:id` (zip) → zip-slip-safe unpack to temp → validate → move into `content/packs/` → rebuild. Auth: single operator bearer key from env/config. No user system.

### 9.3 Linked systems ("linked systems with permissions")
Scoped keys: `{ key, scopes: ["packs:write"], allowedTypes?, allowedIdPrefix? }`. Example: tmíxʷ holds a key scoped to `allowedIdPrefix: "tmixw-"` and publishes world-template packs to the operator's homespace. Keys are config entries the operator writes; there is no key-issuance UI in v0.

### 9.4 Explicitly absent
Accounts, sessions, comments, federation endpoints, analytics.

---

## 10. Testing strategy

1. **Schema fixtures** — valid/invalid manifest suites per type; unknown-field warn-and-keep covered.
2. **Offline-budget gate (permanent CI)** — crawl `dist/`: no external URL may appear as a *resource load* (script/link-stylesheet/img-src/font/iframe-src). External `<a href>` allowed — navigation is the network. Build fails otherwise.
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
- **WO-9 — Daemon.** `@homespace/serve` per §9. *Exit:* integration tests incl. zip-slip, scope enforcement.
- **WO-10 — Release.** docs/ rebuilt as a homespace (dogfood), THIRD_PARTY.md, `npx` path verified, v0.1.0. *Exit:* Definition of Done (§14) demonstrated end-to-end on a clean machine.
- **WO-11 — Rename to `homespace` & republish.** Sweep the codebase to match this document: packages `@homespace/*` (claim the npm scope at publish; if unavailable, fall back to `homespace-schema` etc. and amend §5), CLI/bin `homespace`, repo `homespace`, manifest filename `homespace.manifest.jsonc` (loader accepts legacy `node.manifest.jsonc` with a deprecation warning for one minor version), scaffold dirs `my-homespace/`, all docs/THEME.md/error strings; no instance branding in samples or scaffolds. Publish `homespace` v0.2.0 to npm. Golden-diff guard: `dist/` output identical to v0.1.0 except renamed strings. *Exit:* §14 stranger-test passes against the **published** package on a clean machine; `grep -ri kwatlp` returns nothing; `grep -riE '\bnode\b'` returns only Node-runtime references.

---

## 12. Security & threat model

Content is operator-authored or operator-installed; there is no hostile-user write surface in tiers 0–1. Residual risks and controls:

| Risk | Control |
|---|---|
| Supply chain | Dependency budget (§5.4), lockfile, no postinstall |
| Malicious third-party pack the operator installs | `strict` sandbox recommendation; checksums; docs |
| XSS via markdown | raw HTML off by default; opt-in is homespace-level and documented |
| Path traversal / zip-slip | scanner + serve normalize & confine; fixture tests |
| Daemon key leakage | keys in env/config only; scoped keys for linked systems; never rendered into `dist/` |
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

## Appendix A — Conventions for Claude Code sessions

- TS strict; named exports only; small modules over clever ones.
- `scanner` never renders; `renderer` never touches the filesystem tree outside its inputs/outputs; `serve` imports the others, never the reverse.
- Every behavior lands with a test in the same WO. Goldens update only with an explanatory commit message.
- Determinism: stable sorts, no wall-clock in output (except `--stamp`).
- Error messages: path, problem, fix — in designer-readable language.
- Do not add dependencies, section types, or manifest fields without amending this TDD in the same PR.
- Naming: `homespace` is the product name — package, bin, and unit noun. Instance names belong to operators (the author's is kʷátɬp); never bake an instance name into the kit, samples, or scaffolds.
