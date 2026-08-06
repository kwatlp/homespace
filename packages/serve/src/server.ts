import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { contentType } from "homespace-cli";
import { validatePack } from "homespace-schema";
import { watch } from "chokidar";

import type { ServeConfig } from "./config.js";
import { authorize, bearerToken, canWrite, type Auth } from "./keys.js";
import { rebuild } from "./rebuild.js";
import { openZip, type ZipArchive } from "./zip.js";

const API_PREFIX = "/api/packs/";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Default cap on an upload body — sized for a full game build (TDD §9.2). */
const DEFAULT_MAX_UPLOAD_BYTES = 1024 ** 3;
/** A pack manifest is a small JSON file; read it under its own cap. */
const MANIFEST_MAX_BYTES = 1024 * 1024;

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

/**
 * Stream the request body to a file under `dir`, never into memory (TDD §9.2).
 * Resolves to the file path, or null when the body exceeds `maxBytes`. An
 * over-cap body stops the read with backpressure rather than destroying the
 * socket, so the 413 still reaches the client; the caller closes afterwards.
 */
async function spoolBody(req: IncomingMessage, dir: string, maxBytes: number): Promise<string | null> {
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${randomUUID()}.zip`);
  const out = createWriteStream(file);
  let over = false;
  let bytes = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      req.on("data", (chunk: Buffer) => {
        if (over) return;
        bytes += chunk.length;
        if (bytes > maxBytes) {
          over = true;
          req.pause();
          out.end();
          return;
        }
        if (!out.write(chunk)) {
          req.pause();
          out.once("drain", () => req.resume());
        }
      });
      req.on("end", () => out.end());
      req.on("error", reject);
      out.on("error", reject);
      out.on("finish", resolve);
    });
  } catch (e) {
    out.destroy();
    await rm(file, { force: true });
    throw e;
  }

  if (over) {
    await rm(file, { force: true });
    return null;
  }
  return file;
}

/**
 * Move a staged pack into `content/packs/<id>`. The prior copy is renamed aside
 * (outside `content/`, so a concurrent scan never sees two packs claiming the
 * same id) and restored if the move fails — there is no window in which a
 * successful publish leaves the pack missing (TDD §9.2).
 */
export async function installPack(root: string, id: string, stage: string): Promise<void> {
  const dest = path.join(root, "content", "packs", id);
  await mkdir(path.dirname(dest), { recursive: true });
  const uploads = path.join(root, ".uploads");
  await mkdir(uploads, { recursive: true });
  const aside = path.join(uploads, `replaced-${randomUUID()}`);

  let displaced = false;
  try {
    await rename(dest, aside);
    displaced = true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }

  try {
    await rename(stage, dest);
  } catch (e) {
    if (displaced) await rename(aside, dest);
    throw e;
  }
  if (displaced) await rm(aside, { recursive: true, force: true });
}

interface UploadFailure {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Validate an uploaded archive and unpack it into `stage`. Returns null when the
 * pack is staged and ready to install, or the failure to report.
 */
async function stageUpload(
  bodyPath: string,
  stage: string,
  id: string,
  auth: Auth,
  config: ServeConfig,
): Promise<UploadFailure | null> {
  let archive: ZipArchive;
  try {
    archive = await openZip(bodyPath, config.zipLimits ?? {});
  } catch (e) {
    return { status: 400, body: { error: `could not read zip: ${(e as Error).message}` } };
  }

  try {
    // zip-slip: reject any entry that would escape the pack folder.
    for (const member of archive.members) {
      if (safeEntryName(member.name) === null) {
        return { status: 400, body: { error: `unsafe path in archive: '${member.name}'` } };
      }
    }

    const manifestMember = archive.members.find((m) => safeEntryName(m.name) === "manifest.json");
    if (!manifestMember) {
      return { status: 400, body: { error: "archive has no manifest.json at its root" } };
    }

    let raw: Buffer;
    try {
      raw = await archive.read(manifestMember, MANIFEST_MAX_BYTES);
    } catch (e) {
      return { status: 400, body: { error: `could not read manifest.json: ${(e as Error).message}` } };
    }

    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
    } catch (e) {
      return { status: 400, body: { error: `manifest.json is not valid JSON: ${(e as Error).message}` } };
    }

    const validation = validatePack(manifest);
    if (!validation.valid) {
      return {
        status: 400,
        body: { error: "invalid pack manifest", details: validation.errors.map((i) => i.message) },
      };
    }
    if (manifest["id"] !== id) {
      return {
        status: 400,
        body: { error: `manifest id '${String(manifest["id"])}' does not match URL id '${id}'` },
      };
    }

    const scope = canWrite(auth, id, String(manifest["type"]));
    if (!scope.ok) return { status: 403, body: { error: scope.reason } };

    try {
      for (const member of archive.members) {
        const safe = safeEntryName(member.name);
        if (safe === null || member.directory) continue;
        await archive.extract(member, path.join(stage, safe));
      }
    } catch (e) {
      return { status: 400, body: { error: `could not unpack archive: ${(e as Error).message}` } };
    }

    // A scoped key buys publishing, never the origin: packs a linked system
    // installs run with an opaque origin, and the uploader cannot opt out
    // (TDD §6.4, §9.3).
    if (!auth.operator) {
      const forced = { ...manifest, sandbox: "strict" };
      await writeFile(path.join(stage, "manifest.json"), `${JSON.stringify(forced, null, 2)}\n`, "utf8");
    }
    return null;
  } finally {
    await archive.close();
  }
}

async function handleUpload(req: IncomingMessage, res: ServerResponse, id: string, config: ServeConfig): Promise<void> {
  /** Answer without reading the body; the unread request closes the socket. */
  const abort = (status: number, body: Record<string, unknown>): void => {
    res.once("finish", () => req.destroy());
    res.setHeader("Connection", "close");
    json(res, status, body);
  };

  const auth = authorize(bearerToken(req.headers.authorization), config);
  if (auth === null) return abort(401, { error: "unauthorized — send a valid Bearer key" });
  if (!SLUG.test(id)) {
    return abort(400, { error: `invalid pack id '${id}' — use lowercase words joined by hyphens` });
  }

  const maxUpload = config.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  const tooLarge = {
    error: `upload is larger than the ${maxUpload}-byte limit — raise maxUploadBytes in homespace.serve.json or split the pack`,
  };
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > maxUpload) return abort(413, tooLarge);

  const uploads = path.join(config.root, ".uploads");
  const bodyPath = await spoolBody(req, uploads, maxUpload);
  if (bodyPath === null) return abort(413, tooLarge);

  const stage = path.join(uploads, randomUUID());
  try {
    const failure = await stageUpload(bodyPath, stage, id, auth, config);
    if (failure) {
      json(res, failure.status, failure.body);
      return;
    }
    await installPack(config.root, id, stage);
  } finally {
    await rm(bodyPath, { force: true });
    await rm(stage, { recursive: true, force: true });
  }

  const built = await rebuild(config.root);
  json(res, built.ok ? 200 : 422, {
    ok: built.ok,
    id,
    installed: true,
    rebuilt: built.ok,
    errors: built.errors,
  });
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

    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      json(res, 400, { error: "malformed percent-encoding in the request path" });
      return;
    }

    if (req.method === "PUT" && pathname.startsWith(API_PREFIX)) {
      return handleUpload(req, res, pathname.slice(API_PREFIX.length), config);
    }
    if (req.method === "GET" || req.method === "HEAD") {
      return serveStatic(req, res, pathname, config.root);
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

  const watchPaths = [
    "content",
    "theme",
    "static",
    "homespace.manifest.jsonc",
    "homespace.manifest.json",
    "node.manifest.jsonc",
    "node.manifest.json",
  ].map((p) => path.join(config.root, p));
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
