import { findBudgetViolations, render, type RenderInput } from "homespace-renderer";
import { scan, type ScanOptions } from "homespace-scanner";
import type { HomespaceManifest } from "homespace-schema";

import { MEMORY_ROOT, memoryFiles, type MemoryTree } from "./memory-files.js";

/** Downscale an image; the browser can supply a canvas-backed one. */
export type Thumbnailer = (input: Uint8Array, width: number) => Promise<Uint8Array>;

export interface BrowserBuildInput {
  /** Composition + theme (Contract #2) — the wizard's state, already an object. */
  homespace: HomespaceManifest;
  /** The homespace's source files, keyed by path relative to its root. */
  tree: MemoryTree;
  /** Absolute base URL for feed/sitemap; relative when omitted. */
  site?: string;
  /** When present, `.thumbs/` images are generated with it. */
  thumbnailer?: Thumbnailer;
}

/** One file the built site consists of. */
export interface BuiltFile {
  /** Dist-relative POSIX path. */
  path: string;
  bytes: Uint8Array;
}

export interface BrowserBuildResult {
  ok: boolean;
  /** Everything `dist/` should contain, sorted by path. Empty when not ok. */
  files: BuiltFile[];
  errors: string[];
  warnings: string[];
}

const encoder = new TextEncoder();

/**
 * Build a homespace entirely in memory: the same scanner and renderer the CLI
 * runs, reading an in-memory tree instead of a filesystem and returning the
 * bytes instead of writing them (TDD §15.2).
 *
 * Deterministic and byte-identical to `homespace build` on the same source —
 * that equivalence is a golden test, not an aspiration.
 */
export async function buildInMemory(input: BrowserBuildInput): Promise<BrowserBuildResult> {
  const source = memoryFiles(input.tree);
  const warnings: string[] = [];

  const scanOptions: ScanOptions = { root: MEMORY_ROOT, verify: false, files: source };
  const scanned = await scan(scanOptions);
  warnings.push(...scanned.warnings.map((w) => w.message));
  if (!scanned.ok) {
    return { ok: false, files: [], errors: scanned.errors.map((e) => e.message), warnings };
  }

  const renderInput: RenderInput = {
    catalog: scanned.catalog,
    homespace: input.homespace,
    root: MEMORY_ROOT,
    files: source,
    thumbnails: input.thumbnailer !== undefined,
    ...(input.site !== undefined ? { site: input.site } : {}),
  };
  const result = await render(renderInput);
  warnings.push(...result.warnings.map((w) => w.message));
  if (result.errors.length > 0) {
    return { ok: false, files: [], errors: result.errors.map((e) => e.message), warnings };
  }

  const violations = findBudgetViolations(result.files);
  if (violations.length > 0) {
    return {
      ok: false,
      files: [],
      errors: violations.map((v) => `offline-budget: ${v.file} loads external resource ${v.url}`),
      warnings,
    };
  }

  // Same order as writeDist — generated, copied, thumbnailed — so a path
  // claimed twice resolves the same way it would on disk.
  const built = new Map<string, Uint8Array>();
  for (const file of result.files) built.set(file.path, encoder.encode(file.contents));
  for (const asset of result.assets) built.set(asset.to, await source.read(asset.from));
  for (const thumb of result.thumbnails) {
    const original = await source.read(thumb.from);
    built.set(thumb.to, input.thumbnailer ? await input.thumbnailer(original, thumb.width) : original);
  }

  const files = [...built.entries()]
    .map(([path, bytes]) => ({ path, bytes }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return { ok: true, files, errors: [], warnings };
}
