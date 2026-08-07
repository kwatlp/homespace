# Driving a real browser from a Claude Code session

How to verify browser behavior in this repo — the Builder especially, since its
whole promise (§15.1) is *runs in your browser, from your disk, touching
nothing*. That claim can only be checked in a browser.

Written after request `003` item 4, where the fix was "the page
must run from `file://`" and the session had no working browser extension.

## First choice: the Claude-in-Chrome extension

If it is connected, use it — it drives the user's real Chrome, with real
profile and devtools.

```
mcp__claude-in-chrome__tabs_context_mcp { createIfEmpty: true }
```

Load the tools in **one** `ToolSearch` call (`select:` takes a comma-separated
list), then `navigate`, `read_page`, `computer`, `read_console_messages`.

**Check it is actually there before planning around it.** A dead extension
reports as an empty list, not an error:

```
mcp__claude-in-chrome__list_connected_browsers   →  []   means nothing is connected
```

Installing a Chrome extension does **not** register an MCP server. Anything
that arrives as MCP tools (Kapture and friends) needs `claude mcp add` and a
session restart — MCP servers are enumerated once, at session start.

## What actually worked: local browsers, headless, no extension

Both browsers are installed on the studio machine and neither needs any
tooling, MCP server, npm package, or network access.

```
/c/Program Files/Google/Chrome/Application/chrome.exe
/c/Program Files/Mozilla Firefox/firefox.exe
```

### Chrome — `--dump-dom` gives you the post-JS DOM

The good one. You get the DOM *after* scripts have run, so you can assert on it
in Node.

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" \
  --headless --disable-gpu --no-first-run --no-default-browser-check \
  --user-data-dir="<scratchpad>\\chrome-profile" \
  --virtual-time-budget=15000 --dump-dom \
  "file:///C:/Users/brenn/Repo/Kwatlp/docs/static/builder/index.html" \
  > dom.html 2> err.txt
```

- **Always pass `--user-data-dir`** at a scratchpad path. Never touch the
  user's real profile.
- `--virtual-time-budget=<ms>` fast-forwards timers, so async work (the
  Builder's 180 ms debounce, then a full in-browser build) completes before the
  dump. Without it you capture a half-built page.
- Console errors reach stderr only with `--enable-logging=stderr --log-level=0`.
  That is how the module-vs-classic CORS message was captured verbatim.
- Paths in flag values want Windows backslashes; the URL wants
  `file:///C:/forward/slashes`.

**Assert on real evidence, not on the page echoing itself.** Everything the
wizard generates — the space checkboxes, the layout radios, the preview's
`srcdoc` — is absent from the source HTML. Diffing the dumped DOM against the
source file proves JS ran, rather than proving the file exists.

### Firefox — screenshot only, and it captures early

Firefox has no `--dump-dom`. It takes a PNG, which you then `Read`.

```bash
"/c/Program Files/Mozilla Firefox/firefox.exe" \
  --headless --profile "<scratchpad>/ff-profile" --window-size=390,900 \
  --screenshot="<scratchpad>\\shot.png" \
  "file:///.../index.html"
```

Three things cost time the first time round:

1. **`--screenshot=<path>` — the `=` is required.** The space-separated form
   silently writes nothing and still exits 0.
2. **Firefox caches `file://` documents.** Re-running an edited page gives you
   the *previous* render, byte-identical PNG and all. Write each run to a fresh
   filename.
3. **The capture lands at `load`, before any `setTimeout`/`setInterval`
   callback fires.** Ballasting the page with heavy images to delay `load` does
   not move it. So anything behind a timer — or behind a promise that resolves
   after the handler chain — will read as absent. That is the tool, not the
   page.

Because of (3), do not conclude "broken in Firefox" from an empty readout.
Instrument each *step* instead and let the synchronous log lines tell you
whether the primitives work (see below); they are written before capture.

## Techniques worth reusing

**Get the verdict out of a screenshot-only browser.** Have the probe write its
findings into a fixed, high-contrast banner at the top of the page, then read
the PNG. Refresh it on a ladder — `[0, 50, 150, 400, 900]` ms plus an interval
— so whenever the shot lands you get the freshest reading that made it.

**Force an exact viewport.** `--window-size=390,844` does not give 390 CSS px
in headless Chrome on Windows; it floors out around 485. Host the page in an
iframe of exactly the width you want — an iframe's viewport is its box:

```html
<style>iframe{width:390px;height:844px;border:0}</style>
<iframe src="index.html"></iframe>
```

The iframe is a *separate* `file://` origin, so `parent.document` throws.
Report across it with `postMessage`.

**Pick files without a file dialog.** `DataTransfer` works in both browsers and
is the only way to exercise a file input headlessly:

```js
const dt = new DataTransfer();
dt.items.add(new File([bytes], "picture.png", { type: "image/png" }));
input.files = dt.files;
input.dispatchEvent(new Event("change", { bubbles: true }));
```

**Mind script ordering.** The Builder's bundle is `defer`, so it runs *after*
every inline script but *before* `DOMContentLoaded`. A probe appended inline to
the page therefore runs too early — it dispatches events at elements with no
listeners yet, and nothing happens, with no error to show for it. Put probes on
`DOMContentLoaded` (listeners attached, still earlier than `load`, so async work
gets the longest possible window before capture).

**A/B the thing you changed.** The strongest evidence for item 4 was two runs
of the *same* bundle and CSS differing only in the script tag: classic runs,
`type="module"` is dead, with Chrome naming the reason. One run proves the page
works; two prove the fix was necessary.

## What this verified for the Builder

- The wizard runs fully from `file://` in **Chromium and Firefox** — generated
  controls, and a live preview built by the real scanner and renderer in-page.
- A `type="module"` build is refused: *"Access to script at 'file:///…' from
  origin 'null' has been blocked by CORS policy"*. That is why
  `bundlePage` emits `iife`.
- At phone width (375–390 px) with every asset field filled: no horizontal
  overflow, no element wider than the viewport.

`packages/builder/src/page.test.ts` keeps the classic-script property honest in
CI without a browser, by compiling the shipped bundle with `node:vm`'s `Script`
— exactly how a browser compiles `<script src>`, so any ESM syntax throws.
