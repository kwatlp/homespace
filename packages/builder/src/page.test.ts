import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { findBudgetViolations } from "homespace-renderer";
import { describe, expect, test } from "vitest";

const pageFile = (name: string): string => fileURLToPath(new URL(`../page/${name}`, import.meta.url));
const shipped = (name: string): string =>
  fileURLToPath(new URL(`../../../docs/static/builder/${name}`, import.meta.url));

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
    const script = await readFile(fileURLToPath(new URL("./ui/main.ts", import.meta.url)), "utf8");

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

  test("the shipped bundle cannot reach the network at all", async () => {
    const bundle = await readFile(shipped("builder.js"), "utf8");
    // Not a policy, an absence: there is no way for this page to phone home
    // even if it wanted to (TDD §15.1).
    for (const primitive of ["fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "EventSource", "importScripts"]) {
      expect(bundle.includes(primitive), `the bundle contains ${primitive}`).toBe(false);
    }
  });
});
