import { cp, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import type { Context } from "../io.js";

/** Bundled archetype/template presets live at the package root under templates/. */
const templatesDir = fileURLToPath(new URL("../../templates", import.meta.url));

async function listArchetypes(): Promise<string[]> {
  try {
    const entries = await readdir(templatesDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return [];
  }
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
    ctx.io.err(`usage: kwatlp init <archetype> [dir]\n`);
    ctx.io.err(`available archetypes: ${available.join(", ") || "(none installed)"}\n`);
    return 1;
  }

  const src = path.join(templatesDir, archetype);
  try {
    if (!(await stat(src)).isDirectory()) throw new Error("not a directory");
  } catch {
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
  ctx.io.out(`Created a '${archetype}' node in ${rel}\nNext: cd ${rel} && kwatlp build\n`);
  return 0;
}
