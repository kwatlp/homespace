import { cp, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import type { Context } from "../io.js";

/**
 * Preset sources, in priority order: the CLI's bundled templates (ships with
 * the package — currently `blank`), then the repo-level `archetypes/` dir (the
 * four v0 archetypes) when running inside the monorepo.
 */
const PRESET_ROOTS = [
  fileURLToPath(new URL("../../templates", import.meta.url)),
  fileURLToPath(new URL("../../../../archetypes", import.meta.url)),
];

async function listArchetypes(): Promise<string[]> {
  const names = new Set<string>();
  for (const root of PRESET_ROOTS) {
    try {
      const entries = await readdir(root, { withFileTypes: true });
      for (const e of entries) if (e.isDirectory()) names.add(e.name);
    } catch {
      /* root may not exist (e.g. published package without archetypes) */
    }
  }
  return [...names].sort();
}

async function findPreset(archetype: string): Promise<string | undefined> {
  for (const root of PRESET_ROOTS) {
    const candidate = path.join(root, archetype);
    try {
      if ((await stat(candidate)).isDirectory()) return candidate;
    } catch {
      /* keep looking */
    }
  }
  return undefined;
}

async function isNonEmptyDir(p: string): Promise<boolean> {
  try {
    const entries = await readdir(p);
    return entries.length > 0;
  } catch {
    return false; // does not exist → fine
  }
}

/** Copy an archetype preset into a new directory (TDD §7). */
export async function init(argv: string[], ctx: Context): Promise<number> {
  const { positionals } = parseArgs({ args: argv, allowPositionals: true, options: {} });
  const archetype = positionals[0];
  const dirArg = positionals[1];

  const available = await listArchetypes();
  if (archetype === undefined) {
    ctx.io.err(`usage: homespace init <archetype> [dir]\n`);
    ctx.io.err(`available archetypes: ${available.join(", ") || "(none installed)"}\n`);
    return 1;
  }

  const src = await findPreset(archetype);
  if (src === undefined) {
    ctx.io.err(`error: unknown archetype '${archetype}' — available: ${available.join(", ") || "(none)"}\n`);
    return 1;
  }

  const dest = path.resolve(ctx.cwd, dirArg ?? archetype);
  if (await isNonEmptyDir(dest)) {
    ctx.io.err(`error: directory '${path.relative(ctx.cwd, dest) || "."}' is not empty — choose an empty or new directory\n`);
    return 1;
  }

  await cp(src, dest, { recursive: true });
  const rel = path.relative(ctx.cwd, dest) || ".";
  ctx.io.out(`Created a '${archetype}' homespace in ${rel}\nNext: cd ${rel} && homespace build\n`);
  return 0;
}
