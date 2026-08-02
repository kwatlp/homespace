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
`index.html`; they play in-browser via a **load-on-click iframe**. Use
`"sandbox": "strict"` for builds you didn't author (opaque origin). Add a
downloadable build with `entrypoint.download` plus a `checksums` entry. See the
link-hub `THEME.md` for notes on self-hosting fonts and `theme/custom.css`.
