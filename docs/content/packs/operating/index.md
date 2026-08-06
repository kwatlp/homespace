# Operating a homespace

Everything here is optional reading until you deploy. Then it matters.

## `dist/` belongs to the build

Every build makes `dist/` match your homespace **exactly**. Files the build did
not generate are deleted, and each one is listed:

```
warning: removed packs/old-game/index.html — no longer part of this homespace
```

That is what makes deleting a pack actually delete it: no orphan page, no stale
download, no image left behind from a rename.

So don't hand-edit `dist/`. If you need a file at the root of your deployed
site — `CNAME`, `_headers`, `_redirects`, a verification file a host asks for —
put it in **`static/`**. Everything in `static/` is copied verbatim to the root
of `dist/`, so it survives every rebuild:

```
my-homespace/
├── static/
│   └── CNAME        →  dist/CNAME
└── content/
```

For the same reason, `homespace build --out` refuses to point at your homespace
folder itself. Build into a subfolder.

## Running the daemon (Tier 2, optional)

A homespace is plain files; you never need a daemon. `homespace serve` exists
for operators who want to publish remotely or let an app they trust publish for
them.

### Keys live in the environment

```sh
HOMESPACE_OPERATOR_KEY=… npx homespace serve
```

That is the recommended way. A key in `homespace.serve.json` works too, but it
is a file that can end up in version control by accident — it is gitignored by
default, and it should stay that way. Keys are never rendered into `dist/`.

### A scoped key publishes; it never takes your origin

A linked system gets a key scoped to what it may write:

```json
{
  "keys": [
    {
      "key": "…",
      "scopes": ["packs:write"],
      "allowedIdPrefix": "tmixw-",
      "allowedTypes": ["post"]
    }
  ]
}
```

Anything installed through a scoped key is forced to `"sandbox": "strict"` at
install time — the uploader cannot ask for anything else. A strict pack runs in
a frame with an **opaque origin**: it can play, but it cannot read your site's
storage or act as your site. For the same reason its "no JavaScript" fallback is
a **download link** rather than a direct link to the build, because opening the
build as a page would hand it your origin after all.

The trade-off is real and it is why `strict` is not the default: an opaque
origin breaks some Godot and Unity web builds and wipes their save data. Packs
**you** publish with the operator key keep whatever sandbox you set. Relaxing
`strict` by hand on a pack someone else published means trusting that system
with your origin — that is the whole decision, stated plainly.

### Uploads are bounded

The write API accepts bodies up to **1 GiB** (raise or lower it with
`maxUploadBytes`) and streams them to disk rather than into memory, so a large
game build costs disk, not RAM. Over the limit is a `413`.

Archives are expanded under caps too — per file, in total, and by file count —
so a "zip bomb" is a `400`, not an outage. Every file's checksum is verified as
it is written, and archives the reader cannot represent faithfully (ZIP64,
encrypted, multi-disk) are refused with a message that says so. Installing is
atomic: the pack you had stays in place until the new one is fully written, and
comes back if the swap fails.

## What the offline check covers

`homespace build` fails if a page **it generated** loads anything from another
origin — a font, a script, a stylesheet, an image. That is the promise: your
site works with the network unplugged after first load.

It deliberately does **not** scan your `static/` files or a pack's own HTML — a
third-party game build is a black box you chose to host, and rewriting its
markup is not our business. Those files still ship inside `dist/`, so nothing
reaches the network unless you put it there. If you want the full picture,
that reporting belongs to `homespace doctor`.
