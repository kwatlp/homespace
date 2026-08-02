import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import type { Context } from "../io.js";
import { isPackType, packScaffold, PACK_TYPES } from "../templates.js";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Scaffold content/packs/<id>/ with a manifest (+ stub) for a pack type. */
export async function newCommand(argv: string[], ctx: Context): Promise<number> {
  const { positionals } = parseArgs({ args: argv, allowPositionals: true, options: {} });
  const [subject, type, id] = positionals;

  if (subject !== "pack") {
    ctx.io.err(`usage: kwatlp new pack <type> <id>\n`);
    return 1;
  }
  if (type === undefined || !isPackType(type)) {
    ctx.io.err(`error: unknown pack type '${type ?? ""}' — one of: ${PACK_TYPES.join(" | ")}\n`);
    return 1;
  }
  if (id === undefined || !SLUG.test(id)) {
    ctx.io.err(`error: id must be a slug (lower-case letters, digits, hyphens), got '${id ?? ""}'\n`);
    return 1;
  }

  const packDir = path.join(ctx.cwd, "content", "packs", id);
  try {
    await stat(packDir);
    ctx.io.err(`error: pack '${id}' already exists at content/packs/${id}\n`);
    return 1;
  } catch {
    /* does not exist → good */
  }

  await mkdir(packDir, { recursive: true });
  for (const file of packScaffold(type, id)) {
    const dest = path.join(packDir, file.path);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, file.contents, "utf8");
  }

  ctx.io.out(`Created ${type} pack → content/packs/${id}\nNext: edit it, then kwatlp build\n`);
  return 0;
}
