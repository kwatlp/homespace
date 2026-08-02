import { createReadStream } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { contentType } from "@kwatlp/cli";
import { validatePack } from "@kwatlp/schema";
import { watch } from "chokidar";

import type { ServeConfig } from "./config.js";
import { authorize, bearerToken, canWrite } from "./keys.js";
import { rebuild } from "./rebuild.js";
import { readZip, type ZipEntry } from "./zip.js";

const API_PREFIX = "/api/packs/";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Confine a zip entry name; null rejects it (zip-slip defense, TDD §12). */
export function safeEntryName(name: string): string | null {
  if (name.includes("\0")) return null;
  const norm = name.replace(/\\/g, "/");
  if (norm.startsWith("/") || /^[a-zA-Z]:/.test(norm)) return null;
  if (norm.split("/").includes("..")) return null;
  return norm;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(text);
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/** Unpack validated entries into content/packs/<id>, replacing any prior copy. */
async function installPack(root: string, id: string, entries: ZipEntry[]): Promise<void> {
  const tmp = path.join(root, ".uploads", randomUUID());
  await mkdir(tmp, { recursive: true });
  try {
    for (const entry of entries) {
      const safe = safeEntryName(entry.name);
      if (safe === null || safe.endsWith("/")) continue;
      const dest = path.join(tmp, safe);
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, entry.data);
    }
    const dest = path.join(root, "content", "packs", id);
    await rm(dest, { recursive: true, force: true });
    await mkdir(path.dirname(dest), { recursive: true });
    await rename(tmp, dest);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function handleUpload(req: IncomingMessage, res: ServerResponse, id: string, config: ServeConfig): Promise<void> {
  const auth = authorize(bearerToken(req.headers.authorization), config);
  if (auth === null) {
    json(res, 401, { error: "unauthorized — send a valid Bearer key" });
    return;
  }
  if (!SLUG.test(id)) {
    json(res, 400, { error: `invalid pack id '${id}'` });
    return;
  }

  let entries: ZipEntry[];
  try {
    entries = readZip(await readBody(req));
  } catch (e) {
    json(res, 400, { error: `could not read zip: ${(e as Error).message}` });
    return;
  }

  // zip-slip: reject any entry that would escape the pack folder.
  for (const entry of entries) {
    if (safeEntryName(entry.name) === null) {
      json(res, 400, { error: `unsafe path in archive: '${entry.name}'` });
      return;
    }
  }

  const manifestEntry = entries.find((e) => safeEntryName(e.name) === "manifest.json");
  if (!manifestEntry) {
    json(res, 400, { error: "archive has no manifest.json at its root" });
    return;
  }
  let manifest: { id?: unknown; type?: unknown };
  try {
    manifest = JSON.parse(manifestEntry.data.toString("utf8"));
  } catch (e) {
    json(res, 400, { error: `manifest.json is not valid JSON: ${(e as Error).message}` });
    return;
  }
  const validation = validatePack(manifest);
  if (!validation.valid) {
    json(res, 400, { error: "invalid pack manifest", details: validation.errors.map((i) => i.message) });
    return;
  }
  if (manifest.id !== id) {
    json(res, 400, { error: `manifest id '${String(manifest.id)}' does not match URL id '${id}'` });
    return;
  }

  const scope = canWrite(auth, id, String(manifest.type));
  if (!scope.ok) {
    json(res, 403, { error: scope.reason });
    return;
  }

  await installPack(config.root, id, entries);
  const built = await rebuild(config.root);
  json(res, built.ok ? 200 : 422, { ok: true, id, rebuilt: built.ok, errors: built.errors });
}

async function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string, root: string): Promise<void> {
  const distRoot = path.resolve(root, "dist");
  let rel = pathname.replace(/^\/+/, "");
  if (rel === "" || rel.endsWith("/")) rel += "index.html";

  const target = path.resolve(distRoot, rel);
  if (target !== distRoot && !target.startsWith(distRoot + path.sep)) {
    json(res, 403, { error: "forbidden" });
    return;
  }

  let filePath = target;
  try {
    if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, "index.html");
  } catch {
    /* fall through to 404 */
  }

  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    json(res, 404, { error: "not found" });
    return;
  }

  res.setHeader("Content-Type", contentType(filePath));
  res.setHeader("Accept-Ranges", "bytes");

  const range = req.headers.range;
  const match = typeof range === "string" ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (match) {
    let start = match[1] === "" ? undefined : Number(match[1]);
    let end = match[2] === "" ? undefined : Number(match[2]);
    if (start === undefined) {
      start = size - (end ?? 0);
      end = size - 1;
    } else if (end === undefined) {
      end = size - 1;
    }
    if (start < 0 || end >= size || start > end) {
      res.statusCode = 416;
      res.setHeader("Content-Range", `bytes */${size}`);
      res.end();
      return;
    }
    res.statusCode = 206;
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    res.setHeader("Content-Length", String(end - start + 1));
    if (req.method === "HEAD") return void res.end();
    createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.setHeader("Content-Length", String(size));
  if (req.method === "HEAD") return void res.end();
  createReadStream(filePath).pipe(res);
}

/** Create the Tier-2 daemon HTTP server (not yet listening). */
export function createServeServer(config: ServeConfig): Server {
  return createServer((req, res) => {
    void handle(req, res).catch(() => {
      if (!res.headersSent) json(res, 500, { error: "internal error" });
      else res.end();
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "PUT" && url.pathname.startsWith(API_PREFIX)) {
      const id = decodeURIComponent(url.pathname.slice(API_PREFIX.length));
      return handleUpload(req, res, id, config);
    }
    if (req.method === "GET" || req.method === "HEAD") {
      return serveStatic(req, res, decodeURIComponent(url.pathname), config.root);
    }
    json(res, 405, { error: "method not allowed" });
  }
}

export interface ServeHandle {
  url: string;
  port: number;
  close(): Promise<void>;
}

/** Build once, start the daemon, and watch content/theme/static → rebuild. */
export async function startServe(config: ServeConfig): Promise<ServeHandle> {
  const server = createServeServer(config);
  const host = config.host ?? "127.0.0.1";
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port ?? 4321, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : (config.port ?? 4321);

  await rebuild(config.root);

  const watchPaths = ["content", "theme", "static", "node.manifest.jsonc", "node.manifest.json"].map((p) =>
    path.join(config.root, p),
  );
  let timer: NodeJS.Timeout | undefined;
  const watcher = watch(watchPaths, { ignoreInitial: true });
  watcher.on("all", () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void rebuild(config.root), 150);
  });

  return {
    url: `http://${host}:${port}`,
    port,
    async close() {
      if (timer) clearTimeout(timer);
      await watcher.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
