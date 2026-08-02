import path from "node:path";
import { parseArgs } from "node:util";

import { findBudgetViolations, render, writeDist, type RenderInput } from "@kwatlp/renderer";
import { scan, type ScanOptions } from "@kwatlp/scanner";

import type { Context } from "../io.js";
import { loadNode } from "../load.js";
import { fail, warn } from "../report.js";

/** validate → scan → render → dist/. Enforces the offline-budget gate (§10.2). */
export async function build(argv: string[], ctx: Context): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      out: { type: "string", default: "dist" },
      verify: { type: "boolean", default: false },
      stamp: { type: "boolean", default: false },
      "base-url": { type: "string" },
    },
    allowPositionals: false,
  });

  const loaded = await loadNode(ctx.cwd);
  warn(ctx.io, loaded.warnings);
  if (!loaded.node) {
    fail(ctx.io, loaded.errors);
    return 1;
  }

  const scanOpts: ScanOptions = {
    root: ctx.cwd,
    verify: values.verify === true,
    ...(values.stamp === true ? { stamp: new Date().toISOString() } : {}),
  };
  const scanResult = await scan(scanOpts);
  warn(ctx.io, scanResult.warnings.map((w) => w.message));
  if (!scanResult.ok) {
    fail(ctx.io, scanResult.errors.map((e) => e.message));
    return 1;
  }

  const renderInput: RenderInput = {
    catalog: scanResult.catalog,
    node: loaded.node,
    root: ctx.cwd,
    ...(typeof values["base-url"] === "string" ? { site: values["base-url"] } : {}),
  };
  const renderResult = await render(renderInput);
  warn(ctx.io, renderResult.warnings.map((w) => w.message));
  if (renderResult.errors.length > 0) {
    fail(ctx.io, renderResult.errors.map((e) => e.message));
    return 1;
  }

  const violations = findBudgetViolations(renderResult.files);
  if (violations.length > 0) {
    fail(ctx.io, violations.map((v) => `offline-budget: ${v.file} loads external resource ${v.url}`));
    return 1;
  }

  const outDir = path.resolve(ctx.cwd, values.out ?? "dist");
  await writeDist(renderResult, outDir);
  ctx.io.out(`Built ${scanResult.catalog.packs.length} pack(s) → ${path.relative(ctx.cwd, outDir) || "."}\n`);
  return 0;
}
