import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import type { NodeManifest } from "@kwatlp/schema";
import { findBudgetViolations } from "@kwatlp/renderer";
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
  const d = await mkdtemp(path.join(tmpdir(), "kwatlp-cli-"));
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
    expect(await fileExists(path.join(site, "node.manifest.jsonc"))).toBe(true);
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
    expect(index).toContain("My Node");
    expect(await fileExists(path.join(dist, "feed.xml"))).toBe(true); // posts rss
    expect(await fileExists(path.join(dist, "packs/my-game/index.html"))).toBe(true);

    // the built dist honors the offline budget
    const html = index;
    const css = await readFile(path.join(dist, "base.css"), "utf8");
    expect(findBudgetViolations([{ path: "index.html", contents: html }, { path: "base.css", contents: css }])).toEqual([]);
  });
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
    expect(io.errText()).toMatch(/no node manifest/);
  });

  test("invalid node manifest fails and names the problem", async () => {
    const root = await tmp();
    await writeFile(path.join(root, "node.manifest.jsonc"), '{ "title": "no name here" }', "utf8");
    const io = capture();
    expect(await run(["validate"], { cwd: root, io: io.io })).toBe(1);
    expect(io.errText()).toMatch(/name/);
  });

  test("a valid node validates clean", async () => {
    const root = await tmp();
    expect(await run(["init", "blank", "."], { cwd: root, io: capture().io })).toBe(0);
    const io = capture();
    expect(await run(["validate"], { cwd: root, io: io.io })).toBe(0);
    expect(io.outText()).toMatch(/Valid/);
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
  const base: NodeManifest = { name: "cedar" };

  test("defaults: port 4321, host = name, loopback bind, no mdns", () => {
    const a = resolveAddress(base, {});
    expect(a).toMatchObject({ host: "cedar", port: 4321, mdns: false, bindHost: "127.0.0.1", customUrl: "http://cedar:4321" });
  });

  test("local.port/host honored; mdns binds LAN and yields a .local URL", () => {
    const node: NodeManifest = { name: "cedar", local: { host: "grove", port: 8080, mdns: true } };
    const a = resolveAddress(node, {});
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
      nodeName: "cedar",
      mdns,
    });

    expect(advertised).toEqual({ name: "cedar", port: 0 });
    await handle.close();
    expect(stopped).toBe(true);
  });
});
