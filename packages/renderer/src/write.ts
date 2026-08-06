import { copyFile, mkdir, readFile, readdir, rm, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RenderResult } from "./render.js";
import type { Thumbnailer } from "./thumbnails.js";

export interface WriteOptions {
  /** When provided, thumbnail ops are downscaled; otherwise the full image is
   *  copied to the thumbnail path so references still resolve. */
  thumbnailer?: Thumbnailer;
}

export interface WriteReport {
  /** Dist-relative paths removed because this build does not emit them. */
  pruned: string[];
}

/** Every dist-relative path a render result claims (generated, copied, thumbnailed). */
export function emittedPaths(result: RenderResult): string[] {
  return [
    ...result.files.map((f) => f.path),
    ...result.assets.map((a) => a.to),
    ...result.thumbnails.map((t) => t.to),
  ].sort();
}

/** Prune one directory level; resolves true when nothing is left in it. */
async function pruneInto(
  absDir: string,
  rel: string,
  expected: ReadonlySet<string>,
  removed: string[],
): Promise<boolean> {
  let entries;
  try {
    entries = await readdir(absDir, { withFileTypes: true });
  } catch {
    return false; // no output directory yet — nothing to prune
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  let kept = 0;
  for (const entry of entries) {
    const childRel = rel === "" ? entry.name : `${rel}/${entry.name}`;
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      if (await pruneInto(abs, childRel, expected, removed)) await rmdir(abs);
      else kept += 1;
    } else if (expected.has(childRel)) {
      kept += 1;
    } else {
      await rm(abs, { force: true });
      removed.push(childRel);
    }
  }
  return kept === 0;
}

/**
 * Delete everything in `outDir` this render result does not claim, plus any
 * directory left empty. `dist/` is wholly build-owned (TDD §5.2), so removing a
 * pack, section, or theme file leaves no orphan behind. Hand-placed deploy files
 * (`CNAME`, `_headers`, host config) belong in `static/`, which the render copies
 * to the dist root and therefore claims. Returns the removed paths, sorted.
 */
export async function pruneDist(result: RenderResult, outDir: string): Promise<string[]> {
  const expected = new Set(emittedPaths(result));
  const removed: string[] = [];
  await pruneInto(path.resolve(outDir), "", expected, removed);
  return removed.sort();
}

/**
 * Write a render result to `outDir`: generated files, asset copies, thumbnails.
 * Prunes first, so a build never leaves a stale file behind and never races a
 * case-insensitive filesystem for a path it is about to write.
 */
export async function writeDist(
  result: RenderResult,
  outDir: string,
  options: WriteOptions = {},
): Promise<WriteReport> {
  const pruned = await pruneDist(result, outDir);

  for (const file of result.files) {
    const dest = path.join(outDir, file.path);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, file.contents, "utf8");
  }
  for (const asset of result.assets) {
    const dest = path.join(outDir, asset.to);
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(asset.from, dest);
  }
  for (const thumb of result.thumbnails) {
    const dest = path.join(outDir, thumb.to);
    await mkdir(path.dirname(dest), { recursive: true });
    if (options.thumbnailer) {
      const input = await readFile(thumb.from);
      await writeFile(dest, await options.thumbnailer(input, thumb.width));
    } else {
      // Graceful fallback: no thumbnailer, so the reference points at a copy.
      await copyFile(thumb.from, dest);
    }
  }
  return { pruned };
}
