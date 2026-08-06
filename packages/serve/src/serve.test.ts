import { mkdir, mkdtemp, readdir, readFile, rm, writeFile, stat } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  authorize,
  canWrite,
  createServeServer,
  readZip,
  rebuild,
  safeEntryName,
  writeZip,
  type ServeConfig,
} from "./index";
import { installPack } from "./server";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

async function makeNode(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "homespace-serve-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    path.join(root, "homespace.manifest.jsonc"),
    JSON.stringify({ name: "srv", title: "Srv", layout: "scroll", sections: [{ type: "posts", title: "Writing", source: { types: ["post"] }, rss: true }] }),
  );
  const hello = path.join(root, "content", "packs", "hello");
  await mkdir(hello, { recursive: true });
  await writeFile(path.join(hello, "manifest.json"), JSON.stringify({ id: "hello", type: "post", title: "Hello", created: "2026-01-01T00:00:00Z", entrypoint: { post: "index.md" } }));
  await writeFile(path.join(hello, "index.md"), "# Hello\n");
  return root;
}

const config = (root: string): ServeConfig => ({
  root,
  operatorKey: "op-secret",
  keys: [
    { key: "scoped-1", scopes: ["packs:write"], allowedIdPrefix: "ext-", allowedTypes: ["post"] },
    { key: "scoped-games", scopes: ["packs:write"], allowedIdPrefix: "ext-", allowedTypes: ["game"] },
  ],
});

async function listen(server: Server): Promise<string> {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  cleanups.push(() => new Promise<void>((r) => server.close(() => r())));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function postZip(id: string, over: Record<string, unknown> = {}): Buffer {
  const manifest = { id, type: "post", title: "Uploaded", created: "2026-02-02T00:00:00Z", entrypoint: { post: "index.md" }, ...over };
  return writeZip([
    { name: "manifest.json", data: Buffer.from(JSON.stringify(manifest)) },
    { name: "index.md", data: Buffer.from("# Uploaded\n") },
  ]);
}

function gameZip(id: string, over: Record<string, unknown> = {}): Buffer {
  const manifest = { id, type: "game", title: "Uploaded Game", created: "2026-02-02T00:00:00Z", entrypoint: { web: "index.html" }, sandbox: "standard", ...over };
  return writeZip([
    { name: "manifest.json", data: Buffer.from(JSON.stringify(manifest)) },
    { name: "index.html", data: Buffer.from("<title>Uploaded Game</title>") },
  ]);
}

/** Rewrite an entry's declared uncompressed size — the shape of a zip bomb. */
function lieAboutSize(zip: Buffer, name: string, size: number): Buffer {
  const out = Buffer.from(zip);
  for (let i = 0; i + 46 <= out.length; i++) {
    if (out.readUInt32LE(i) !== 0x02014b50) continue;
    const nameLen = out.readUInt16LE(i + 28);
    if (out.toString("utf8", i + 46, i + 46 + nameLen) !== name) continue;
    out.writeUInt32LE(size, i + 24);
    return out;
  }
  throw new Error(`no central-directory record for '${name}'`);
}

/** A pack whose only large file compresses to almost nothing. */
function bombZip(bytes: number): Buffer {
  return writeZip(
    [
      { name: "manifest.json", data: Buffer.from(JSON.stringify({ id: "bomb", type: "art", title: "Bomb" })) },
      { name: "big.bin", data: Buffer.alloc(bytes) },
    ],
    { deflate: true },
  );
}

describe("rebuild", () => {
  test("builds the homespace to dist/", async () => {
    const root = await makeNode();
    const result = await rebuild(root);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect((await stat(path.join(root, "dist", "index.html"))).isFile()).toBe(true);
  });
});

describe("static serving", () => {
  test("serves dist and supports range requests", async () => {
    const root = await makeNode();
    await rebuild(root);
    const url = await listen(createServeServer(config(root)));

    const index = await fetch(`${url}/`);
    expect(index.status).toBe(200);
    expect(index.headers.get("content-type")).toMatch(/text\/html/);
    expect(await index.text()).toContain("Srv");

    const range = await fetch(`${url}/index.html`, { headers: { Range: "bytes=0-3" } });
    expect(range.status).toBe(206);
    expect(range.headers.get("content-range")).toMatch(/^bytes 0-3\//);
    expect(Buffer.from(await range.arrayBuffer()).length).toBe(4);

    expect((await fetch(`${url}/nope.html`)).status).toBe(404);
  });
});

describe("upload API — auth", () => {
  test("rejects a missing/invalid key with 401", async () => {
    const root = await makeNode();
    const url = await listen(createServeServer(config(root)));
    const res = await fetch(`${url}/api/packs/newpack`, { method: "PUT", body: postZip("newpack") });
    expect(res.status).toBe(401);
    const res2 = await fetch(`${url}/api/packs/newpack`, { method: "PUT", headers: { Authorization: "Bearer wrong" }, body: postZip("newpack") });
    expect(res2.status).toBe(401);
  });

  test("operator key installs a pack and rebuilds", async () => {
    const root = await makeNode();
    const url = await listen(createServeServer(config(root)));
    const res = await fetch(`${url}/api/packs/newpack`, {
      method: "PUT",
      headers: { Authorization: "Bearer op-secret" },
      body: postZip("newpack"),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, id: "newpack", rebuilt: true });
    // the pack now exists and the site was rebuilt to include it
    expect((await stat(path.join(root, "content", "packs", "newpack", "manifest.json"))).isFile()).toBe(true);
    expect((await fetch(`${url}/posts/newpack/`)).status).toBe(200);
  });
});

describe("upload API — security & scope", () => {
  test("rejects zip-slip entries with 400", async () => {
    const root = await makeNode();
    const url = await listen(createServeServer(config(root)));
    const evil = writeZip([
      { name: "../evil.txt", data: Buffer.from("pwned") },
      { name: "manifest.json", data: Buffer.from(JSON.stringify({ id: "newpack", type: "post", title: "x", entrypoint: { post: "index.md" } })) },
      { name: "index.md", data: Buffer.from("# x\n") },
    ]);
    const res = await fetch(`${url}/api/packs/newpack`, { method: "PUT", headers: { Authorization: "Bearer op-secret" }, body: evil });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toMatch(/unsafe path/);
    // nothing escaped the homespace
    await expect(stat(path.join(root, "..", "evil.txt"))).rejects.toBeTruthy();
  });

  test("id mismatch is rejected", async () => {
    const root = await makeNode();
    const url = await listen(createServeServer(config(root)));
    const res = await fetch(`${url}/api/packs/newpack`, { method: "PUT", headers: { Authorization: "Bearer op-secret" }, body: postZip("different") });
    expect(res.status).toBe(400);
  });

  test("scoped key: id-prefix and type limits are enforced (403)", async () => {
    const root = await makeNode();
    const url = await listen(createServeServer(config(root)));

    // wrong id prefix
    const badPrefix = await fetch(`${url}/api/packs/other`, { method: "PUT", headers: { Authorization: "Bearer scoped-1" }, body: postZip("other") });
    expect(badPrefix.status).toBe(403);

    // right prefix, disallowed type (game)
    const gameZip = writeZip([
      { name: "manifest.json", data: Buffer.from(JSON.stringify({ id: "ext-game", type: "game", title: "G", entrypoint: { web: "index.html" } })) },
      { name: "index.html", data: Buffer.from("<title>G</title>") },
    ]);
    const badType = await fetch(`${url}/api/packs/ext-game`, { method: "PUT", headers: { Authorization: "Bearer scoped-1" }, body: gameZip });
    expect(badType.status).toBe(403);

    // right prefix + allowed type succeeds
    const ok = await fetch(`${url}/api/packs/ext-note`, { method: "PUT", headers: { Authorization: "Bearer scoped-1" }, body: postZip("ext-note") });
    expect(ok.status).toBe(200);
  });
});

describe("upload API — a scoped key never gets the origin (WO-12 P1-2)", () => {
  test("a scoped-key install is forced to strict and loses the direct-open link", async () => {
    const root = await makeNode();
    const url = await listen(createServeServer(config(root)));

    const res = await fetch(`${url}/api/packs/ext-game`, {
      method: "PUT",
      headers: { Authorization: "Bearer scoped-games" },
      body: gameZip("ext-game"),
    });
    expect(res.status).toBe(200);

    // The uploader asked for "standard"; the daemon overrode it on install.
    const installed = JSON.parse(
      await readFile(path.join(root, "content", "packs", "ext-game", "manifest.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(installed["sandbox"]).toBe("strict");
    expect(installed["title"]).toBe("Uploaded Game"); // the rest of the manifest survives

    const page = await (await fetch(`${url}/packs/ext-game/`)).text();
    expect(page).not.toContain("allow-same-origin");
    expect(page).not.toContain("Open the build directly");
  });

  test("an operator's own pack keeps the sandbox it declared", async () => {
    const root = await makeNode();
    const url = await listen(createServeServer(config(root)));

    const res = await fetch(`${url}/api/packs/mine`, {
      method: "PUT",
      headers: { Authorization: "Bearer op-secret" },
      body: gameZip("mine"),
    });
    expect(res.status).toBe(200);

    const installed = JSON.parse(
      await readFile(path.join(root, "content", "packs", "mine", "manifest.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(installed["sandbox"]).toBe("standard");
    expect(await (await fetch(`${url}/packs/mine/`)).text()).toContain("allow-same-origin");
  });
});

describe("upload API — limits (WO-12 P2-3)", () => {
  test("an oversize body is refused with 413 and the daemon stays up", async () => {
    const root = await makeNode();
    await rebuild(root);
    const url = await listen(createServeServer({ ...config(root), maxUploadBytes: 200 }));

    // Declared over the cap: refused before a byte is read.
    const declared = await fetch(`${url}/api/packs/newpack`, {
      method: "PUT",
      headers: { Authorization: "Bearer op-secret" },
      body: Buffer.alloc(4096),
    });
    expect(declared.status).toBe(413);
    expect(JSON.stringify(await declared.json())).toMatch(/larger than the 200-byte limit/);

    // No content-length: refused while spooling.
    const streamed = await fetch(`${url}/api/packs/newpack`, {
      method: "PUT",
      headers: { Authorization: "Bearer op-secret" },
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(4096));
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    expect(streamed.status).toBe(413);

    await expect(stat(path.join(root, "content", "packs", "newpack"))).rejects.toBeTruthy();
    expect((await fetch(`${url}/`)).status).toBe(200);
  });

  test("a zip bomb is refused with 400, honest or lying about its size", async () => {
    const root = await makeNode();
    await rebuild(root);
    const url = await listen(createServeServer({ ...config(root), zipLimits: { maxEntryBytes: 4096 } }));

    const honest = await fetch(`${url}/api/packs/bomb`, {
      method: "PUT",
      headers: { Authorization: "Bearer op-secret" },
      body: bombZip(1_000_000),
    });
    expect(honest.status).toBe(400);
    expect(JSON.stringify(await honest.json())).toMatch(/more than the 4096/);

    const lying = await fetch(`${url}/api/packs/bomb`, {
      method: "PUT",
      headers: { Authorization: "Bearer op-secret" },
      body: lieAboutSize(bombZip(1_000_000), "big.bin", 10),
    });
    expect(lying.status).toBe(400);
    expect(JSON.stringify(await lying.json())).toMatch(/expands beyond/);

    await expect(stat(path.join(root, "content", "packs", "bomb"))).rejects.toBeTruthy();
    expect((await fetch(`${url}/`)).status).toBe(200);
  });
});

describe("upload API — honest answers (WO-12 P3-10, P3-11)", () => {
  test("a failed rebuild answers 422 with ok:false, not 422 with ok:true", async () => {
    const root = await makeNode();
    const url = await listen(createServeServer(config(root)));

    // A valid manifest whose post file is missing: installs, then fails to build.
    const broken = writeZip([
      {
        name: "manifest.json",
        data: Buffer.from(
          JSON.stringify({ id: "broken", type: "post", title: "Broken", created: "2026-02-02T00:00:00Z", entrypoint: { post: "index.md" } }),
        ),
      },
    ]);
    const res = await fetch(`${url}/api/packs/broken`, {
      method: "PUT",
      headers: { Authorization: "Bearer op-secret" },
      body: broken,
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ ok: false, id: "broken", installed: true, rebuilt: false });
    expect((await stat(path.join(root, "content", "packs", "broken", "manifest.json"))).isFile()).toBe(true);
  });

  test("malformed percent-encoding in a path is a 400, not a 500", async () => {
    const root = await makeNode();
    await rebuild(root);
    const url = await listen(createServeServer(config(root)));

    const res = await fetch(`${url}/%zz`);
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toMatch(/percent-encoding/);
    expect((await fetch(`${url}/`)).status).toBe(200);
  });
});

describe("pack install — atomic (WO-12 P2-6)", () => {
  test("a staged pack replaces the previous one wholesale", async () => {
    const root = await makeNode();
    const dest = path.join(root, "content", "packs", "swap");
    await mkdir(dest, { recursive: true });
    await writeFile(path.join(dest, "manifest.json"), '{"version":1}');
    await writeFile(path.join(dest, "leftover.txt"), "only in v1");

    const stage = path.join(root, ".uploads", "stage-1");
    await mkdir(stage, { recursive: true });
    await writeFile(path.join(stage, "manifest.json"), '{"version":2}');

    await installPack(root, "swap", stage);

    expect(await readFile(path.join(dest, "manifest.json"), "utf8")).toBe('{"version":2}');
    await expect(stat(path.join(dest, "leftover.txt"))).rejects.toBeTruthy();
    expect(await readdir(path.join(root, ".uploads"))).toEqual([]);
  });

  test("a failed move restores the pack that was there", async () => {
    const root = await makeNode();
    const dest = path.join(root, "content", "packs", "keep");
    await mkdir(dest, { recursive: true });
    await writeFile(path.join(dest, "manifest.json"), '{"version":1}');

    // A stage that does not exist fails the move after the aside-rename.
    await expect(installPack(root, "keep", path.join(root, ".uploads", "missing"))).rejects.toBeTruthy();
    expect(await readFile(path.join(dest, "manifest.json"), "utf8")).toBe('{"version":1}');
  });
});

describe("zip reader — integrity & limits (WO-12 P2-3, P3-8)", () => {
  test("verifies each entry's CRC-32", () => {
    const zip = writeZip([{ name: "a.txt", data: Buffer.from("hello") }]);
    const at = zip.indexOf(Buffer.from("hello"));
    const tampered = Buffer.from(zip);
    tampered[at] = "H".charCodeAt(0);
    expect(() => readZip(tampered)).toThrow(/CRC-32/);
  });

  test("rejects the u16 entry-count ceiling (a ZIP64 marker)", () => {
    const zip = Buffer.from(writeZip([{ name: "a.txt", data: Buffer.from("x") }]));
    zip.writeUInt16LE(0xffff, zip.length - 22 + 10);
    expect(() => readZip(zip)).toThrow(/65535/);
  });

  test("rejects a ZIP64 central directory", () => {
    const zip = Buffer.from(writeZip([{ name: "a.txt", data: Buffer.from("x") }]));
    zip.writeUInt32LE(0xffffffff, zip.length - 22 + 16);
    expect(() => readZip(zip)).toThrow(/ZIP64/);
  });

  test("rejects an unsupported compression method", () => {
    const zip = Buffer.from(writeZip([{ name: "a.txt", data: Buffer.from("x") }]));
    // method lives at +10 in the central-directory record
    const cd = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    zip.writeUInt16LE(9, cd + 10);
    expect(() => readZip(zip)).toThrow(/compression method 9/);
  });

  test("caps an entry that declares more than the limit, without inflating it", () => {
    expect(() => readZip(bombZip(1_000_000), { maxEntryBytes: 4096 })).toThrow(/more than the 4096/);
  });

  test("caps an entry whose declared size lies", () => {
    const lying = lieAboutSize(bombZip(1_000_000), "big.bin", 10);
    expect(() => readZip(lying, { maxEntryBytes: 4096 })).toThrow(/expands beyond/);
  });

  test("round-trips stored and deflated archives", () => {
    const files = [
      { name: "a.txt", data: Buffer.from("hello") },
      { name: "nested/b.bin", data: Buffer.alloc(1024, 7) },
      { name: "empty.txt", data: Buffer.alloc(0) },
    ];
    for (const options of [{}, { deflate: true }]) {
      const entries = readZip(writeZip(files, options));
      expect(entries.map((e) => e.name)).toEqual(["a.txt", "nested/b.bin", "empty.txt"]);
      expect(entries[0]?.data.toString("utf8")).toBe("hello");
      expect(entries[1]?.data.length).toBe(1024);
      expect(entries[2]?.data.length).toBe(0);
    }
  });
});

describe("keys — units", () => {
  test("authorize matches operator and scoped keys; rejects others", () => {
    const c = config("/tmp/x");
    expect(authorize("op-secret", c)).toEqual({ operator: true });
    expect(authorize("scoped-1", c)).toMatchObject({ operator: false });
    expect(authorize("nope", c)).toBeNull();
    expect(authorize(undefined, c)).toBeNull();
  });

  test("comparison is length-guarded: near misses are rejected (WO-12 P2-4)", () => {
    const c = config("/tmp/x");
    expect(authorize("op-secre", c)).toBeNull();
    expect(authorize("op-secretx", c)).toBeNull();
    expect(authorize("op-secreT", c)).toBeNull();
    expect(authorize("", c)).toBeNull();
  });

  test("canWrite enforces scope", () => {
    const scoped = { operator: false as const, key: { key: "k", scopes: ["packs:write"], allowedIdPrefix: "ext-", allowedTypes: ["post"] } };
    expect(canWrite(scoped, "ext-a", "post").ok).toBe(true);
    expect(canWrite(scoped, "a", "post").ok).toBe(false);
    expect(canWrite(scoped, "ext-a", "game").ok).toBe(false);
    expect(canWrite({ operator: true }, "anything", "game").ok).toBe(true);
  });

  test("safeEntryName confines paths", () => {
    expect(safeEntryName("manifest.json")).toBe("manifest.json");
    expect(safeEntryName("dist/game.zip")).toBe("dist/game.zip");
    expect(safeEntryName("../evil")).toBeNull();
    expect(safeEntryName("/etc/passwd")).toBeNull();
    expect(safeEntryName("C:/x")).toBeNull();
  });
});
