import path from "node:path";

import { loadHomespace } from "homespace-cli";
import {
  findBudgetViolations,
  loadSharpThumbnailer,
  render,
  writeDist,
  type WriteOptions,
} from "homespace-renderer";
import { scan } from "homespace-scanner";

export interface RebuildResult {
  ok: boolean;
  errors: string[];
  /** Dist-relative paths this rebuild pruned as no longer emitted (TDD §5.2). */
  pruned: string[];
}

/** Rebuild the homespace: load manifest → scan → render → dist/ (offline-gated). */
export async function rebuild(root: string): Promise<RebuildResult> {
  const loaded = await loadHomespace(root);
  if (!loaded.homespace) return { ok: false, errors: loaded.errors, pruned: [] };

  const scanResult = await scan({ root, verify: false });
  if (!scanResult.ok) return { ok: false, errors: scanResult.errors.map((e) => e.message), pruned: [] };

  const thumbnailer = await loadSharpThumbnailer();
  const result = await render({
    catalog: scanResult.catalog,
    homespace: loaded.homespace,
    root,
    thumbnails: thumbnailer !== null,
  });
  if (result.errors.length > 0) return { ok: false, errors: result.errors.map((e) => e.message), pruned: [] };

  const violations = findBudgetViolations(result.files);
  if (violations.length > 0) {
    return { ok: false, errors: violations.map((v) => `offline-budget: ${v.file} → ${v.url}`), pruned: [] };
  }

  const writeOpts: WriteOptions = thumbnailer ? { thumbnailer } : {};
  const report = await writeDist(result, path.join(root, "dist"), writeOpts);
  return { ok: true, errors: [], pruned: report.pruned };
}
