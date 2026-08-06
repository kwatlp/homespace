import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { confineToBase, scan, serializeCatalog, type ScanIssue } from "./index";

const fixture = (name: string): string =>
  fileURLToPath(new URL(`../test/fixtures/${name}`, import.meta.url));

const messages = (issues: ScanIssue[]): string => issues.map((i) => i.message).join("\n");

describe("scan — valid sample homespace", () => {
  test("produces a deterministic, sorted catalog with derived fields", async () => {
    const result = await scan({ root: fixture("sample") });

    expect(messages(result.errors)).toBe("");
    expect(result.ok).toBe(true);
    expect(result.catalog.version).toBe(1);
    expect(result.catalog.generated).toBeUndefined();

    // Sorted by id (codepoint), one entry per valid pack.
    expect(result.catalog.packs.map((p) => p.id)).toEqual([
      "cedar-study",
      "elsewhere",
      "field-notes",
      "solterra-build",
      "solterra-demo",
    ]);

    for (const pack of result.catalog.packs) {
      expect(pack.slug).toBe(pack.id);
      expect(pack.dir).toBe(`content/packs/${pack.id}`);
    }
  });

  test("serialized catalog matches snapshot", async () => {
    const result = await scan({ root: fixture("sample") });
    expect(serializeCatalog(result.catalog)).toMatchSnapshot();
  });

  test("serialization is deterministic across runs", async () => {
    const a = await scan({ root: fixture("sample") });
    const b = await scan({ root: fixture("sample") });
    expect(serializeCatalog(a.catalog)).toBe(serializeCatalog(b.catalog));
  });

  test("--verify passes when checksums match", async () => {
    const result = await scan({ root: fixture("sample"), verify: true });
    expect(messages(result.errors)).toBe("");
    expect(result.ok).toBe(true);
  });

  test("stamp populates catalog.generated (opt-in only)", async () => {
    const result = await scan({ root: fixture("sample"), stamp: "2026-08-01T00:00:00Z" });
    expect(result.catalog.generated).toBe("2026-08-01T00:00:00Z");
  });
});

describe("scan — security: path traversal is rejected (TDD §12)", () => {
  test("escaping and absolute paths are errors, and their packs are excluded", async () => {
    const result = await scan({ root: fixture("evil") });

    expect(result.ok).toBe(false);
    expect(result.catalog.packs).toHaveLength(0);
    expect(messages(result.errors)).toMatch(/escapes the pack folder/);
    expect(messages(result.errors)).toMatch(/absolute paths are not allowed/);
  });
});

describe("scan — malformed and invalid packs", () => {
  test("bad JSON, schema-invalid, and checksum-key errors are reported; empty folder warns", async () => {
    const result = await scan({ root: fixture("broken") });

    expect(result.ok).toBe(false);
    expect(result.catalog.packs).toHaveLength(0);
    expect(messages(result.errors)).toMatch(/not valid JSON/);
    expect(messages(result.errors)).toMatch(/has no checksum/);
    // schema rejection surfaces (missing required title)
    expect(result.errors.some((e) => e.pack === "missing-title")).toBe(true);
    // a folder without manifest.json is a skip-warning, not a hard error
    expect(result.warnings.some((w) => w.pack === "empty")).toBe(true);
  });
});

describe("scan — checksum verification", () => {
  test("mismatch is only caught with --verify", async () => {
    const root = fixture("bad-checksum");

    const lenient = await scan({ root });
    expect(lenient.ok).toBe(true);

    const verified = await scan({ root, verify: true });
    expect(verified.ok).toBe(false);
    expect(messages(verified.errors)).toMatch(/checksum mismatch/);
  });
});

describe("scan — missing content/packs", () => {
  test("a folder that is not there at all is an error", async () => {
    const result = await scan({ root: fixture("does-not-exist") });
    expect(result.ok).toBe(false);
    expect(result.catalog.packs).toHaveLength(0);
    expect(messages(result.errors)).toMatch(/no content\/packs directory/);
  });

  test("a homespace with no packs yet warns and builds", async () => {
    const empty = await mkdtemp(path.join(tmpdir(), "homespace-empty-"));
    try {
      const result = await scan({ root: empty });
      expect(result.errors).toEqual([]);
      expect(result.ok).toBe(true);
      expect(result.catalog.packs).toHaveLength(0);
      expect(messages(result.warnings)).toMatch(/no packs yet/);
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });
});

describe("confineToBase — unit", () => {
  const base = "/homespaces/demo/content/packs/x";

  test.each([
    ["index.html", true],
    ["dist/game.zip", true],
    ["a/b/c.webp", true],
    ["../secret.txt", false],
    ["../../etc/passwd", false],
    ["/etc/hosts", false],
    ["", false],
  ])("confineToBase(base, %j) → ok=%s", (rel, ok) => {
    expect(confineToBase(base, rel).ok).toBe(ok);
  });

  test("rejects a null byte", () => {
    expect(confineToBase(base, "a\0b").ok).toBe(false);
  });
});
