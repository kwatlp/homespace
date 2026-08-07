# docs/

**Public** documentation for homespace. This site *is* a homespace — built with
`homespace build` from this folder, the kit building the kit (TDD §11, WO-10).
Private planning and the design doc live in `../internal-docs/`, which is never
published.

**Live:** <https://kwatlp.github.io/homespace/> —
the Builder is at <https://kwatlp.github.io/homespace/builder/>.

## How it gets there

`.github/workflows/docs.yml` publishes to GitHub Pages on every merge to `main`.
There is nothing to run by hand, and no build output is committed except the
Builder's page bundle (see below).

Pages serves this as a *project* site, so it lives under the `/homespace/`
subpath. Everything the renderer emits is relative and does not care — but
`feed.xml` and `sitemap.txt` are absolute by nature, so the workflow passes the
real base URL in:

```sh
npx homespace build --base-url https://kwatlp.github.io/homespace/
```

Build it locally the same way (or without `--base-url`, which leaves feed and
sitemap links site-relative):

```sh
cd docs
npx homespace build          # → docs/dist/, which is gitignored
```

## static/builder/

`docs/static/` is copied verbatim to the site root, so `static/builder/` is what
puts the Builder at `/builder/`. Those three files are **build output that lives
in the repo** — generated from `packages/builder/page/` and
`packages/builder/src/ui/` by:

```sh
npm run bundle --workspace homespace-builder
```

Change the Builder's page or script and you must re-run that and commit the
result. CI checks it on every push; a stale bundle fails the build rather than
quietly shipping a page that no longer matches its source.

The page is bundled as a **classic script**, not a module, so it also runs when
someone saves it and opens it from `file://`.

## First-time Pages setup (once per repository)

In **Settings → Pages**, set **Source** to **GitHub Actions**. Nothing else —
no branch to pick, no `gh-pages` to create.
