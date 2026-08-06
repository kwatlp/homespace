/** What a lookup found at a path. `null` means nothing is there. */
export type PathKind = "file" | "dir" | "other" | null;

export interface DirEntry {
  /** Entry name only, not a path. */
  name: string;
  kind: "file" | "dir" | "other";
}

/**
 * Read-only file access. The scanner reads a homespace through this seam, so
 * the same code runs against a real filesystem (the CLI) or an in-memory tree
 * (the Builder — TDD §6.6, §15.2).
 *
 * Declared per package on purpose: scanner and renderer never import each
 * other (§5), and structural typing lets one implementation satisfy both.
 */
export interface FileAccess {
  /** What is at `path`, following symlinks. */
  kind(path: string): Promise<PathKind>;
  /** Entries directly inside a directory; empty when it is not readable. */
  list(path: string): Promise<DirEntry[]>;
  /** Raw bytes of a file; rejects when it cannot be read. */
  read(path: string): Promise<Uint8Array>;
  /** UTF-8 text of a file; rejects when it cannot be read. */
  readText(path: string): Promise<string>;
}
