import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Catalog, HomespaceManifest } from "homespace-schema";
import { afterEach, beforeAll, describe, expect, test } from "vitest";

import {
  assertOfflineBudget,
  emittedPaths,
  findBudgetViolations,
  isRasterImage,
  render,
  renderMarkdown,
  renderTokensCss,
  sandboxTokens,
  writeDist,
  type OutputFile,
  type RenderResult,
  type Thumbnailer,
} from "./index";
import { escapeAttr } from "./escape";

const demoRoot = fileURLToPath(new URL("../test/fixtures/demo-homespace", import.meta.url));

const homespace: HomespaceManifest = {
  name: "demo",
  title: "Demo Homespace",
  tagline: "a test homespace",
  lang: "en",
  layout: "scroll",
  theme: {
    tokens: { color: { accent: "#c0ffee" }, maxWidth: 800 },
    css: "theme/custom.css",
  },
  nav: [
    { label: "Play", href: "#packs" },
    { label: "Read", href: "#posts" },
  ],
  sections: [
    { type: "hero", heading: "Demo Homespace", sub: "a test homespace", media: "static/hero.webp" },
    { type: "packs", title: "Games", source: { types: ["game", "app"] }, style: "cards" },
    { type: "posts", title: "Writing", source: { types: ["post"] }, rss: true },
    { type: "links", title: "Elsewhere", source: { types: ["link"] } },
    { type: "gallery", title: "Art", source: { types: ["art"] } },
  ],
  footer: { text: "© demo", links: [] },
};

const catalog: Catalog = {
  version: 1,
  packs: [
    { id: "friends", type: "link", title: "Friends", slug: "friends", dir: "content/packs/friends", summary: "Good people", entrypoint: { link: "https://example.com/friends" }, tags: ["links"] },
    { id: "hello-world", type: "post", title: "Hello World", slug: "hello-world", dir: "content/packs/hello-world", summary: "The first post.", created: "2026-01-05T00:00:00Z", entrypoint: { post: "index.md" } },
    { id: "portfolio", type: "art", title: "Portfolio", slug: "portfolio", dir: "content/packs/portfolio", media: { cover: "cover.webp", gallery: ["a.webp"], alt: { "cover.webp": "cover art" } }, tags: ["art"] },
    { id: "solterra", type: "game", title: "Solterra", slug: "solterra", dir: "content/packs/solterra", summary: "A tiny game.", version: "1.0.0", entrypoint: { web: "index.html" }, media: { cover: "cover.webp" }, tags: ["rpg"] },
  ],
};

function file(result: RenderResult, p: string): OutputFile {
  const found = result.files.find((f) => f.path === p);
  if (!found) throw new Error(`no output file '${p}' (have: ${result.files.map((f) => f.path).join(", ")})`);
  return found;
}

describe("render — demo homespace", () => {
  let result: RenderResult;
  beforeAll(async () => {
    result = await render({ catalog, homespace, root: demoRoot });
  });

  test("renders with no errors and includes the gallery section", () => {
    expect(result.errors).toEqual([]);
    expect(file(result, "index.html").contents).toContain('id="gallery"');
  });

  test("emits an RSS alternate link in the head when a feed exists", () => {
    expect(file(result, "index.html").contents).toContain('rel="alternate" type="application/rss+xml"');
  });

  test("feed.xml is well-formed RSS with one item per post", () => {
    const feed = file(result, "feed.xml").contents;
    expect(feed.startsWith("<?xml")).toBe(true);
    expect(feed).toContain('<rss version="2.0">');
    expect(feed).toContain("<channel>");
    expect((feed.match(/<item>/g) ?? []).length).toBe(catalog.packs.filter((p) => p.type === "post").length);
  });

  test("emits the expected file set", () => {
    expect(result.files.map((f) => f.path).sort()).toEqual([
      "base.css",
      "catalog.json",
      "feed.xml",
      "index.html",
      "packs/portfolio/index.html",
      "packs/solterra/index.html",
      "posts/hello-world/index.html",
      "sitemap.txt",
      "tokens.css",
    ]);
  });

  test("copies pack files under files/ and static verbatim (no index.html collision)", () => {
    const dests = result.assets.map((a) => a.to);
    expect(dests).toContain("packs/solterra/files/index.html");
    expect(dests).toContain("packs/solterra/files/cover.webp");
    expect(dests).toContain("posts/hello-world/index.md");
    expect(dests).toContain("hero.webp");
    expect(dests).toContain("custom.css");
    // The game's own index.html must not overwrite the generated detail page.
    expect(dests).not.toContain("packs/solterra/index.html");
  });

  test("golden: index.html", () => expect(file(result, "index.html").contents).toMatchSnapshot());
  test("golden: tokens.css", () => expect(file(result, "tokens.css").contents).toMatchSnapshot());
  test("golden: game detail", () => expect(file(result, "packs/solterra/index.html").contents).toMatchSnapshot());
  test("golden: post detail", () => expect(file(result, "posts/hello-world/index.html").contents).toMatchSnapshot());
  test("golden: feed.xml", () => expect(file(result, "feed.xml").contents).toMatchSnapshot());
  test("golden: sitemap.txt", () => expect(file(result, "sitemap.txt").contents).toMatchSnapshot());

  test("offline-budget gate: dist has no external resource loads", () => {
    expect(() => assertOfflineBudget(result.files)).not.toThrow();
    expect(findBudgetViolations(result.files)).toEqual([]);
  });

  test("post detail keeps the external <a> link but not raw <script>", () => {
    const post = file(result, "posts/hello-world/index.html").contents;
    expect(post).toContain('href="https://example.com"');
    expect(post).not.toContain("<script>alert");
  });

  test("determinism: re-rendering yields identical output", async () => {
    const again = await render({ catalog, homespace, root: demoRoot });
    expect(again.files.map((f) => f.contents)).toEqual(result.files.map((f) => f.contents));
  });
});

describe("offline-budget checker — unit", () => {
  test("flags an external image but ignores an <a> link", () => {
    const files = [
      { path: "x.html", contents: '<img src="https://cdn.example/x.png"><a href="https://ok.example/">nav</a>' },
    ];
    const violations = findBudgetViolations(files);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.url).toBe("https://cdn.example/x.png");
  });

  test("flags an external @font-face url() in css", () => {
    const files = [{ path: "t.css", contents: "@font-face{src:url(https://f.example/a.woff2)}" }];
    expect(findBudgetViolations(files)).toHaveLength(1);
  });

  test("covers srcset, media, embed, object and bare @import (WO-12 P3-7)", () => {
    const files = [
      { path: "a.html", contents: '<img srcset="https://cdn.example/a.png 1x, https://cdn.example/b.png 2x" src="c.png">' },
      { path: "b.html", contents: '<video src="https://cdn.example/v.mp4" poster="https://cdn.example/p.jpg"></video>' },
      { path: "c.html", contents: '<audio src="https://cdn.example/a.mp3"></audio><embed src="https://cdn.example/e.svg">' },
      { path: "d.html", contents: '<object data="https://cdn.example/o.pdf"></object>' },
      { path: "e.css", contents: '@import "https://cdn.example/x.css";' },
    ];
    expect(findBudgetViolations(files).map((v) => v.url).sort()).toEqual([
      "https://cdn.example/a.mp3",
      "https://cdn.example/a.png",
      "https://cdn.example/b.png",
      "https://cdn.example/e.svg",
      "https://cdn.example/o.pdf",
      "https://cdn.example/p.jpg",
      "https://cdn.example/v.mp4",
      "https://cdn.example/x.css",
    ]);
  });
});

describe("escaping", () => {
  test("escapeAttr escapes both quote characters (WO-12 P3-9)", () => {
    expect(escapeAttr(`it's a "quote" & <tag>`)).toBe("it&#39;s a &quot;quote&quot; &amp; &lt;tag&gt;");
  });
});

describe("markdown", () => {
  test("raw HTML is dropped unless allowed", () => {
    expect(renderMarkdown("<b>hi</b>")).not.toContain("<b>");
    expect(renderMarkdown("<b>hi</b>", { allowHtml: true })).toContain("<b>");
  });
});

describe("tokens", () => {
  test("an external font path is a hard error", () => {
    const { errors } = renderTokensCss({ font: { body: "https://fonts.example/x.woff2" } });
    expect(errors.join("\n")).toMatch(/external URL/);
  });

  test("a self-hosted font produces an @font-face and a font asset", () => {
    const { css, fontAssets } = renderTokensCss({ font: { body: "theme/fonts/inter.woff2" } });
    expect(css).toContain("@font-face");
    expect(fontAssets).toEqual([{ family: "homespace-body", path: "theme/fonts/inter.woff2" }]);
  });
});

describe("pages layout", () => {
  test("landing + one page per section, with generated section nav and sitemap", async () => {
    const result = await render({ catalog, homespace: { ...homespace, layout: "pages" }, root: demoRoot });
    expect(result.errors).toEqual([]);

    const paths = result.files.map((f) => f.path);
    // landing + a page per non-landing section (hero is the landing)
    expect(paths).toContain("index.html");
    expect(paths).toContain("games/index.html");
    expect(paths).toContain("writing/index.html");
    expect(paths).toContain("elsewhere/index.html");
    expect(paths).toContain("art/index.html");

    const index = file(result, "index.html").contents;
    expect(index).toContain('href="games/"');
    expect(index).toContain('href="./"'); // landing nav link

    const games = file(result, "games/index.html").contents;
    expect(games).toContain('href="../base.css"'); // depth-1 asset prefix
    expect(games).toContain('href="../games/"'); // nav from a section page

    const sitemap = file(result, "sitemap.txt").contents;
    expect(sitemap).toContain("/games/");
    expect(sitemap).toContain("/writing/");

    expect(findBudgetViolations(result.files)).toEqual([]);
    expect(index).toMatchSnapshot();
  });
});

describe("grid layout", () => {
  test("index is a tile grid; every section gets its own page", async () => {
    const result = await render({ catalog, homespace: { ...homespace, layout: "grid" }, root: demoRoot });
    expect(result.errors).toEqual([]);

    const index = file(result, "index.html").contents;
    expect(index).toContain('class="tiles"');
    expect(index).toContain('class="tile" href="hero/"');
    expect(index).toContain('class="tile" href="games/"');

    const paths = result.files.map((f) => f.path);
    expect(paths).toContain("hero/index.html"); // grid: even the first section is a page
    expect(paths).toContain("games/index.html");

    expect(findBudgetViolations(result.files)).toEqual([]);
    expect(index).toMatchSnapshot();
  });
});

describe("embed + html sections", () => {
  const embedNode: HomespaceManifest = {
    name: "embed-demo",
    title: "Embed Demo",
    layout: "scroll",
    sections: [
      { type: "embed", title: "Toy", src: "static/toy.html", height: 300 },
      { type: "html", file: "sections/extra.html" },
    ],
  };
  const emptyCatalog = { version: 1 as const, packs: [] };

  test("embed iframes a local file; html is inserted verbatim; budget stays clean", async () => {
    const result = await render({ catalog: emptyCatalog, homespace: embedNode, root: demoRoot });
    expect(result.errors).toEqual([]);
    const index = file(result, "index.html").contents;
    expect(index).toContain('<iframe class="embed" src="static/toy.html"');
    expect(index).toContain("height:300px");
    expect(index).toContain("<h2>Hand-written section</h2>"); // verbatim, not escaped
    expect(findBudgetViolations(result.files)).toEqual([]);
  });

  test("a missing html-section file is a render error", async () => {
    const bad: HomespaceManifest = { name: "x", sections: [{ type: "html", file: "sections/missing.html" }] };
    const result = await render({ catalog: emptyCatalog, homespace: bad, root: demoRoot });
    expect(result.errors.map((e) => e.message).join("\n")).toMatch(/does not exist/);
  });

  test("an external iframe src trips the offline-budget gate", async () => {
    const external: HomespaceManifest = { name: "x", sections: [{ type: "embed", src: "https://evil.example/x.html" }] };
    const result = await render({ catalog: emptyCatalog, homespace: external, root: demoRoot });
    expect(findBudgetViolations(result.files).length).toBeGreaterThan(0);
  });
});

describe("player & downloads (WO-6)", () => {
  const players: Catalog = {
    version: 1,
    packs: [
      { id: "std", type: "game", title: "Std", slug: "std", dir: "content/packs/std", entrypoint: { web: "index.html" } },
      { id: "strict-game", type: "game", title: "Strict", slug: "strict-game", dir: "content/packs/strict-game", entrypoint: { web: "index.html" }, sandbox: "strict" },
      { id: "dl", type: "game", title: "DL", slug: "dl", dir: "content/packs/dl", entrypoint: { download: "game.zip" }, checksums: { "game.zip": `sha256:${"a".repeat(64)}` } },
      { id: "strict-dl", type: "game", title: "Strict DL", slug: "strict-dl", dir: "content/packs/strict-dl", entrypoint: { web: "index.html", download: "build.zip" }, sandbox: "strict" },
    ],
  };
  const playerNode: HomespaceManifest = { name: "players", sections: [{ type: "packs", source: {} }] };

  test("sandboxTokens: strict omits allow-same-origin; standard includes it", () => {
    expect(sandboxTokens("strict")).not.toContain("allow-same-origin");
    expect(sandboxTokens(undefined)).toContain("allow-same-origin");
    expect(sandboxTokens("standard")).toContain("allow-same-origin");
  });

  test("web pack detail is a load-on-click player with the right sandbox", async () => {
    const result = await render({ catalog: players, homespace: playerNode, root: demoRoot });
    expect(result.errors).toEqual([]);

    const std = file(result, "packs/std/index.html").contents;
    expect(std).toContain('class="player"');
    expect(std).toContain('data-src="../../packs/std/files/index.html"');
    expect(std).toContain("allow-same-origin"); // standard sandbox
    expect(std).toContain("player-play"); // load-on-click button, no autoloaded iframe
    expect(std).not.toContain("<iframe"); // iframe is injected by script, not in static HTML
    expect(std).toContain("player-fullscreen");
    expect(std).toContain("<script>"); // inline player script
    expect(std).toContain("<noscript>"); // JS-disabled fallback

    const strict = file(result, "packs/strict-game/index.html").contents;
    expect(strict).toContain("data-sandbox=");
    expect(strict).not.toContain("allow-same-origin");
  });

  test("a strict pack is never linked as a same-origin document (WO-12 P1-2)", async () => {
    const result = await render({ catalog: players, homespace: playerNode, root: demoRoot });

    // Operator-authored (standard): the plain direct link stays.
    expect(file(result, "packs/std/index.html").contents).toContain("Open the build directly");

    const strict = file(result, "packs/strict-game/index.html").contents;
    expect(strict).not.toContain("Open the build directly");
    expect(strict).not.toContain('href="../../packs/strict-game/files/index.html"');
    expect(strict).toContain("only runs inside the sandboxed player");

    // With a download, the no-JS path is the download rather than the origin.
    const withDownload = file(result, "packs/strict-dl/index.html").contents;
    expect(withDownload).not.toContain("Open the build directly");
    expect(withDownload).toContain('<a href="../../packs/strict-dl/files/build.zip" download>Download it</a>');
  });

  test("download pack detail shows a download link with its checksum", async () => {
    const result = await render({ catalog: players, homespace: playerNode, root: demoRoot });
    const dl = file(result, "packs/dl/index.html").contents;
    expect(dl).toContain('class="download"');
    expect(dl).toContain("download>");
    expect(dl).toContain(`sha256:${"a".repeat(64)}`);
  });

  test("player pages keep the offline budget (inline script, local iframe src)", async () => {
    const result = await render({ catalog: players, homespace: playerNode, root: demoRoot });
    expect(findBudgetViolations(result.files)).toEqual([]);
  });
});

describe("thumbnails (WO-8)", () => {
  test("isRasterImage: raster yes, svg no", () => {
    expect(isRasterImage("a.webp")).toBe(true);
    expect(isRasterImage("a.PNG")).toBe(true);
    expect(isRasterImage("a.svg")).toBe(false);
  });

  test("thumbnails on: cards/gallery reference .thumbs/ and thumb ops are emitted", async () => {
    const result = await render({ catalog, homespace, root: demoRoot, thumbnails: true });
    expect(result.thumbnails.map((t) => t.to)).toContain(".thumbs/packs/portfolio/files/cover.webp");
    expect(file(result, "index.html").contents).toContain(".thumbs/packs/portfolio/files/cover.webp");
    expect(findBudgetViolations(result.files)).toEqual([]);
  });

  test("thumbnails off (default): full images, no thumb ops", async () => {
    const result = await render({ catalog, homespace, root: demoRoot });
    expect(result.thumbnails).toEqual([]);
    const index = file(result, "index.html").contents;
    expect(index).toContain("packs/portfolio/files/cover.webp");
    expect(index).not.toContain(".thumbs/");
  });

  test("writeDist uses the thumbnailer when present, and copies as fallback when absent", async () => {
    const result = await render({ catalog, homespace, root: demoRoot, thumbnails: true });

    const withOut = await mkdtemp(path.join(tmpdir(), "homespace-thumb-"));
    const withoutOut = await mkdtemp(path.join(tmpdir(), "homespace-nothumb-"));
    try {
      let calls = 0;
      const thumbnailer: Thumbnailer = async () => {
        calls += 1;
        return new Uint8Array([1, 2, 3]);
      };
      await writeDist(result, withOut, { thumbnailer });
      expect(calls).toBeGreaterThan(0);
      const generated = await readFile(path.join(withOut, ".thumbs/packs/portfolio/files/cover.webp"));
      expect(generated.length).toBe(3); // downscaled bytes from the fake thumbnailer

      // No thumbnailer → the reference still resolves via a copy of the original.
      await writeDist(result, withoutOut);
      const copied = await readFile(path.join(withoutOut, ".thumbs/packs/portfolio/files/cover.webp"), "utf8");
      expect(copied).toContain("fake-webp-portfolio-cover");
    } finally {
      await rm(withOut, { recursive: true, force: true });
      await rm(withoutOut, { recursive: true, force: true });
    }
  });
});

describe("dist pruning — dist is build-owned (WO-12 P1-1)", () => {
  const tempDirs: string[] = [];
  afterEach(async () => {
    while (tempDirs.length) await rm(tempDirs.pop()!, { recursive: true, force: true });
  });

  async function outDir(): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), "homespace-prune-"));
    tempDirs.push(dir);
    return dir;
  }

  const gone = async (p: string): Promise<boolean> => {
    try {
      await stat(p);
      return false;
    } catch {
      return true;
    }
  };

  test("removing a pack leaves no detail page, files/, or .thumbs/ behind", async () => {
    const out = await outDir();
    const full = await render({ catalog, homespace, root: demoRoot, thumbnails: true });
    await writeDist(full, out);
    expect((await stat(path.join(out, "packs/solterra/index.html"))).isFile()).toBe(true);
    expect((await stat(path.join(out, "packs/solterra/files/cover.webp"))).isFile()).toBe(true);
    expect((await stat(path.join(out, ".thumbs/packs/solterra/files/cover.webp"))).isFile()).toBe(true);

    // The operator deletes the pack; the next build must mirror that exactly.
    const trimmed: Catalog = { ...catalog, packs: catalog.packs.filter((p) => p.id !== "solterra") };
    const after = await render({ catalog: trimmed, homespace, root: demoRoot, thumbnails: true });
    const report = await writeDist(after, out);

    expect(report.pruned).toContain("packs/solterra/index.html");
    expect(report.pruned).toContain("packs/solterra/files/cover.webp");
    expect(report.pruned).toContain(".thumbs/packs/solterra/files/cover.webp");
    expect(await gone(path.join(out, "packs/solterra"))).toBe(true);
    expect(await gone(path.join(out, ".thumbs/packs/solterra"))).toBe(true);
    // The packs that remain are untouched.
    expect((await stat(path.join(out, "packs/portfolio/index.html"))).isFile()).toBe(true);
  });

  test("static/ is the supported passthrough: CNAME reaches the dist root and survives", async () => {
    const out = await outDir();
    const result = await render({ catalog, homespace, root: demoRoot });
    expect(result.assets.map((a) => a.to)).toContain("CNAME");

    await writeDist(result, out);
    const second = await writeDist(await render({ catalog, homespace, root: demoRoot }), out);
    expect(second.pruned).toEqual([]);
    expect((await stat(path.join(out, "CNAME"))).isFile()).toBe(true);
  });

  test("a hand-placed file in dist/ is pruned and reported", async () => {
    const out = await outDir();
    const result = await render({ catalog, homespace, root: demoRoot });
    await writeDist(result, out);
    await writeFile(path.join(out, "stowaway.html"), "<p>hand-placed</p>");
    await writeFile(path.join(out, "packs/portfolio/notes.txt"), "left over");

    const report = await writeDist(result, out);
    expect(report.pruned).toEqual(["packs/portfolio/notes.txt", "stowaway.html"]);
    expect(await gone(path.join(out, "stowaway.html"))).toBe(true);
    expect((await stat(path.join(out, "packs/portfolio/index.html"))).isFile()).toBe(true);
  });

  test("writing into a fresh directory prunes nothing", async () => {
    const out = await outDir();
    const report = await writeDist(await render({ catalog, homespace, root: demoRoot }), out);
    expect(report.pruned).toEqual([]);
  });

  test("emittedPaths claims every generated file, copy, and thumbnail", async () => {
    const result = await render({ catalog, homespace, root: demoRoot, thumbnails: true });
    const paths = emittedPaths(result);
    expect(paths).toEqual([...paths].sort());
    expect(paths).toContain("index.html");
    expect(paths).toContain("CNAME");
    expect(paths).toContain(".thumbs/packs/portfolio/files/cover.webp");
  });
});

describe("writeDist — round trip", () => {
  test("writes generated files and asset copies to disk", async () => {
    const result = await render({ catalog, homespace, root: demoRoot });
    const out = await mkdtemp(path.join(tmpdir(), "homespace-dist-"));
    try {
      await writeDist(result, out);
      const index = await readFile(path.join(out, "index.html"), "utf8");
      expect(index).toContain("Demo Homespace");
      // A copied binary asset landed too.
      const cover = await readFile(path.join(out, "packs/solterra/files/cover.webp"), "utf8");
      expect(cover).toContain("fake-webp-solterra");
      // Re-crawl the written HTML/CSS for offline-budget compliance.
      const written = [
        { path: "index.html", contents: index },
        { path: "tokens.css", contents: await readFile(path.join(out, "tokens.css"), "utf8") },
      ];
      expect(findBudgetViolations(written)).toEqual([]);
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });
});
