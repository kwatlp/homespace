import { describe, expect, test } from "vitest";

import {
  type PackManifest,
  type HomespaceManifest,
  type Catalog,
  validateCatalog,
  validateHomespace,
  validatePack,
} from "./index";

const SHA = `sha256:${"a".repeat(64)}`;

describe("validatePack — valid manifests, one per type", () => {
  const valid: Record<string, PackManifest> = {
    "game (web)": {
      id: "solterra-demo",
      type: "game",
      title: "Solterra Demo",
      entrypoint: { web: "index.html" },
    },
    "game (download + checksum)": {
      id: "solterra-build",
      type: "game",
      title: "Solterra Build",
      entrypoint: { download: "dist/game.zip" },
      checksums: { "dist/game.zip": SHA },
    },
    app: {
      id: "tmixw",
      type: "app",
      title: "tmíxʷ",
      entrypoint: { web: "app/index.html" },
    },
    "art (no entrypoint required)": {
      id: "cedar-study",
      type: "art",
      title: "Cedar Study",
      media: { cover: "cover.webp", alt: { "cover.webp": "A cedar." } },
    },
    post: {
      id: "devlog-01",
      type: "post",
      title: "Dev Log 01",
      entrypoint: { post: "index.md" },
    },
    link: {
      id: "elsewhere",
      type: "link",
      title: "Elsewhere",
      entrypoint: { link: "https://example.com/thing" },
    },
    bundle: { id: "starter-kit", type: "bundle", title: "Starter Kit" },
  };

  for (const [name, manifest] of Object.entries(valid)) {
    test(name, () => {
      const result = validatePack(manifest);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    });
  }
});

describe("validatePack — invalid manifests are rejected", () => {
  const invalid: Record<string, unknown> = {
    "missing title": { id: "x", type: "game", entrypoint: { web: "i.html" } },
    "bad id (uppercase/space)": { id: "Not A Slug", type: "art", title: "X" },
    "unknown type value": { id: "x", type: "movie", title: "X" },
    "game without entrypoint": { id: "x", type: "game", title: "X" },
    "game entrypoint missing web/download": {
      id: "x",
      type: "game",
      title: "X",
      entrypoint: { post: "index.md" },
    },
    "post without entrypoint.post": {
      id: "x",
      type: "post",
      title: "X",
      entrypoint: { web: "i.html" },
    },
    "link without entrypoint.link": { id: "x", type: "link", title: "X" },
    "download without checksums": {
      id: "x",
      type: "game",
      title: "X",
      entrypoint: { download: "g.zip" },
    },
    "bad checksum format": {
      id: "x",
      type: "game",
      title: "X",
      entrypoint: { download: "g.zip" },
      checksums: { "g.zip": "md5:nope" },
    },
    "unknown entrypoint key": {
      id: "x",
      type: "game",
      title: "X",
      entrypoint: { web: "i.html", bogus: "y" },
    },
  };

  for (const [name, manifest] of Object.entries(invalid)) {
    test(name, () => {
      const result = validatePack(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  }
});

describe("unknown-field policy — warn, keep, pass through (TDD §3)", () => {
  test("unknown top-level pack field is valid with a warning, and is kept", () => {
    const manifest = {
      id: "x",
      type: "art",
      title: "X",
      experimental_flag: true,
    };
    const result = validatePack(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((w) => w.path)).toContain("/experimental_flag");
    // Kept: validation never strips the field from the caller's object.
    expect(manifest.experimental_flag).toBe(true);
  });

  test("unknown top-level homespace field is valid with a warning", () => {
    const result = validateHomespace({ name: "cedar", surprise: 1 });
    expect(result.valid).toBe(true);
    expect(result.warnings.map((w) => w.path)).toContain("/surprise");
  });
});

describe("validateHomespace", () => {
  const fullNode: HomespaceManifest = {
    name: "homespace",
    title: "kʷátɬp",
    tagline: "cedar, roots, worlds",
    lang: "en",
    local: { host: "cedar", port: 4321, mdns: false },
    layout: "scroll",
    theme: {
      tokens: {
        color: { bg: "#14100c", surface: "#1f1813", text: "#f3e9dd", accent: "#d97b4a" },
        font: { body: "theme/fonts/inter.woff2", scale: 1 },
        space: { unit: 8 },
        radius: 10,
        maxWidth: 760,
      },
      css: "theme/custom.css",
    },
    nav: [{ label: "Play", href: "#packs" }],
    sections: [
      { type: "hero", heading: "Hello", sub: "world", media: "static/hero.webp" },
      { type: "packs", title: "Games", source: { types: ["game", "app"] }, style: "cards" },
      { type: "posts", title: "Dev Log", source: { types: ["post"] }, rss: true },
      { type: "embed", src: "static/toy.html", height: 420 },
      { type: "html", file: "sections/anything.html" },
    ],
    footer: { text: "© kʷátɬp", links: [] },
  };

  test("minimal homespace ({ name }) is valid", () => {
    const result = validateHomespace({ name: "cedar" });
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  test("full homespace example is valid", () => {
    const result = validateHomespace(fullNode);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  const invalid: Record<string, unknown> = {
    "missing name": { title: "No slug" },
    "bad layout": { name: "x", layout: "carousel" },
    "embed section without src": { name: "x", sections: [{ type: "embed" }] },
    "html section without file": { name: "x", sections: [{ type: "html" }] },
    "nav link missing href": { name: "x", nav: [{ label: "Play" }] },
  };

  for (const [name, manifest] of Object.entries(invalid)) {
    test(`invalid: ${name}`, () => {
      const result = validateHomespace(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  }
});

describe("validateCatalog", () => {
  test("valid catalog", () => {
    const catalog: Catalog = {
      version: 1,
      packs: [
        { id: "solterra-demo", type: "game", title: "Solterra Demo", slug: "solterra-demo", dir: "content/packs/solterra-demo" },
      ],
    };
    const result = validateCatalog(catalog);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  const invalid: Record<string, unknown> = {
    "wrong version": { version: 2, packs: [] },
    "missing packs": { version: 1 },
    "catalog pack missing derived slug/dir": {
      version: 1,
      packs: [{ id: "x", type: "game", title: "X" }],
    },
    "unknown root field (additionalProperties false)": {
      version: 1,
      packs: [],
      extra: true,
    },
  };

  for (const [name, doc] of Object.entries(invalid)) {
    test(`invalid: ${name}`, () => {
      const result = validateCatalog(doc);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  }
});
