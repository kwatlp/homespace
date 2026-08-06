# Theming the game-designer homespace

Everything visual is driven by `theme.tokens` in `homespace.manifest.jsonc`.

| Token | What it controls |
|---|---|
| `color.bg` / `color.surface` | Page and card backgrounds |
| `color.text` / `color.muted` | Body and secondary text (keep AA contrast) |
| `color.accent` | Play button, links, focus rings |
| `font.body` / `font.display` | Self-hosted fonts in `theme/fonts/` (no CDN) |
| `space.unit` / `radius` / `maxWidth` | Rhythm, corners, column width |

Games and apps are `game`/`app` packs with `entrypoint.web` pointing at an
`index.html`; they play in-browser via a **load-on-click iframe**. Add a
downloadable build with `entrypoint.download` plus a `checksums` entry. See the
link-hub `THEME.md` for notes on self-hosting fonts and `theme/custom.css`.

## `sandbox`: standard or strict

`"sandbox": "standard"` (the default) lets a build use its own origin — Godot
and Unity exports need that for save data, and for loading their `.pck`/`.wasm`
files. Use it for builds you made.

`"sandbox": "strict"` gives the build an **opaque origin**: it can play, but it
cannot touch your site's storage or act as your site. Use it for anything you
didn't author. A strict pack is also never linked as a plain page — with
JavaScript off, visitors get its download instead, because opening the build as
a page would hand it your origin anyway.

If you run the Tier-2 daemon, packs published through a **scoped key** are
forced to `strict` on arrival; you don't have to remember.
