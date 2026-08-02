import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { validateNode, type NodeManifest } from "@kwatlp/schema";

import { parseJsonc } from "./jsonc.js";

export interface LoadedNode {
  found: boolean;
  /** Path to the manifest that was read, if any. */
  manifestPath?: string;
  parseError?: string;
  node?: NodeManifest;
  errors: string[];
  warnings: string[];
}

const MANIFEST_NAMES = ["node.manifest.jsonc", "node.manifest.json"];

async function firstExisting(root: string): Promise<string | undefined> {
  for (const name of MANIFEST_NAMES) {
    const p = path.join(root, name);
    try {
      await stat(p);
      return p;
    } catch {
      /* keep looking */
    }
  }
  return undefined;
}

/** Read + parse + validate a node manifest from `root`. */
export async function loadNode(root: string): Promise<LoadedNode> {
  const manifestPath = await firstExisting(root);
  if (manifestPath === undefined) {
    return {
      found: false,
      errors: [`no node manifest found — expected ${MANIFEST_NAMES.join(" or ")} in ${root}`],
      warnings: [],
    };
  }

  let data: unknown;
  try {
    data = parseJsonc(await readFile(manifestPath, "utf8"));
  } catch (e) {
    return {
      found: true,
      manifestPath,
      parseError: (e as Error).message,
      errors: [`${path.basename(manifestPath)} is not valid JSONC: ${(e as Error).message}`],
      warnings: [],
    };
  }

  const result = validateNode(data);
  return {
    found: true,
    manifestPath,
    ...(result.valid ? { node: data as NodeManifest } : {}),
    errors: result.errors.map((i) => i.message),
    warnings: result.warnings.map((i) => i.message),
  };
}
