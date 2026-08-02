import { createServer } from "node:http";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import type { HomespaceManifest } from "@homespace/schema";
import { findBudgetViolations } from "@homespace/renderer";
import { afterEach, describe, expect, test } from "vitest";

import {
  contentType,
  createHandler,
  hostsHint,
  resolveAddress,
  run,
  startDev,
  stripJsonComments,
  type MdnsFactory,
} from "./index";

function capture() {
  let out = "";
  let err = "";
  return {
    io: { out: (m: string) => (out += m), err: (m: string) => (err += m) },
    outText: () => out,
    errText: () => err,
  };
}

const tmpDirs: string[] = [];
async function tmp(): Promise<string> {
  const d = await mkdtemp(path.join(tmpdir(), "homespace-cli-"));
  tmpDirs.push(d);
  return d;
}
afterEach(async () => {
  while (tmpDirs.length) await rm(tmpDirs.pop()!, { recursive: true, force: true });
});

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

describe("init → new → build (e2e)", () => {
  test("scaffolds the blank archetype, adds a pack, and builds an offline dist", async () => {
    const root = await tmp();

    // init into ./site
    const initIo = capture();
    expect(await run(["init", "blank", "site"], { cwd: root, io: initIo.io })).toBe(0);
    const site = path.join(root, "site");
    expect(await fileExists(path.join(site, "homespace.manifest.jsonc"))).toBe(true);
    expect(await fileExists(path.join(site, "content/packs/welcome/index.md"))).toBe(true);

    // init into a non-empty dir fails
    expect(await run(["init", "blank", "site"], { cwd: root, io: capture().io })).toBe(1);

    // add a game pack
    const newIo = capture();
    expect(await run(["new", "pack", "game", "my-game"], { cwd: site, io: newIo.io })).toBe(0);
    expect(await fileExists(path.join(site, "content/packs/my-game/manifest.json"))).toBe(true);
    expect(await fileExists(path.join(site, "content/packs/my-game/index.html"))).toBe(true);

    // build
    const buildIo = capture();
    expect(await run(["build"], { cwd: site, io: buildIo.io })).toBe(0);
    expect(buildIo.outText()).toMatch(/Built \d+ pack/);

    const dist = path.join(site, "dist");
    const index = await readFile(path.join(dist, "index.html"), "utf8");
    expect(index).toContain("My Homespace");
    expect(await fileExists(path.join(dist, "feed.xml"))).toBe(true); // posts rss
    expect(await fileExists(path.join(dist, "packs/my-game/index.html"))).toBe(true);

    // the built dist honors the offline budget
    const html = index;
    const css = await readFile(path.join(dist, "base.css"), "utf8");
    expect(findBudgetViolations([{ path: "index.html", contents: html }, { path: "base.css", contents: css }])).toEqual([]);
  });
});

describe("Definition of Done (WO-10, §14)", () => {
  test("init → build → drop a pack → restyle, all offline and JS-optional", async () => {
    const root = await tmp();
    expect(await run(["init", "author", "."], { cwd: root, io: capture().io })).toBe(0);
    expect(await run(["build"], { cwd: root, io: capture().io })).toBe(0);

    const dist = path.join(root, "dist");
    const index = await readFile(path.join(dist, "index.html"), "utf8");
    // Readable with JavaScript disabled: content is in the static HTML, and no
    // external resource is loaded.
    expect(index).toContain("A. Writer");
    expect(index).not.toMatch(/<script\b[^>]*\bsrc=/i);

    // Drop a new pack, rebuild → it appears.
    expect(await run(["new", "pack", "post", "fresh-note"], { cwd: root, io: capture().io })).toBe(0);
    expect(await run(["build"], { cwd: root, io: capture().io })).toBe(0);
    expect((await stat(path.join(dist, "posts/fresh-note/index.html"))).isFile()).toBe(true);

    // Restyle by editing a token only.
    const before = await readFile(path.join(dist, "tokens.css"), "utf8");
    const manifestPath = path.join(root, "homespace.manifest.jsonc");
    const manifest = await readFile(manifestPath, "utf8");
    await writeFile(manifestPath, manifest.replace(/"accent":\s*"#[0-9a-fA-F]+"/, '"accent": "#00ffcc"'));
    expect(await run(["build"], { cwd: root, io: capture().io })).toBe(0);
    const after = await readFile(path.join(dist, "tokens.css"), "utf8");
    expect(after).not.toBe(before);
    expect(after).toContain("#00ffcc");
  });

  test("the docs/ folder builds as a homespace (dogfood)", async () => {
    const docsSrc = fileURLToPath(new URL("../../../docs", import.meta.url));
    const work = await tmp();
    const dst = path.join(work, "docs");
    await cp(docsSrc, dst, { recursive: true, filter: (src) => !src.includes(`${path.sep}dist`) });
    expect(await run(["build"], { cwd: dst, io: capture().io })).toBe(0);
    const index = await readFile(path.join(dst, "dist", "index.html"), "utf8");
    expect(index).toContain("homespace");
    expect(await fileExists(path.join(dst, "dist", "feed.xml"))).toBe(true);
  });
});

describe("archetypes (WO-7)", () => {
  async function crawlable(dist: string): Promise<{ path: string; contents: string }[]> {
    const rels = await readdir(dist, { recursive: true });
    const out: { path: string; contents: string }[] = [];
    for (const rel of rels) {
      const relStr = String(rel).replace(/\\/g, "/");
      if (!/\.(html?|css)$/i.test(relStr)) continue;
      out.push({ path: relStr, contents: await readFile(path.join(dist, relStr), "utf8") });
    }
    return out;
  }

  for (const archetype of ["link-hub", "author", "illustrator", "game-designer"]) {
    test(`${archetype}: init → build is clean, offline, and accessible`, async () => {
      const root = await tmp();
      expect(await run(["init", archetype, "site"], { cwd: root, io: capture().io })).toBe(0);
      const site = path.join(root, "site");

      const buildIo = capture();
      expect(await run(["build"], { cwd: site, io: buildIo.io })).toBe(0);

      const dist = path.join(site, "dist");
      const index = await readFile(path.join(dist, "index.html"), "utf8");
      // landmarks present (a11y smoke)
      expect(index).toContain('<main id="main">');
      expect(index).toContain("<header");
      expect(index).toContain("<footer");

      const files = await crawlable(dist);
      // no external resource loads anywhere in the build
      expect(findBudgetViolations(files)).toEqual([]);
      // every <img> has an alt attribute
      for (const f of files) {
        const imgWithoutAlt = /<img (?![^>]*\balt=)[^>]*>/i.test(f.contents);
        expect(imgWithoutAlt, `${f.path} has an <img> without alt`).toBe(false);
      }
    });
  }
});

describe("new pack — guards", () => {
  test("rejects an unknown type and a bad id", async () => {
    const root = await tmp();
    const io = capture();
    expect(await run(["new", "pack", "movie", "x"], { cwd: root, io: io.io })).toBe(1);
    expect(io.errText()).toMatch(/unknown pack type/);

    const io2 = capture();
    expect(await run(["new", "pack", "game", "Not A Slug"], { cwd: root, io: io2.io })).toBe(1);
    expect(io2.errText()).toMatch(/must be a slug/);
  });
});

describe("validate — exit codes and error voice", () => {
  test("missing manifest fails with a helpful message", async () => {
    const root = await tmp();
    const io = capture();
    expect(await run(["validate"], { cwd: root, io: io.io })).toBe(1);
    expect(io.errText()).toMatch(/no homespace manifest/);
  });

  test("invalid homespace manifest fails and names the problem", async () => {
    const root = await tmp();
    await writeFile(path.join(root, "homespace.manifest.jsonc"), '{ "title": "no name here" }', "utf8");
    const io = capture();
    expect(await run(["validate"], { cwd: root, io: io.io })).toBe(1);
    expect(io.errText()).toMatch(/name/);
  });

  test("a valid homespace validates clean", async () => {
    const root = await tmp();
    expect(await run(["init", "blank", "."], { cwd: root, io: capture().io })).toBe(0);
    const io = capture();
    expect(await run(["validate"], { cwd: root, io: io.io })).toBe(0);
    expect(io.outText()).toMatch(/Valid/);
  });

  test("legacy node.manifest.jsonc still loads, with a deprecation warning", async () => {
    const root = await tmp();
    // Scaffold, then rename the manifest back to the legacy name.
    await run(["init", "blank", "."], { cwd: root, io: capture().io });
    const current = await readFile(path.join(root, "homespace.manifest.jsonc"), "utf8");
    await rm(path.join(root, "homespace.manifest.jsonc"));
    await writeFile(path.join(root, "node.manifest.jsonc"), current);

    const io = capture();
    expect(await run(["build"], { cwd: root, io: io.io })).toBe(0);
    expect(io.errText()).toMatch(/deprecated/);
    expect((await stat(path.join(root, "dist", "index.html"))).isFile()).toBe(true);
  });
});

describe("build — flags", () => {
  test("--stamp populates catalog.generated", async () => {
    const root = await tmp();
    await run(["init", "blank", "."], { cwd: root, io: capture().io });
    expect(await run(["build", "--stamp"], { cwd: root, io: capture().io })).toBe(0);
    const catalog = JSON.parse(await readFile(path.join(root, "dist", "catalog.json"), "utf8")) as { generated?: string };
    expect(typeof catalog.generated).toBe("string");
  });
});

describe("unknown command", () => {
  test("returns 1 and suggests commands", async () => {
    const io = capture();
    expect(await run(["frobnicate"], { io: io.io })).toBe(1);
    expect(io.errText()).toMatch(/unknown command/);
  });
});

describe("jsonc", () => {
  test("strips line and block comments, keeps strings", () => {
    const src = '{\n  // a\n  "url": "http://x/*not a comment*/y", /* b */ "n": 1\n}';
    expect(JSON.parse(stripJsonComments(src))).toEqual({ url: "http://x/*not a comment*/y", n: 1 });
  });
});

describe("resolveAddress (§7.1)", () => {
  const base: HomespaceManifest = { name: "cedar" };

  test("defaults: port 4321, host = name, loopback bind, no mdns", () => {
    const a = resolveAddress(base, {});
    expect(a).toMatchObject({ host: "cedar", port: 4321, mdns: false, bindHost: "127.0.0.1", customUrl: "http://cedar:4321" });
  });

  test("local.port/host honored; mdns binds LAN and yields a .local URL", () => {
    const homespace: HomespaceManifest = { name: "cedar", local: { host: "grove", port: 8080, mdns: true } };
    const a = resolveAddress(homespace, {});
    expect(a).toMatchObject({ host: "grove", port: 8080, mdns: true, bindHost: "0.0.0.0", customUrl: "http://grove.local:8080" });
  });

  test("flags override the manifest", () => {
    const a = resolveAddress(base, { port: 3000, host: "myname" });
    expect(a.port).toBe(3000);
    expect(a.host).toBe("myname");
  });

  test("hosts-hint prints a /etc/hosts line", () => {
    expect(hostsHint("cedar", 4321)).toContain("127.0.0.1\tcedar");
  });
});

describe("contentType", () => {
  test("maps known extensions and falls back", () => {
    expect(contentType("a.html")).toMatch(/text\/html/);
    expect(contentType("a.wasm")).toBe("application/wasm");
    expect(contentType("a.unknownext")).toBe("application/octet-stream");
  });
});

describe("static handler", () => {
  test("serves index, sets COI headers, and 404s missing files", async () => {
    const dist = await tmp();
    await writeFile(path.join(dist, "index.html"), "<h1>hi</h1>", "utf8");
    const server = createServer(createHandler(dist, { coi: true }));
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as AddressInfo).port;
    try {
      const ok = await fetch(`http://127.0.0.1:${port}/`);
      expect(ok.status).toBe(200);
      expect(ok.headers.get("content-type")).toMatch(/text\/html/);
      expect(ok.headers.get("cross-origin-opener-policy")).toBe("same-origin");
      expect(ok.headers.get("cross-origin-embedder-policy")).toBe("require-corp");
      expect(await ok.text()).toContain("hi");

      const missing = await fetch(`http://127.0.0.1:${port}/nope.html`);
      expect(missing.status).toBe(404);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  test("confines to dist — encoded traversal cannot read a file outside it", async () => {
    const root = await tmp();
    const dist = path.join(root, "dist");
    await mkdir(dist, { recursive: true });
    await writeFile(path.join(dist, "index.html"), "<h1>ok</h1>", "utf8");
    // A secret one level above dist that traversal must never reach.
    await writeFile(path.join(root, "secret.txt"), "TOPSECRET", "utf8");

    const server = createServer(createHandler(dist));
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as AddressInfo).port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/%2e%2e/secret.txt`);
      expect(res.status).not.toBe(200);
      expect(await res.text()).not.toContain("TOPSECRET");
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});

describe("startDev — mDNS is advertised via the injected factory", () => {
  test("calls the factory when mdns is on and stops it on close", async () => {
    const root = await tmp();
    let advertised: { name: string; port: number } | undefined;
    let stopped = false;
    const mdns: MdnsFactory = (opts) => {
      advertised = { name: opts.name, port: opts.port };
      return { stop: () => { stopped = true; } };
    };

    const handle = await startDev({
      root,
      address: { host: "cedar", port: 0, mdns: true, bindHost: "127.0.0.1", localUrl: "http://localhost:0", customUrl: "http://cedar.local:0" },
      io: capture().io,
      rebuild: async () => {},
      homespaceName: "cedar",
      mdns,
    });

    expect(advertised).toEqual({ name: "cedar", port: 0 });
    await handle.close();
    expect(stopped).toBe(true);
  });
});
