# Theming the illustrator homespace

Everything visual is driven by `theme.tokens` in `homespace.manifest.jsonc`.

| Token | What it controls |
|---|---|
| `color.bg` / `color.surface` | Page and tile/card backgrounds |
| `color.text` / `color.muted` | Body and secondary text (keep AA contrast) |
| `color.accent` | Links, focus rings |
| `font.body` / `font.display` | Self-hosted fonts in `theme/fonts/` (no CDN) |
| `space.unit` / `radius` / `maxWidth` | Rhythm, corners, column width |

This archetype uses the **grid** layout: the landing page is a grid of section
tiles, and each section also has its own page. Art lives in `art` packs — set
`media.cover`, an optional `media.gallery`, and an `alt` entry for every image
(accessibility). Sample images here are SVGs so the homespace ships zero external
resources; drop in your own `.webp`/`.png` and update each pack manifest.
