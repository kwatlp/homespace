import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import posix from "node:path/posix";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { run } from "homespace-cli";
import { loadSharpThumbnailer } from "homespace-renderer";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { buildInMemory, MEMORY_ROOT, memoryFiles, type MemoryTree } from "./index";
import * as shim from "./shims/path";

const exec = promisify(execFile);
const quiet = { out: () => {}, err: () => {} };

/** Every file under `dir`, as sorted POSIX paths relative to it. */
async function listTree(dir: string, skip: (rel: string) => boolean = () => false): Promise<string[]> {
  const out: string[] = [];
  async function walk(rel: string): Promise<void> {
    for (const entry of await readdir(path.join(dir, rel), { withFileTypes: true })) {
      const child = rel === "" ? entry.name : `${rel}/${entry.name}`;
      if (skip(child)) continue;
      if (entry.isDirectory()) await walk(child);
      else if (entry.isFile()) out.push(child);
    }
  }
  await walk("");
  return out.sort();
}

async function loadTree(dir: string, skip: (rel: string) => boolean): Promise<MemoryTree> {
  const tree: MemoryTree = {};
  for (const rel of await listTree(dir, skip)) {
    tree[rel] = new Uint8Array(await readFile(path.join(dir, rel)));
  }
  return tree;
}

describe("browser build ≡ CLI build (WO-21)", () => {
  const temps: string[] = [];
  let site: string;
  let bundlePath: string;
  let bundled: typeof import("./index");

  beforeAll(async () => {
    const root = await mkdtemp(path.join(tmpdir(), "homespace-builder-"));
    temps.push(root);
    site = path.join(root, "site");

    // The reference build: exactly what `npx homespace build` produces.
    expect(await run(["init", "author", "site"], { cwd: root, io: quiet })).toBe(0);
    expect(await run(["build"], { cwd: site, io: quiet })).toBe(0);

    // The browser bundle, built the documented way and imported as a module.
    const script = fileURLToPath(new URL("../scripts/bundle.mjs", import.meta.url));
    bundlePath = path.join(root, "homespace-build.js");
    await exec(process.execPath, [script, bundlePath]);
    bundled = (await import(pathToFileURL(bundlePath).href)) as typeof import("./index");
  }, 120_000);

  afterAll(async () => {
    while (temps.length) await rm(temps.pop()!, { recursive: true, force: true });
  });

  test("the bundle carries no Node built-ins", async () => {
    const source = await readFile(bundlePath, "utf8");
    expect(source).not.toMatch(/["']node:(fs|path|crypto|http|os|url)/);
    expect(typeof bundled.buildInMemory).toBe("function");
  });

  test("building the same source in memory is byte-identical to dist/", async () => {
    const dist = path.join(site, "dist");
    const notBuildOutput = (rel: string): boolean => rel === "dist" || rel.startsWith("dist/");

    const tree = await loadTree(site, notBuildOutput);
    const manifest = new TextDecoder().decode(tree["homespace.manifest.jsonc"] as Uint8Array);
    const homespace = JSON.parse(stripComments(manifest)) as Record<string, unknown>;

    // The CLI uses sharp when it is installed; hand the browser path the same
    // thumbnailer so the comparison stays exact either way.
    const thumbnailer = await loadSharpThumbnailer();
    const result = await bundled.buildInMemory({
      homespace: homespace as never,
      tree,
      ...(thumbnailer ? { thumbnailer } : {}),
    });

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);

    // Guard against a vacuous comparison of two empty builds.
    expect(result.files.map((f) => f.path)).toContain("index.html");
    expect(result.files.length).toBeGreaterThan(8);

    expect(result.files.map((f) => f.path)).toEqual(await listTree(dist));
    for (const file of result.files) {
      const onDisk = await readFile(path.join(dist, file.path));
      expect(Buffer.from(file.bytes).equals(onDisk), `${file.path} differs from the CLI build`).toBe(true);
    }
  }, 120_000);
});

/** Strip JSONC comments — the manifest a person edits allows them. */
function stripComments(source: string): string {
  let out = "";
  let inString = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    const next = source[i + 1];
    if (inLine) {
      if (c === "\n") {
        inLine = false;
        out += c;
      }
      continue;
    }
    if (inBlock) {
      if (c === "*" && next === "/") {
        inBlock = false;
        i += 1;
      }
      continue;
    }
    if (inString) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i += 1;
      } else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === "/" && next === "/") {
      inLine = true;
      i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlock = true;
      i += 1;
      continue;
    }
    out += c;
  }
  return out;
}

describe("in-memory file access", () => {
  const tree: MemoryTree = {
    "homespace.manifest.jsonc": "{}",
    "content/packs/hello/manifest.json": '{"id":"hello"}',
    "content/packs/hello/index.md": "# Hello\n",
    "static/CNAME": "example.com",
  };

  test("reports kinds, lists directories, and reads bytes and text", async () => {
    const files = memoryFiles(tree);
    expect(await files.kind(`${MEMORY_ROOT}/content/packs/hello/index.md`)).toBe("file");
    expect(await files.kind(`${MEMORY_ROOT}/content/packs`)).toBe("dir");
    expect(await files.kind(MEMORY_ROOT)).toBe("dir");
    expect(await files.kind(`${MEMORY_ROOT}/nope`)).toBeNull();

    expect((await files.list(`${MEMORY_ROOT}/content/packs/hello`)).map((e) => e.name)).toEqual([
      "index.md",
      "manifest.json",
    ]);
    expect(await files.list(`${MEMORY_ROOT}/content`)).toEqual([{ name: "packs", kind: "dir" }]);
    expect(await files.list(`${MEMORY_ROOT}/nope`)).toEqual([]);

    expect(await files.readText(`${MEMORY_ROOT}/static/CNAME`)).toBe("example.com");
    expect(Array.from(await files.read(`${MEMORY_ROOT}/static/CNAME`)).length).toBe(11);
    await expect(files.read(`${MEMORY_ROOT}/nope`)).rejects.toThrow(/no such file/);
  });

  test("accepts Windows-style paths from node:path", async () => {
    const files = memoryFiles(tree);
    expect(await files.kind(`${MEMORY_ROOT}\\content\\packs\\hello\\manifest.json`)).toBe("file");
  });
});

describe("path shim ≡ node:path.posix", () => {
  const cases: string[][] = [
    ["/homespace", "content", "packs"],
    ["/homespace/content", "../static", "hero.webp"],
    ["/homespace", "./a/./b"],
    ["/a/b/c", "../../d"],
    ["/homespace", ""],
  ];

  test("join and resolve agree", () => {
    for (const parts of cases) {
      expect(shim.join(...parts), `join(${parts.join(", ")})`).toBe(posix.join(...parts));
      expect(shim.resolve(...parts), `resolve(${parts.join(", ")})`).toBe(posix.resolve(...parts));
    }
  });

  test("dirname, relative, isAbsolute and extname agree", () => {
    const paths = ["/a/b/c.txt", "/a/b/", "/a", "/", "a/b.c", "index.html"];
    for (const p of paths) {
      expect(shim.dirname(p), `dirname(${p})`).toBe(posix.dirname(p));
      expect(shim.extname(p), `extname(${p})`).toBe(posix.extname(p));
      expect(shim.isAbsolute(p)).toBe(posix.isAbsolute(p));
      expect(shim.basename(p), `basename(${p})`).toBe(posix.basename(p));
    }
    expect(shim.relative("/homespace", "/homespace/content/packs")).toBe("content/packs");
    expect(shim.relative("/homespace/content", "/homespace")).toBe("..");
    expect(shim.relative("/homespace", "/homespace")).toBe("");
    expect(shim.sep).toBe(posix.sep);
  });
});
