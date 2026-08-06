import type { DirEntry, FileAccess, PathKind } from "homespace-renderer";

/**
 * A homespace held in memory: file contents keyed by POSIX path relative to the
 * homespace root (`"content/packs/hello/manifest.json"`). Directories are
 * implied by the keys — there is nothing to create.
 */
export type MemoryTree = Record<string, Uint8Array | string>;

/** The root the in-memory homespace pretends to live at. */
export const MEMORY_ROOT = "/homespace";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Normalize a path to POSIX with no leading, trailing, or doubled slashes. A
 * leading drive letter is dropped: `node:path.resolve` prepends one on Windows,
 * and an in-memory homespace has no drives. (The browser bundle's POSIX path
 * shim never produces one — this keeps the same tree usable under Node too.)
 */
function key(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/^[a-zA-Z]:/, "")
    .split("/")
    .filter((part) => part !== "" && part !== ".")
    .join("/");
}

/**
 * Read-only file access over an in-memory tree. Satisfies the scanner's and the
 * renderer's file-access interfaces at once (TDD §6.6) — they are structurally
 * identical on purpose.
 */
export function memoryFiles(tree: MemoryTree, root: string = MEMORY_ROOT): FileAccess {
  const rootKey = key(root);
  const files = new Map<string, Uint8Array>();
  const directories = new Set<string>([rootKey]);

  for (const [path, contents] of Object.entries(tree)) {
    const rel = key(path);
    if (rel === "") continue;
    const full = rootKey === "" ? rel : `${rootKey}/${rel}`;
    files.set(full, typeof contents === "string" ? encoder.encode(contents) : contents);

    const parts = full.split("/");
    for (let i = 1; i < parts.length; i++) directories.add(parts.slice(0, i).join("/"));
  }

  const missing = (path: string): Error => new Error(`no such file in this homespace: '${path}'`);

  return {
    async kind(path: string): Promise<PathKind> {
      const k = key(path);
      if (files.has(k)) return "file";
      if (directories.has(k)) return "dir";
      return null;
    },

    async list(path: string): Promise<DirEntry[]> {
      const prefix = key(path);
      if (!directories.has(prefix)) return [];
      const head = prefix === "" ? "" : `${prefix}/`;
      const seen = new Map<string, DirEntry>();
      for (const full of files.keys()) {
        if (!full.startsWith(head)) continue;
        const rest = full.slice(head.length);
        const slash = rest.indexOf("/");
        const name = slash === -1 ? rest : rest.slice(0, slash);
        if (name === "") continue;
        if (!seen.has(name)) seen.set(name, { name, kind: slash === -1 ? "file" : "dir" });
      }
      return [...seen.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    },

    async read(path: string): Promise<Uint8Array> {
      const bytes = files.get(key(path));
      if (bytes === undefined) throw missing(path);
      return bytes;
    },

    async readText(path: string): Promise<string> {
      const bytes = files.get(key(path));
      if (bytes === undefined) throw missing(path);
      return decoder.decode(bytes);
    },
  };
}
