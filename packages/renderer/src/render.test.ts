import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Catalog, NodeManifest } from "@kwatlp/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  assertOfflineBudget,
  findBudgetViolations,
  render,
  renderMarkdown,
  renderTokensCss,
  writeDist,
  type OutputFile,
  type RenderResult,
} from "./index";

const demoRoot = fileURLToPath(new URL("../test/fixtures/demo-node", import.meta.url));

const node: NodeManifest = {
  name: "demo",
  title: "Demo Node",
  tagline: "a test node",
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
    { type: "hero", heading: "Demo Node", sub: "a test node", media: "static/hero.webp" },
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

describe("render — demo node", () => {
  let result: RenderResult;
  beforeAll(async () => {
    result = await render({ catalog, node, root: demoRoot });
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
    const again = await render({ catalog, node, root: demoRoot });
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
    expect(fontAssets).toEqual([{ family: "kwatlp-body", path: "theme/fonts/inter.woff2" }]);
  });
});

describe("pages layout", () => {
  test("landing + one page per section, with generated section nav and sitemap", async () => {
    const result = await render({ catalog, node: { ...node, layout: "pages" }, root: demoRoot });
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
    const result = await render({ catalog, node: { ...node, layout: "grid" }, root: demoRoot });
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
  const embedNode: NodeManifest = {
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
    const result = await render({ catalog: emptyCatalog, node: embedNode, root: demoRoot });
    expect(result.errors).toEqual([]);
    const index = file(result, "index.html").contents;
    expect(index).toContain('<iframe class="embed" src="static/toy.html"');
    expect(index).toContain("height:300px");
    expect(index).toContain("<h2>Hand-written section</h2>"); // verbatim, not escaped
    expect(findBudgetViolations(result.files)).toEqual([]);
  });

  test("a missing html-section file is a render error", async () => {
    const bad: NodeManifest = { name: "x", sections: [{ type: "html", file: "sections/missing.html" }] };
    const result = await render({ catalog: emptyCatalog, node: bad, root: demoRoot });
    expect(result.errors.map((e) => e.message).join("\n")).toMatch(/does not exist/);
  });

  test("an external iframe src trips the offline-budget gate", async () => {
    const external: NodeManifest = { name: "x", sections: [{ type: "embed", src: "https://evil.example/x.html" }] };
    const result = await render({ catalog: emptyCatalog, node: external, root: demoRoot });
    expect(findBudgetViolations(result.files).length).toBeGreaterThan(0);
  });
});

describe("writeDist — round trip", () => {
  test("writes generated files and asset copies to disk", async () => {
    const result = await render({ catalog, node, root: demoRoot });
    const out = await mkdtemp(path.join(tmpdir(), "kwatlp-dist-"));
    try {
      await writeDist(result, out);
      const index = await readFile(path.join(out, "index.html"), "utf8");
      expect(index).toContain("Demo Node");
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
