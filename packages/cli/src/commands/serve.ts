import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import type { Context } from "../io.js";

interface ServeModule {
  startServe(config: Record<string, unknown>): Promise<{ url: string; close(): Promise<void> }>;
}

async function loadServeConfig(root: string, port: number | undefined, host: string | undefined): Promise<Record<string, unknown>> {
  let base: Record<string, unknown> = {};
  try {
    base = JSON.parse(await readFile(path.join(root, "kwatlp.serve.json"), "utf8")) as Record<string, unknown>;
  } catch {
    /* optional */
  }
  const operatorKey = process.env["KWATLP_OPERATOR_KEY"] ?? base["operatorKey"];
  return {
    ...base,
    root,
    ...(operatorKey !== undefined ? { operatorKey } : {}),
    ...(port !== undefined ? { port } : {}),
    ...(host !== undefined ? { host } : {}),
  };
}

/** Tier-2 daemon (TDD §9). Only works if the optional @kwatlp/serve is installed. */
export async function serve(argv: string[], ctx: Context): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: { port: { type: "string" }, host: { type: "string" } },
    allowPositionals: false,
  });

  let mod: ServeModule;
  try {
    const moduleName: string = "@kwatlp/serve";
    mod = (await import(moduleName)) as ServeModule;
  } catch {
    ctx.io.err("kwatlp serve requires the optional @kwatlp/serve package — install it with `npm i @kwatlp/serve`\n");
    return 1;
  }

  const config = await loadServeConfig(
    ctx.cwd,
    values.port !== undefined ? Number(values.port) : undefined,
    values.host,
  );
  if (config["operatorKey"] === undefined) {
    ctx.io.err("warning: no operator key set — the write API is disabled. Set KWATLP_OPERATOR_KEY or kwatlp.serve.json.\n");
  }

  const handle = await mod.startServe(config);
  ctx.io.out(`Serving ${ctx.cwd} → ${handle.url}\nWatching for changes. Press Ctrl+C to stop.\n`);
  await new Promise<void>((resolve) => process.once("SIGINT", () => resolve()));
  await handle.close();
  return 0;
}
