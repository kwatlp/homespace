import path from "node:path";

export interface ConfineOk {
  ok: true;
  /** Absolute resolved path. */
  abs: string;
  /** Normalized POSIX path relative to the base. */
  rel: string;
}

export interface ConfineErr {
  ok: false;
  /** Designer-facing reason the path was rejected. */
  reason: string;
}

export type ConfineResult = ConfineOk | ConfineErr;

/** Convert an OS path to forward slashes (deterministic, cross-platform). */
export function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/**
 * Resolve `rel` under `base`, rejecting anything that would escape the folder.
 *
 * All pack-relative paths must stay inside the pack directory (TDD §12). This
 * blocks absolute paths, Windows drive/UNC roots, `..` traversal, and null
 * bytes — the scanner's half of the traversal defense.
 */
export function confineToBase(base: string, rel: string): ConfineResult {
  if (typeof rel !== "string" || rel.length === 0) {
    return { ok: false, reason: "path is empty" };
  }
  if (rel.includes("\0")) {
    return { ok: false, reason: "path contains a null byte" };
  }
  if (path.isAbsolute(rel) || /^[a-zA-Z]:[\\/]/.test(rel) || rel.startsWith("\\\\")) {
    return {
      ok: false,
      reason:
        "absolute paths are not allowed — use a path relative to the pack folder",
    };
  }

  const abs = path.resolve(base, rel);
  const back = path.relative(base, abs);
  if (back === ".." || back.startsWith(`..${path.sep}`) || path.isAbsolute(back)) {
    return { ok: false, reason: "path escapes the pack folder" };
  }

  return { ok: true, abs, rel: toPosix(back) };
}
