import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import type { HomespaceManifest } from "@homespace/schema";
import { watch, type FSWatcher } from "chokidar";

import type { Context, IO } from "../io.js";
import { loadHomespace } from "../load.js";
import { fail } from "../report.js";
import { build } from "./build.js";

export interface DevFlags {
  port?: number;
  host?: string;
  coi?: boolean;
}

export interface DevAddress {
  host: string;
  port: number;
  mdns: boolean;
  /** Interface to bind: loopback unless mDNS makes the homespace LAN-visible (§7.1). */
  bindHost: string;
  localUrl: string;
  customUrl: string;
}

/** Resolve the dev/serve address from the manifest + CLI flags (TDD §7.1). */
export function resolveAddress(homespace: HomespaceManifest, flags: DevFlags): DevAddress {
  const local = homespace.local ?? {};
  const port = flags.port ?? (typeof local.port === "number" ? local.port : 4321);
  const host = flags.host ?? (typeof local.host === "string" && local.host ? local.host : homespace.name);
  const mdns = local.mdns === true;
  return {
    host,
    port,
    mdns,
    bindHost: mdns ? "0.0.0.0" : "127.0.0.1",
    localUrl: `http://localhost:${port}`,
    customUrl: mdns ? `http://${host}.local:${port}` : `http://${host}:${port}`,
  };
}

/** The /etc/hosts line for a machine-only custom name (homespace dev --hosts-hint). */
export function hostsHint(host: string, port: number): string {
  return `127.0.0.1\t${host}\t# homespace — then open http://${host}:${port}\n`;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".map": "application/json",
};

export function contentType(file: string): string {
  return MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

export interface HandlerOptions {
  /** Cross-origin isolation headers for threaded WASM builds (--coi). */
  coi?: boolean;
}

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

/** A traversal-safe static file handler for dist/, with index fallback. */
export function createHandler(distDir: string, options: HandlerOptions = {}): Handler {
  const rootAbs = path.resolve(distDir);
  return (req, res) => {
    void serve(req, res).catch(() => {
      res.statusCode = 500;
      res.end("500 internal error");
    });
  };

  async function serve(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (options.coi === true) {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    }

    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    } catch {
      res.statusCode = 400;
      res.end("400 bad request");
      return;
    }

    let rel = pathname.replace(/^\/+/, "");
    if (rel === "" || rel.endsWith("/")) rel += "index.html";

    const target = path.resolve(rootAbs, rel);
    if (target !== rootAbs && !target.startsWith(rootAbs + path.sep)) {
      res.statusCode = 403;
      res.end("403 forbidden");
      return;
    }

    let filePath = target;
    try {
      if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, "index.html");
    } catch {
      /* handled by the read below */
    }

    try {
      const body = await readFile(filePath);
      res.statusCode = 200;
      res.setHeader("Content-Type", contentType(filePath));
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end("404 not found");
    }
  }
}

export interface MdnsAdvertiser {
  stop(): void | Promise<void>;
}

export type MdnsFactory = (opts: {
  name: string;
  host: string;
  port: number;
}) => MdnsAdvertiser | Promise<MdnsAdvertiser>;

/** Default mDNS advertiser — lazily loads bonjour-service only when needed. */
export const defaultMdns: MdnsFactory = async ({ name, port }) => {
  const { Bonjour } = await import("bonjour-service");
  const instance = new Bonjour();
  const service = instance.publish({ name, type: "http", port });
  return {
    stop() {
      service.stop?.();
      instance.destroy();
    },
  };
};

export interface DevHandle {
  address: DevAddress;
  distDir: string;
  close(): Promise<void>;
}

export interface StartDevOptions {
  root: string;
  address: DevAddress;
  io: IO;
  rebuild: () => Promise<void>;
  mdns?: MdnsFactory;
  homespaceName: string;
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

/** Start the dev server + file watcher (+ optional mDNS). Returns a handle. */
export async function startDev(options: StartDevOptions): Promise<DevHandle> {
  const { root, address, io } = options;
  const distDir = path.join(root, "dist");

  const server = createServer(createHandler(distDir, {}));
  await listen(server, address.port, address.bindHost);

  const watchPaths = [
    "content",
    "theme",
    "static",
    "homespace.manifest.jsonc",
    "homespace.manifest.json",
    "node.manifest.jsonc",
    "node.manifest.json",
  ].map((p) => path.join(root, p));
  let timer: NodeJS.Timeout | undefined;
  const watcher: FSWatcher = watch(watchPaths, { ignoreInitial: true });
  watcher.on("all", () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void options.rebuild().catch((e: unknown) => io.err(`rebuild failed: ${String(e)}\n`));
    }, 100);
  });

  let advertiser: MdnsAdvertiser | undefined;
  if (address.mdns) {
    const factory = options.mdns ?? defaultMdns;
    advertiser = await factory({ name: options.homespaceName, host: address.host, port: address.port });
  }

  return {
    address,
    distDir,
    async close() {
      if (timer) clearTimeout(timer);
      await watcher.close();
      if (advertiser) await advertiser.stop();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/** Build once, then serve dist/ with live rebuild until interrupted. */
export async function dev(argv: string[], ctx: Context, mdns?: MdnsFactory): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      port: { type: "string" },
      host: { type: "string" },
      coi: { type: "boolean", default: false },
      "hosts-hint": { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  const loaded = await loadHomespace(ctx.cwd);
  if (!loaded.homespace) {
    fail(ctx.io, loaded.errors);
    return 1;
  }

  const flags: DevFlags = {
    ...(values.port !== undefined ? { port: Number(values.port) } : {}),
    ...(values.host !== undefined ? { host: values.host } : {}),
    coi: values.coi === true,
  };
  const address = resolveAddress(loaded.homespace, flags);

  if (values["hosts-hint"] === true) {
    ctx.io.out(hostsHint(address.host, address.port));
    return 0;
  }

  const rebuild = async (): Promise<void> => {
    await build(values.coi === true ? [] : [], ctx);
  };
  await rebuild();

  const startOpts: StartDevOptions = {
    root: ctx.cwd,
    address,
    io: ctx.io,
    rebuild,
    homespaceName: loaded.homespace.name,
    ...(mdns ? { mdns } : {}),
  };
  const handle = await startDev(startOpts);

  ctx.io.out(`Serving ${handle.distDir} → ${address.localUrl}\n`);
  if (address.mdns) ctx.io.out(`Advertising on the LAN → ${address.customUrl}\n`);
  ctx.io.out(`Watching for changes. Press Ctrl+C to stop.\n`);

  await new Promise<void>((resolve) => {
    process.once("SIGINT", () => resolve());
  });
  await handle.close();
  return 0;
}
