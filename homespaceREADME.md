# homespace

**Build a self-hosted space for whatever you make** — games, art, writing, links — from a folder of files on your own machine.

A homespace is a website you fully own. No accounts, no tracking, no cloud services, no platform between you and the people you share your link with. It builds to plain static files you can host anywhere — and everything a visitor needs ships inside it: your space loads **zero external resources**, works with JavaScript disabled, and keeps working on a LAN with no internet at all.

```
npx homespace init author my-homespace
cd my-homespace
npx homespace build
npx homespace dev
```

Open the printed URL. That's your space. Deploy = upload `dist/` to any static host.

**Never opened a terminal?** Use **the Builder** instead —
<https://kwatlp.github.io/homespace/builder/> — one web page that asks what you
want, shows a live preview, and hands you a finished website as a zip. No
account, no card, no upload: it builds in your browser, and your files never
leave your device. It works on a phone. Save the page to your device and it
works with no internet at all.

**Requirements:** Node ≥ 20 (the Builder needs only a browser). **License:** MIT.

---

## Pick a starting shape

`init` scaffolds from an archetype — a preset you then make yours:

| Archetype | Shape | Good for |
|---|---|---|
| `link-hub` | one scrolling page of links-with-depth | a link-in-bio you actually own |
| `author` | writing-first, multi-page, RSS on | essays, fiction, a blog |
| `illustrator` | grid landing, gallery-first | art portfolios |
| `game-designer` | playable + downloadable packs, dev log | games, apps, studios |

```
npx homespace init game-designer my-homespace
```

Every archetype ships with sample content and a `THEME.md` explaining each variable in plain language.

## How it works

Two files run everything:

**1. Packs — your content.** Everything you publish is a *pack*: a folder plus a `manifest.json`.

```
content/packs/my-game/
├── manifest.json
├── cover.webp
├── index.html        ← playable in the browser
└── dist/game.zip     ← downloadable build
```

Pack types: `game`, `app`, `art`, `post` (long-form writing in markdown), `link` (an outbound destination with a cover, summary, and gallery — a link with depth), and `bundle`. Scaffold one with:

```
npx homespace new pack post my-first-post
```

Drop the folder in, rebuild, it's live. Media stays as files on disk — no database, ever.

**2. `homespace.manifest.jsonc` — your composition.** Layout, theme, and sections, in one commented file:

- **`layout`** — `scroll` (one long page), `pages` (each section its own page), or `grid` (tile landing).
- **`theme.tokens`** — colors, fonts (self-hosted), spacing, radius. Edit tokens, restyle the whole space. `theme/custom.css` exists when you want full override power.
- **`sections`** — the ordered pieces of your space: `hero`, `links`, `packs`, `posts` (with optional RSS), `gallery`, `embed`, and `html` — a raw escape hatch that inserts any file you write, verbatim. If homespace doesn't have a shape for what you make, `html` holds it anyway.

## Play, read, download

Web builds (Godot, Unity, anything HTML5) get a sandboxed, load-on-click player page. Downloads are plain links with their sha256 shown. Posts render from markdown with RSS if you want it. Visitors need nothing: no signup, no cookies, no scripts required to read.

## Share it

- **The internet:** upload `dist/` anywhere static files go. Your URL is your distribution — send it, put it in a bio.
- **The room you're in:** set `"local": { "mdns": true }` and `homespace dev` announces your space to the whole network — anyone nearby opens `http://yourname.local:4321`, no internet required.

## Going further

- `homespace validate` checks every manifest (add `--verify` to check download checksums).
- `homespace-serve` (optional, separate package) runs a small daemon on your own hardware: watch-and-rebuild, remote publishing with an operator key, and scoped keys so apps you trust can publish packs to your space.
- The packages: `homespace` (launcher/CLI) with `homespace-schema`, `homespace-scanner`, `homespace-renderer`, `homespace-cli`, `homespace-serve` underneath.

## The deal

Your space holds whatever you bring. You decide what's on it — only you can write to it. Nobody can deplatform a folder of files on your own machine, and nobody needs permission to run one of these. If you make things, you deserve a place that's yours.

Source: https://github.com/kwatlp/homespace — MIT, forever.
