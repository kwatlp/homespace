import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RenderResult } from "./render.js";

/** Write a render result to `outDir`: generated files first, then asset copies. */
export async function writeDist(result: RenderResult, outDir: string): Promise<void> {
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
}
