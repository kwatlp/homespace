import { mkdir, mkdtemp, rm, writeFile, stat } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  authorize,
  canWrite,
  createServeServer,
  rebuild,
  safeEntryName,
  writeZip,
  type ServeConfig,
} from "./index";

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
  keys: [{ key: "scoped-1", scopes: ["packs:write"], allowedIdPrefix: "ext-", allowedTypes: ["post"] }],
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

describe("keys — units", () => {
  test("authorize matches operator and scoped keys; rejects others", () => {
    const c = config("/tmp/x");
    expect(authorize("op-secret", c)).toEqual({ operator: true });
    expect(authorize("scoped-1", c)).toMatchObject({ operator: false });
    expect(authorize("nope", c)).toBeNull();
    expect(authorize(undefined, c)).toBeNull();
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
