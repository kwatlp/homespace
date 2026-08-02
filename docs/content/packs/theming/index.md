# Theming

Layout, sections, and theme are creator-chosen in `homespace.manifest.jsonc`. You
restyle the entire homespace by editing `theme.tokens` — colors, fonts, spacing,
radius, and column width — never by hand-writing CSS.

```jsonc
"theme": {
  "tokens": {
    "color": { "bg": "#14100c", "text": "#f3e9dd", "accent": "#d97b4a" },
    "maxWidth": 760
  }
}
```

Fonts are **self-hosted** (a homespace loads zero external resources): drop a
`.woff2` in `theme/fonts/` and point a token at it. For anything tokens don't
cover, add `theme/custom.css`, which loads last.

## Layouts

- `scroll` — one long page.
- `pages` — each section becomes its own page with shared nav.
- `grid` — a landing grid of section tiles.

## Sections

`hero`, `links`, `packs`, `posts`, `gallery`, `embed`, and `html` (verbatim,
for anything the kit didn't anticipate).
