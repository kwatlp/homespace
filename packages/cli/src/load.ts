import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { validateHomespace, type HomespaceManifest } from "@homespace/schema";

import { parseJsonc } from "./jsonc.js";

export interface LoadedHomespace {
  found: boolean;
  /** Path to the manifest that was read, if any. */
  manifestPath?: string;
  parseError?: string;
  homespace?: HomespaceManifest;
  errors: string[];
  warnings: string[];
}

const MANIFEST_NAMES = ["homespace.manifest.jsonc", "homespace.manifest.json"];
// Accepted for one minor version with a deprecation warning (TDD §11 WO-11).
const LEGACY_NAMES = ["node.manifest.jsonc", "node.manifest.json"];

async function firstExisting(root: string): Promise<{ path: string; legacy: boolean } | undefined> {
  for (const name of MANIFEST_NAMES) {
    try {
      await stat(path.join(root, name));
      return { path: path.join(root, name), legacy: false };
    } catch {
      /* keep looking */
    }
  }
  for (const name of LEGACY_NAMES) {
    try {
      await stat(path.join(root, name));
      return { path: path.join(root, name), legacy: true };
    } catch {
      /* keep looking */
    }
  }
  return undefined;
}

/** Read + parse + validate a homespace manifest from `root`. */
export async function loadHomespace(root: string): Promise<LoadedHomespace> {
  const found = await firstExisting(root);
  if (found === undefined) {
    return {
      found: false,
      errors: [`no homespace manifest found — expected ${MANIFEST_NAMES.join(" or ")} in ${root}`],
      warnings: [],
    };
  }
  const manifestPath = found.path;
  const deprecation = found.legacy
    ? [`${path.basename(manifestPath)} is deprecated — rename it to homespace.manifest.jsonc (legacy name accepted for one more minor version)`]
    : [];

  let data: unknown;
  try {
    data = parseJsonc(await readFile(manifestPath, "utf8"));
  } catch (e) {
    return {
      found: true,
      manifestPath,
      parseError: (e as Error).message,
      errors: [`${path.basename(manifestPath)} is not valid JSONC: ${(e as Error).message}`],
      warnings: deprecation,
    };
  }

  const result = validateHomespace(data);
  return {
    found: true,
    manifestPath,
    ...(result.valid ? { homespace: data as HomespaceManifest } : {}),
    errors: result.errors.map((i) => i.message),
    warnings: [...deprecation, ...result.warnings.map((i) => i.message)],
  };
}
