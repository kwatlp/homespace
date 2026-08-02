# Theming the link-hub

Everything visual is driven by `theme.tokens` in `node.manifest.jsonc`. Edit
those; you never touch CSS unless you want to.

| Token | What it controls |
|---|---|
| `color.bg` | Page background |
| `color.surface` | Card / list-item background |
| `color.text` | Body text (keep AA contrast against `bg`) |
| `color.muted` | Secondary text (dates, summaries) |
| `color.accent` | Links, focus rings, buttons |
| `font.body` | Body font — a self-hosted file in `theme/fonts/` (see below) |
| `font.display` | Heading font — self-hosted file |
| `font.scale` | Global type scale multiplier (1.0 = default) |
| `space.unit` | Base spacing unit in px (rhythm) |
| `radius` | Corner radius in px |
| `maxWidth` | Content column width in px |

## Fonts

Fonts must be **self-hosted** (no CDN — a node loads zero external resources).
Drop a `.woff2` in `theme/fonts/` and point a token at it, e.g.
`"font": { "body": "theme/fonts/inter.woff2" }`. Ship the font's license
alongside it. With no font tokens set, the node uses the visitor's system fonts.

## Custom CSS

For anything tokens don't cover, add `theme/custom.css` and reference it with
`"theme": { "css": "theme/custom.css" }`. It loads last and can override
anything.
