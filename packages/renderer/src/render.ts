import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import type { Catalog, CatalogPack, NodeManifest, Section } from "@kwatlp/schema";

import { BASE_CSS } from "./assets.js";
import { DETAIL_PREFIX, renderPackDetail, renderPostDetail } from "./detail.js";
import { renderFeed, renderSitemap } from "./feed.js";
import { page } from "./html.js";
import { stableStringify } from "./json.js";
import { renderMarkdown } from "./markdown.js";
import { renderTokensCss } from "./tokens.js";
import { renderSection, SUPPORTED_SECTIONS, type RenderContext } from "./sections.js";

export interface RenderInput {
  catalog: Catalog;
  node: NodeManifest;
  /** Node root directory (source of static/, theme/, and pack files). */
  root: string;
  /** Absolute base URL for feed/sitemap; relative when omitted. */
  site?: string;
}

export interface RenderIssue {
  severity: "error" | "warning";
  message: string;
}

/** A generated text file, path relative to dist root (POSIX). */
export interface OutputFile {
  path: string;
  contents: string;
}

/** A file to copy verbatim into dist (absolute source → dist-relative dest). */
export interface CopyOp {
  from: string;
  to: string;
}

export interface RenderResult {
  files: OutputFile[];
  assets: CopyOp[];
  errors: RenderIssue[];
  warnings: RenderIssue[];
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Recursively list files under `dir`, as POSIX paths relative to `dir`, sorted. */
async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function recurse(rel: string): Promise<void> {
    const entries = await readdir(path.join(dir, rel), { withFileTypes: true });
    for (const entry of entries) {
      const childRel = rel === "" ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) await recurse(childRel);
      else if (entry.isFile()) out.push(childRel);
    }
  }
  await recurse("");
  return out.sort();
}

/** Dist output base for a pack's copied files/detail page. */
function packBase(pack: CatalogPack): string {
  return pack.type === "post" ? `posts/${pack.slug}` : `packs/${pack.slug}`;
}

/**
 * Render a node to a set of static files + an asset copy plan. Pure with
 * respect to the network; deterministic given its inputs (TDD §6). Writes
 * nothing — see writeDist().
 */
export async function render(input: RenderInput): Promise<RenderResult> {
  const { node, catalog, root } = input;
  const site = input.site ?? "";
  const errors: RenderIssue[] = [];
  const warnings: RenderIssue[] = [];
  const files: OutputFile[] = [];
  const assets: CopyOp[] = [];

  // 1. tokens.css (+ font assets) and base.css.
  const tokens = renderTokensCss(node.theme?.tokens);
  for (const message of tokens.errors) errors.push({ severity: "error", message });
  files.push({ path: "tokens.css", contents: tokens.css });
  files.push({ path: "base.css", contents: BASE_CSS });
  for (const font of tokens.fontAssets) {
    const from = path.join(root, font.path);
    if (await exists(from)) assets.push({ from, to: font.path });
    else warnings.push({ severity: "warning", message: `font file '${font.path}' not found in the node` });
  }

  // Optional custom stylesheet, loaded last.
  if (typeof node.theme?.css === "string") {
    const from = path.join(root, node.theme.css);
    if (await exists(from)) assets.push({ from, to: "custom.css" });
    else warnings.push({ severity: "warning", message: `theme.css '${node.theme.css}' not found in the node` });
  }

  // 2. Layout + sections (scroll only this WO).
  if (typeof node.layout === "string" && node.layout !== "scroll") {
    warnings.push({ severity: "warning", message: `layout '${node.layout}' arrives in WO-5 — rendering as scroll` });
  }
  const ctx: RenderContext = { node, catalog, basePrefix: "" };
  const sections = Array.isArray(node.sections) ? node.sections : [];
  const rendered: string[] = [];
  const feedPosts: CatalogPack[] = [];
  const seenFeed = new Set<string>();

  for (const section of sections) {
    if (!SUPPORTED_SECTIONS.has(section.type)) {
      warnings.push({ severity: "warning", message: `section type '${section.type}' is not rendered yet (WO-5)` });
      continue;
    }
    const html = renderSection(section, ctx);
    if (html !== null) rendered.push(html);
    if (section.type === "posts" && section.rss === true) {
      for (const pack of catalog.packs.filter((p) => p.type === "post")) {
        if (!seenFeed.has(pack.id)) {
          seenFeed.add(pack.id);
          feedPosts.push(pack);
        }
      }
    }
  }

  const title = node.title ?? node.name;
  files.push({ path: "index.html", contents: page({ node, title, basePrefix: "", main: rendered.join("\n") }) });

  // 3. Detail pages + pack file copies.
  const detailCtx: RenderContext = { node, catalog, basePrefix: DETAIL_PREFIX };
  const sitemapPaths = ["/"];

  for (const pack of catalog.packs) {
    if (pack.type === "link") continue; // link packs are cards only

    const base = packBase(pack);
    sitemapPaths.push(`/${base}/`);

    // Copy the pack's files (minus manifest.json). Non-post packs go under
    // <base>/files/ to avoid colliding with the generated detail index.html;
    // posts stay flat so relative markdown images resolve.
    const filesBase = pack.type === "post" ? base : `${base}/files`;
    const packDir = path.join(root, pack.dir);
    if (await exists(packDir)) {
      for (const rel of await walk(packDir)) {
        if (rel === "manifest.json") continue;
        assets.push({ from: path.join(packDir, rel), to: `${filesBase}/${rel}` });
      }
    }

    if (pack.type === "post") {
      const src = pack.entrypoint?.post;
      if (typeof src !== "string") {
        errors.push({ severity: "error", message: `post '${pack.id}' has no entrypoint.post` });
        continue;
      }
      const mdPath = path.join(packDir, src);
      if (!(await exists(mdPath))) {
        errors.push({ severity: "error", message: `post '${pack.id}' entrypoint.post '${src}' does not exist` });
        continue;
      }
      const html = renderMarkdown(await readFile(mdPath, "utf8"), { allowHtml: node.markdown?.allowHtml === true });
      const body = renderPostDetail(pack, html);
      files.push({ path: `${base}/index.html`, contents: page({ node, title: `${pack.title} — ${title}`, basePrefix: DETAIL_PREFIX, main: body }) });
    } else {
      const body = renderPackDetail(pack, detailCtx);
      files.push({ path: `${base}/index.html`, contents: page({ node, title: `${pack.title} — ${title}`, basePrefix: DETAIL_PREFIX, main: body }) });
    }
  }

  // 4. static/ copied verbatim to dist root.
  const staticDir = path.join(root, "static");
  if (await exists(staticDir)) {
    for (const rel of await walk(staticDir)) {
      assets.push({ from: path.join(staticDir, rel), to: rel });
    }
  }

  // 5. Public catalog.json, RSS, sitemap.
  files.push({ path: "catalog.json", contents: stableStringify(catalog) });
  if (feedPosts.length > 0) {
    files.push({ path: "feed.xml", contents: renderFeed(node, feedPosts, site) });
  }
  files.push({ path: "sitemap.txt", contents: renderSitemap(sitemapPaths, site) });

  assets.sort((a, b) => (a.to < b.to ? -1 : a.to > b.to ? 1 : 0));
  return { files, assets, errors, warnings };
}
