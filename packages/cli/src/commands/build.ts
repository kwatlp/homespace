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

  const given = values.out ?? "dist";
  const outDir = path.resolve(ctx.cwd, given);
  const unsafe = unsafeOutDir(ctx.cwd, outDir, given);
  if (unsafe !== null) {
    fail(ctx.io, [unsafe]);
    return 1;
  }

  const writeOpts: WriteOptions = thumbnailer ? { thumbnailer } : {};
  const report = await writeDist(renderResult, outDir, writeOpts);
  warn(ctx.io, report.pruned.map((p) => `removed ${p} — no longer part of this homespace`));
  ctx.io.out(`Built ${scanResult.catalog.packs.length} pack(s) → ${path.relative(ctx.cwd, outDir) || "."}\n`);
  return 0;
}

/**
 * The build owns its output directory outright and deletes anything else in it
 * (TDD §5.2), so refuse an `--out` that would swallow the homespace itself.
 * Returns the error message, or null when the directory is safe to own.
 */
function unsafeOutDir(root: string, outDir: string, given: string): string | null {
  const rootAbs = path.resolve(root);
  if (outDir === rootAbs || rootAbs.startsWith(outDir + path.sep)) {
    return (
      `--out '${given}' points at your homespace folder. ` +
      `The build owns its output directory and deletes everything it did not generate, ` +
      `which would remove your content. Build into a subfolder instead, e.g. --out dist.`
    );
  }
  return null;
}
