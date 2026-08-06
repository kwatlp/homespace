import { readdir, readFile, stat } from "node:fs/promises";

import type { DirEntry, FileAccess, PathKind } from "./files.js";

/** The default file access: a real filesystem via `node:fs`. */
export const nodeFiles: FileAccess = {
  async kind(path: string): Promise<PathKind> {
    try {
      const info = await stat(path);
      return info.isDirectory() ? "dir" : info.isFile() ? "file" : "other";
    } catch {
      return null;
    }
  },

  async list(path: string): Promise<DirEntry[]> {
    try {
      return (await readdir(path, { withFileTypes: true })).map((entry) => ({
        name: entry.name,
        kind: entry.isDirectory() ? "dir" : entry.isFile() ? "file" : "other",
      }));
    } catch {
      return [];
    }
  },

  read: (path: string) => readFile(path),
  readText: (path: string) => readFile(path, "utf8"),
};
