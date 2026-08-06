import { createHash } from "node:crypto";
import path from "node:path";

import {
  type Catalog,
  type CatalogPack,
  type PackManifest,
  validatePack,
} from "homespace-schema";

import type { FileAccess } from "./files.js";
import { nodeFiles } from "./node-files.js";
import { confineToBase, toPosix } from "./paths.js";

export type IssueSeverity = "error" | "warning";

/** A single problem found while scanning; message reads path → problem → fix. */
export interface ScanIssue {
  severity: IssueSeverity;
  /** Pack folder name (or id), when the issue belongs to a specific pack. */
  pack?: string;
  /** Location within the pack — a field path, file path, or JSON pointer. */
  location: string;
  message: string;
}

export interface ScanResult {
  catalog: Catalog;
  errors: ScanIssue[];
  warnings: ScanIssue[];
  /** True when no errors were found (warnings are non-fatal). */
  ok: boolean;
}

export interface ScanOptions {
  /** Homespace root directory (the folder containing `content/`). */
  root: string;
  /** Verify that every checksummed file matches its recorded sha256. */
  verify?: boolean;
  /**
   * Build stamp written to `catalog.generated`. Omitted by default so builds
   * are deterministic (TDD §5.2); pass a value only for `--stamp`.
   */
  stamp?: string;
  /**
   * Where to read the homespace from. Defaults to `node:fs`; the Builder passes
   * an in-memory tree so the identical scan runs in a browser (TDD §6.6).
   */
  files?: FileAccess;
}

const CONTENT_PACKS = ["content", "packs"];

interface RefPath {
  location: string;
  value: string;
  /** Whether the referenced file must exist on disk. */
  mustExist: boolean;
}

function referencedPaths(m: PackManifest): RefPath[] {
  const out: RefPath[] = [];
  const ep = m.entrypoint;
  if (ep) {
    if (typeof ep.web === "string") out.push({ location: "entrypoint.web", value: ep.web, mustExist: true });
    if (typeof ep.download === "string") out.push({ location: "entrypoint.download", value: ep.download, mustExist: true });
    if (typeof ep.post === "string") out.push({ location: "entrypoint.post", value: ep.post, mustExist: true });
    // entrypoint.link is an outbound URL, not a pack-relative path.
  }
  const media = m.media;
  if (media) {
    if (typeof media.cover === "string") out.push({ location: "media.cover", value: media.cover, mustExist: true });
    if (Array.isArray(media.gallery)) {
      media.gallery.forEach((g, i) => {
        if (typeof g === "string") out.push({ location: `media.gallery[${i}]`, value: g, mustExist: true });
      });
    }
    if (media.alt && typeof media.alt === "object") {
      for (const key of Object.keys(media.alt)) {
        out.push({ location: `media.alt['${key}']`, value: key, mustExist: false });
      }
    }
  }
  if (m.checksums && typeof m.checksums === "object") {
    for (const key of Object.keys(m.checksums)) {
      out.push({ location: `checksums['${key}']`, value: key, mustExist: true });
    }
  }
  return out;
}

async function sha256(files: FileAccess, file: string): Promise<string> {
  return `sha256:${createHash("sha256").update(await files.read(file)).digest("hex")}`;
}

/** Build a catalog pack: the validated manifest plus derived slug + dir. */
function toCatalogPack(m: PackManifest, dir: string): CatalogPack {
  return { ...m, slug: m.id, dir } as CatalogPack;
}

/** Sort packs deterministically by id (codepoint order, locale-independent). */
function byId(a: CatalogPack, b: CatalogPack): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Walk a homespace's `content/packs/`, validate every pack manifest, confine and
 * check referenced files, and emit a deterministic catalog. Pure with respect
 * to rendering — it produces data, never HTML (TDD §2, §5).
 */
export async function scan(options: ScanOptions): Promise<ScanResult> {
  const files = options.files ?? nodeFiles;
  const errors: ScanIssue[] = [];
  const warnings: ScanIssue[] = [];
  const packs: CatalogPack[] = [];
  const exists = async (p: string): Promise<boolean> => (await files.kind(p)) !== null;

  const packsDir = path.join(options.root, ...CONTENT_PACKS);
  if ((await files.kind(packsDir)) !== "dir") {
    errors.push({
      severity: "error",
      location: toPosix(path.join(...CONTENT_PACKS)),
      message: `no content/packs directory under '${options.root}' — a homespace needs content/packs/<id>/manifest.json`,
    });
    return { catalog: emptyCatalog(options.stamp), errors, warnings, ok: false };
  }

  const entries = (await files.list(packsDir))
    .filter((e) => e.kind === "dir")
    .map((e) => e.name)
    .sort();

  for (const folder of entries) {
    const packDir = path.join(packsDir, folder);
    const relDir = toPosix(path.relative(options.root, packDir));
    const manifestPath = path.join(packDir, "manifest.json");
    const packErrors: ScanIssue[] = [];
    const packWarnings: ScanIssue[] = [];

    const err = (location: string, message: string): void => {
      packErrors.push({ severity: "error", pack: folder, location, message });
    };
    const warn = (location: string, message: string): void => {
      packWarnings.push({ severity: "warning", pack: folder, location, message });
    };

    if (!(await exists(manifestPath))) {
      warn("manifest.json", `'${relDir}' has no manifest.json — skipped`);
      warnings.push(...packWarnings);
      continue;
    }

    let data: unknown;
    try {
      data = JSON.parse(await files.readText(manifestPath));
    } catch (e) {
      err("manifest.json", `manifest.json is not valid JSON: ${(e as Error).message}`);
      errors.push(...packErrors);
      continue;
    }

    const result = validatePack(data);
    for (const issue of result.warnings) {
      warn(issue.path || "(root)", issue.message);
    }
    if (!result.valid) {
      for (const issue of result.errors) {
        err(issue.path || "(root)", issue.message);
      }
      errors.push(...packErrors);
      warnings.push(...packWarnings);
      continue;
    }

    const m = data as PackManifest;
    if (folder !== m.id) {
      warn("id", `folder '${folder}' does not match manifest id '${m.id}' — the pack folder should be named after its id`);
    }

    // Confine + existence-check every pack-relative path.
    for (const ref of referencedPaths(m)) {
      const confined = confineToBase(packDir, ref.value);
      if (!confined.ok) {
        err(ref.location, `${ref.location} '${ref.value}' ${confined.reason}`);
        continue;
      }
      if (ref.mustExist && !(await exists(confined.abs))) {
        err(ref.location, `${ref.location} '${ref.value}' does not exist in the pack folder`);
      }
    }

    // Every download entry needs a matching checksum key (TDD §3).
    const download = m.entrypoint?.download;
    if (typeof download === "string" && !(m.checksums && download in m.checksums)) {
      err("checksums", `entrypoint.download '${download}' has no checksum — add checksums['${download}'] = "sha256:…"`);
    }

    // --verify: hash each checksummed file and compare.
    if (options.verify && m.checksums) {
      for (const [rel, expected] of Object.entries(m.checksums)) {
        const confined = confineToBase(packDir, rel);
        if (!confined.ok || !(await exists(confined.abs))) {
          continue; // already reported by the confinement / existence pass
        }
        const actual = await sha256(files, confined.abs);
        if (actual !== expected) {
          err(`checksums['${rel}']`, `checksum mismatch for '${rel}': expected ${expected}, got ${actual}`);
        }
      }
    }

    if (packErrors.length === 0) {
      packs.push(toCatalogPack(m, relDir));
    }
    errors.push(...packErrors);
    warnings.push(...packWarnings);
  }

  packs.sort(byId);

  const catalog: Catalog = emptyCatalog(options.stamp);
  catalog.packs = packs;

  return { catalog, errors, warnings, ok: errors.length === 0 };
}

function emptyCatalog(stamp: string | undefined): Catalog {
  const catalog: Catalog = { version: 1, packs: [] };
  if (stamp !== undefined) {
    catalog.generated = stamp;
  }
  return catalog;
}

/** Recursively sort object keys so serialized output is order-independent. */
function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableSort);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = stableSort((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Serialize a catalog to deterministic JSON (sorted keys, trailing newline). */
export function serializeCatalog(catalog: Catalog): string {
  return `${JSON.stringify(stableSort(catalog), null, 2)}\n`;
}
