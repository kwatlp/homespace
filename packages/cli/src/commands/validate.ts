import { parseArgs } from "node:util";

import { scan, type ScanOptions } from "@kwatlp/scanner";

import type { Context } from "../io.js";
import { loadNode } from "../load.js";
import { fail, warn } from "../report.js";

/** Validate the node manifest + all packs. Exit ≠ 0 on any error. */
export async function validate(argv: string[], ctx: Context): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: { verify: { type: "boolean", default: false } },
    allowPositionals: false,
  });

  const loaded = await loadNode(ctx.cwd);
  warn(ctx.io, loaded.warnings);

  const scanOpts: ScanOptions = { root: ctx.cwd, verify: values.verify === true };
  const scanResult = await scan(scanOpts);
  warn(ctx.io, scanResult.warnings.map((w) => w.message));

  const nodeOk = loaded.node !== undefined;
  fail(ctx.io, loaded.node ? [] : loaded.errors);
  fail(ctx.io, scanResult.errors.map((e) => e.message));

  if (!nodeOk || !scanResult.ok) return 1;

  ctx.io.out(`Valid — node manifest and ${scanResult.catalog.packs.length} pack(s) OK.\n`);
  return 0;
}
