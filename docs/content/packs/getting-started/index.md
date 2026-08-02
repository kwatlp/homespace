# Getting started

A **homespace** is one self-hosted website that holds whatever you bring — apps,
games, art, writing, links-with-depth, or raw HTML — built to plain static files.

```sh
npx homespace init author my-homespace
cd my-homespace
npx homespace build          # → dist/, deploy anywhere
# or:
npx homespace dev            # local preview + live rebuild
```

## Add content

Everything publishable is a **pack**: a folder under `content/packs/<id>/` with a
`manifest.json`.

```sh
homespace new pack game my-game
homespace new pack post my-note
homespace new pack link somewhere
```

Rebuild and it appears — a web game plays in-browser, a post renders with RSS,
a link becomes a card with depth.

## Deploy

`dist/` is plain files: drop it on any static host, or run `homespace dev`. Sharing
the URL *is* distribution — no accounts, no federation, no CDN.
