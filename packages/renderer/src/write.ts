import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RenderResult } from "./render.js";
import type { Thumbnailer } from "./thumbnails.js";

export interface WriteOptions {
  /** When provided, thumbnail ops are downscaled; otherwise the full image is
   *  copied to the thumbnail path so references still resolve. */
  thumbnailer?: Thumbnailer;
}

/** Write a render result to `outDir`: generated files, asset copies, thumbnails. */
export async function writeDist(result: RenderResult, outDir: string, options: WriteOptions = {}): Promise<void> {
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
}
