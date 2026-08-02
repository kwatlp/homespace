# Getting started

A **node** is one self-hosted website that holds whatever you bring — apps,
games, art, writing, links-with-depth, or raw HTML — built to plain static files.

```sh
npx kwatlp init author my-node
cd my-node
npx kwatlp build          # → dist/, deploy anywhere
# or:
npx kwatlp dev            # local preview + live rebuild
```

## Add content

Everything publishable is a **pack**: a folder under `content/packs/<id>/` with a
`manifest.json`.

```sh
kwatlp new pack game my-game
kwatlp new pack post my-note
kwatlp new pack link somewhere
```

Rebuild and it appears — a web game plays in-browser, a post renders with RSS,
a link becomes a card with depth.

## Deploy

`dist/` is plain files: drop it on any static host, or run `kwatlp dev`. Sharing
the URL *is* distribution — no accounts, no federation, no CDN.
