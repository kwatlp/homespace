import path from "node:path";

import { loadNode } from "@kwatlp/cli";
import {
  findBudgetViolations,
  loadSharpThumbnailer,
  render,
  writeDist,
  type WriteOptions,
} from "@kwatlp/renderer";
import { scan } from "@kwatlp/scanner";

export interface RebuildResult {
  ok: boolean;
  errors: string[];
}

/** Rebuild the node: load manifest → scan → render → dist/ (offline-gated). */
export async function rebuild(root: string): Promise<RebuildResult> {
  const loaded = await loadNode(root);
  if (!loaded.node) return { ok: false, errors: loaded.errors };

  const scanResult = await scan({ root, verify: false });
  if (!scanResult.ok) return { ok: false, errors: scanResult.errors.map((e) => e.message) };

  const thumbnailer = await loadSharpThumbnailer();
  const result = await render({
    catalog: scanResult.catalog,
    node: loaded.node,
    root,
    thumbnails: thumbnailer !== null,
  });
  if (result.errors.length > 0) return { ok: false, errors: result.errors.map((e) => e.message) };

  const violations = findBudgetViolations(result.files);
  if (violations.length > 0) {
    return { ok: false, errors: violations.map((v) => `offline-budget: ${v.file} → ${v.url}`) };
  }

  const writeOpts: WriteOptions = thumbnailer ? { thumbnailer } : {};
  await writeDist(result, path.join(root, "dist"), writeOpts);
  return { ok: true, errors: [] };
}
