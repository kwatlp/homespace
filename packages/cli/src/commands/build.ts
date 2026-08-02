import path from "node:path";
import { parseArgs } from "node:util";

import {
  findBudgetViolations,
  loadSharpThumbnailer,
  render,
  writeDist,
  type RenderInput,
  type WriteOptions,
} from "homespace-renderer";
import { scan, type ScanOptions } from "homespace-scanner";

import type { Context } from "../io.js";
import { loadHomespace } from "../load.js";
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

  const loaded = await loadHomespace(ctx.cwd);
  warn(ctx.io, loaded.warnings);
  if (!loaded.homespace) {
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

  const thumbnailer = await loadSharpThumbnailer();
  const renderInput: RenderInput = {
    catalog: scanResult.catalog,
    homespace: loaded.homespace,
    root: ctx.cwd,
    thumbnails: thumbnailer !== null,
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
  const writeOpts: WriteOptions = thumbnailer ? { thumbnailer } : {};
  await writeDist(renderResult, outDir, writeOpts);
  ctx.io.out(`Built ${scanResult.catalog.packs.length} pack(s) → ${path.relative(ctx.cwd, outDir) || "."}\n`);
  return 0;
}
