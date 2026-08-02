# Theming the author homespace

Everything visual is driven by `theme.tokens` in `homespace.manifest.jsonc` — edit
those, not CSS.

| Token | What it controls |
|---|---|
| `color.bg` / `color.surface` | Page and card backgrounds |
| `color.text` / `color.muted` | Body and secondary text (keep AA contrast) |
| `color.accent` | Links, focus rings |
| `font.body` / `font.display` | Self-hosted fonts in `theme/fonts/` (no CDN) |
| `font.scale` | Global type scale |
| `space.unit` / `radius` / `maxWidth` | Rhythm, corners, column width |

This archetype uses the **pages** layout: each section becomes its own page with
a shared nav. Posts carry `created` dates for ordering and the RSS feed
(`feed.xml`). See the link-hub `THEME.md` for notes on self-hosting fonts and
adding `theme/custom.css`.
