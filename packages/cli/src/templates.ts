import type { PackManifest } from "@kwatlp/schema";

export const PACK_TYPES = ["game", "app", "art", "post", "link", "bundle"] as const;
export type PackType = (typeof PACK_TYPES)[number];

export function isPackType(value: string): value is PackType {
  return (PACK_TYPES as readonly string[]).includes(value);
}

export interface ScaffoldFile {
  /** Path relative to the new pack folder. */
  path: string;
  contents: string;
}

function titleFromId(id: string): string {
  return id
    .split("-")
    .filter((w) => w.length > 0)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Build the files for `kwatlp new pack <type> <id>`: a valid manifest.json plus
 * a stub entry file where the type needs one. Manifests are plain JSON (the
 * scanner parses them as JSON; only the node manifest is JSONC).
 */
export function packScaffold(type: PackType, id: string): ScaffoldFile[] {
  const title = titleFromId(id);
  const base: PackManifest = { id, type, title, summary: "One short sentence." };
  const files: ScaffoldFile[] = [];

  switch (type) {
    case "game":
    case "app":
      base.version = "0.1.0";
      base.entrypoint = { web: "index.html" };
      files.push({
        path: "index.html",
        contents: `<!doctype html>\n<meta charset="utf-8">\n<title>${title}</title>\n<p>Replace this with your ${type}.</p>\n`,
      });
      break;
    case "post":
      base.entrypoint = { post: "index.md" };
      files.push({ path: "index.md", contents: `# ${title}\n\nStart writing.\n` });
      break;
    case "link":
      base.entrypoint = { link: "https://example.com/replace-me" };
      break;
    case "art":
    case "bundle":
      break;
  }

  files.unshift({ path: "manifest.json", contents: `${JSON.stringify(base, null, 2)}\n` });
  return files;
}
