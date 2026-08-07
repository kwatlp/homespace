import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";

import { findBudgetViolations } from "homespace-renderer";
import { describe, expect, test } from "vitest";

const pageFile = (name: string): string => fileURLToPath(new URL(`../page/${name}`, import.meta.url));
const shipped = (name: string): string =>
  fileURLToPath(new URL(`../../../docs/static/builder/${name}`, import.meta.url));
const uiScript = (): Promise<string> =>
  readFile(fileURLToPath(new URL("./ui/main.ts", import.meta.url)), "utf8");

/** The ids of every `<input type="file">` on the page, in document order. */
function fileInputIds(html: string): string[] {
  return [...html.matchAll(/<input\b([^>]*)>/g)]
    .map((match) => match[1] ?? "")
    .filter((attributes) => /\btype="file"/.test(attributes))
    .map((attributes) => /\bid="([^"]+)"/.exec(attributes)?.[1])
    .filter((id): id is string => id !== undefined);
}

/** The `<p class="field">…</p>` an input sits in — label, hints and all. */
function fieldBlock(html: string, id: string): string {
  const at = html.indexOf(`id="${id}"`);
  if (at < 0) throw new Error(`the page has no #${id}`);
  return html.slice(html.lastIndexOf("<p ", at), html.indexOf("</p>", at));
}

describe("the Builder page (WO-22)", () => {
  test("loads nothing from anywhere else", async () => {
    const files = [
      { path: "index.html", contents: await readFile(pageFile("index.html"), "utf8") },
      { path: "builder.css", contents: await readFile(pageFile("builder.css"), "utf8") },
    ];
    expect(findBudgetViolations(files)).toEqual([]);
  });

  test("says plainly what it needs and what it does not do", async () => {
    const html = await readFile(pageFile("index.html"), "utf8");
    expect(html).toContain("<noscript>");
    expect(html).toMatch(/needs JavaScript/i);
    expect(html).toMatch(/Nothing leaves this device/i);
    // No account, no email field, no telemetry endpoint.
    expect(html).not.toMatch(/type="email"|type="password"|<form[^>]*\baction=/i);
  });

  test("is keyboard reachable and labelled", async () => {
    const html = await readFile(pageFile("index.html"), "utf8");
    expect(html).toContain('class="skip-link"');
    // Every input carries a label, a legend, or is generated with one.
    for (const id of ["title", "tagline", "slug", "lang", "footer", "radius", "maxWidth", "fontScale"]) {
      expect(html, `#${id} has no label`).toContain(`for="${id}"`);
    }
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('sandbox="allow-scripts"'); // preview stays opaque-origin
  });

  test("every element the wizard reaches for exists in the page", async () => {
    const html = await readFile(pageFile("index.html"), "utf8");
    const script = await uiScript();

    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!));
    const wanted = [...script.matchAll(/\bel<[^>]*>\("([^"]+)"\)/g)].map((m) => m[1]!);

    expect(wanted.length).toBeGreaterThan(10);
    for (const id of wanted) {
      expect(ids.has(id), `the page has no #${id}, so the Builder would fail to start`).toBe(true);
    }

    // The fields that only apply to a chosen space are tagged with real ones.
    const spaces = [...html.matchAll(/data-space="([^"]+)"/g)].map((m) => m[1]!);
    expect(spaces.length).toBeGreaterThan(0);
    for (const space of spaces) {
      expect(["art", "writing", "games", "apps", "links"]).toContain(space);
    }
  });

  test("ships inside the docs homespace", async () => {
    for (const asset of ["index.html", "builder.css", "builder.js"]) {
      const info = await stat(shipped(asset));
      expect(info.isFile(), `docs/static/builder/${asset} is missing — run npm run bundle`).toBe(true);
      expect(info.size).toBeGreaterThan(0);
    }
    // The shipped bundle must be free of Node built-ins, like the library one.
    const bundle = await readFile(shipped("builder.js"), "utf8");
    expect(bundle).not.toMatch(/["']node:(fs|path|crypto|http|os|url)/);
  });

  test("it runs from a double-click, not only from a server (003 item 4)", async () => {
    const html = await readFile(pageFile("index.html"), "utf8");
    // A module script is fetched under CORS rules, and a page opened from disk
    // has no origin to satisfy — so a module build of this page is dead on
    // arrival. `defer` buys back the run-after-parsing that module gave us.
    expect(html).not.toMatch(/<script[^>]*type="module"/i);
    expect(html).toMatch(/<script[^>]*\bsrc="builder\.js"[^>]*\bdefer\b/i);

    const bundle = await readFile(shipped("builder.js"), "utf8");
    // Compile it exactly the way a browser compiles `<script src>`: any ESM
    // syntax left in there — `import`, `export`, `import.meta` — is a syntax
    // error in a classic script, and this throws before a person ever sees it.
    expect(() => new Script(bundle, { filename: "builder.js" })).not.toThrow();
  });

  test("every file input can be un-picked, and the script wires all of them (003 items 2, 6)", async () => {
    const html = await readFile(pageFile("index.html"), "utf8");
    const script = await uiScript();
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!));

    // Two build slots, because a game and an app are different things.
    expect([...fileInputIds(html)].sort()).toEqual([
      "banner",
      "buildApp",
      "buildGame",
      "gallery",
      "icon",
    ]);

    for (const id of fileInputIds(html)) {
      expect(ids.has(`${id}Chosen`), `#${id} never says back what was picked`).toBe(true);
      expect(ids.has(`${id}Clear`), `#${id} has no way back to the placeholder`).toBe(true);
      expect(script.includes(`"${id}"`), `main.ts never wires #${id}`).toBe(true);
    }
  });

  test("each build slot belongs to its own space, and says what it can take (003 items 2, 8)", async () => {
    const html = await readFile(pageFile("index.html"), "utf8");

    expect(fieldBlock(html, "buildGame")).toContain('data-space="games"');
    expect(fieldBlock(html, "buildApp")).toContain('data-space="apps"');

    // The flat-file limit is a surprise if it is only discovered by failing.
    for (const id of ["buildGame", "buildApp"]) {
      const block = fieldBlock(html, id);
      expect(block, `#${id} does not say it takes flat files only`).toMatch(/flat files only/i);
      expect(block, `#${id} does not say where a foldered export goes`).toMatch(/master copy/i);
      expect(block).toMatch(/index\.html/);
    }
  });

  test("the folder-name field settles to the slug the state holds (003 item 5)", async () => {
    const script = await uiScript();
    // Typing slugifies into state…
    expect(script).toMatch(/state\.slug = slugify\(slug\.value\)/);
    // …and leaving the field writes that value back into the box, so what you
    // read is what the download will be called.
    expect(script).toMatch(/slug\.addEventListener\("blur",[\s\S]{0,160}?slug\.value = state\.slug/);
  });

  test("pictures are described where they are chosen (003 item 3)", async () => {
    const html = await readFile(pageFile("index.html"), "utf8");
    const script = await uiScript();

    // The description fields are built next to the gallery picker, inside the
    // art space so they never appear for a homespace with no gallery.
    expect(fieldBlock(html, "gallery")).toContain('id="gallery"');
    expect(html).toMatch(/data-space="art"[\s\S]{0,900}?id="galleryAlts"/);
    expect(html).toMatch(/screen reader/i);

    // Blank stays blank in the field; the wizard supplies the fallback.
    expect(script).toContain('input.placeholder = "What is in this picture?"');
    // A file name is the person's text — it must never be written as markup.
    expect(script).toContain("label.textContent = asset.name");
    expect(script).not.toMatch(/innerHTML\s*=\s*[^;]*asset\.name/);
  });

  test("the shipped bundle cannot reach the network at all", async () => {
    const bundle = await readFile(shipped("builder.js"), "utf8");
    // Not a policy, an absence: there is no way for this page to phone home
    // even if it wanted to (TDD §15.1).
    for (const primitive of ["fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "EventSource", "importScripts"]) {
      expect(bundle.includes(primitive), `the bundle contains ${primitive}`).toBe(false);
    }
  });
});
