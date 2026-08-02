import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import type { Catalog, CatalogPack, NodeManifest, Section } from "@kwatlp/schema";

import { BASE_CSS } from "./assets.js";
import { DETAIL_PREFIX, renderPackDetail, renderPostDetail } from "./detail.js";
import { escapeAttr, escapeHtml } from "./escape.js";
import { renderFeed, renderSitemap } from "./feed.js";
import { packAssetUrl, page, type NavItem } from "./html.js";
import { stableStringify } from "./json.js";
import { renderMarkdown } from "./markdown.js";
import { isRasterImage, THUMB_WIDTH } from "./thumbnails.js";
import { renderTokensCss } from "./tokens.js";
import {
  renderSection,
  sectionLabel,
  sectionSlug,
  SUPPORTED_SECTIONS,
  type RenderContext,
} from "./sections.js";

export interface RenderInput {
  catalog: Catalog;
  node: NodeManifest;
  /** Node root directory (source of static/, theme/, and pack files). */
  root: string;
  /** Absolute base URL for feed/sitemap; relative when omitted. */
  site?: string;
  /** Reference (and emit) .thumbs/ images — set when a thumbnailer is available. */
  thumbnails?: boolean;
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

/** A thumbnail to generate: downscale `from` to `width` and write to `to`. */
export interface ThumbOp {
  from: string;
  to: string;
  width: number;
}

export interface RenderResult {
  files: OutputFile[];
  assets: CopyOp[];
  thumbnails: ThumbOp[];
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

/** Resolve a node-relative path, or null if it escapes the node root. */
function confinedPath(root: string, rel: string): string | null {
  const rootAbs = path.resolve(root);
  const abs = path.resolve(rootAbs, rel);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) return null;
  return abs;
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
  const thumbnails: ThumbOp[] = [];

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

  // 2. Pre-read html-section files (operator-authored, confined to the node).
  const sections = Array.isArray(node.sections) ? node.sections : [];
  const htmlFiles = new Map<string, string>();
  for (const section of sections) {
    if (section.type !== "html" || typeof section.file !== "string") continue;
    const abs = confinedPath(root, section.file);
    if (abs === null) {
      errors.push({ severity: "error", message: `html section file '${section.file}' escapes the node root` });
      continue;
    }
    if (!(await exists(abs))) {
      errors.push({ severity: "error", message: `html section file '${section.file}' does not exist` });
      continue;
    }
    htmlFiles.set(section.file, await readFile(abs, "utf8"));
  }

  // 3. Sections + layout.
  const supported = sections.filter((s) => {
    if (SUPPORTED_SECTIONS.has(s.type)) return true;
    warnings.push({ severity: "warning", message: `unknown section type '${s.type}' — skipped` });
    return false;
  });

  const feedPosts: CatalogPack[] = [];
  const seenFeed = new Set<string>();
  for (const section of supported) {
    if (section.type === "posts" && section.rss === true) {
      for (const pack of catalog.packs) {
        if (pack.type === "post" && !seenFeed.has(pack.id)) {
          seenFeed.add(pack.id);
          feedPosts.push(pack);
        }
      }
    }
  }
  const hasFeed = feedPosts.length > 0;

  const title = node.title ?? node.name;
  const layout = node.layout === "pages" || node.layout === "grid" ? node.layout : "scroll";
  const sitemapPaths = ["/"];

  const useThumbs = input.thumbnails === true;
  const renderInto = (section: Section, basePrefix: string): string =>
    renderSection(section, { node, catalog, basePrefix, htmlFiles, thumbnails: useThumbs }) ?? "";

  if (layout === "scroll") {
    const main = supported.map((s) => renderInto(s, "")).join("\n");
    files.push({ path: "index.html", contents: page({ node, title, basePrefix: "", main, feed: hasFeed }) });
  } else {
    // pages + grid share per-section pages; slugs are assigned once, in order.
    const used = new Set<string>();
    const metas = supported.map((section) => ({ section, slug: sectionSlug(section, used) }));
    const navFor = (basePrefix: string): NavItem[] =>
      metas.map((m, i) => ({
        label: sectionLabel(m.section),
        href: layout === "pages" && i === 0 ? (basePrefix === "" ? "./" : basePrefix) : `${basePrefix}${m.slug}/`,
      }));

    const emitSectionPage = (section: Section, slug: string): void => {
      files.push({
        path: `${slug}/index.html`,
        contents: page({
          node,
          title: `${sectionLabel(section)} — ${title}`,
          basePrefix: "../",
          main: renderInto(section, "../"),
          nav: navFor("../"),
          feed: hasFeed,
        }),
      });
      sitemapPaths.push(`/${slug}/`);
    };

    if (layout === "pages") {
      const landing = metas[0];
      const main = landing ? renderInto(landing.section, "") : "";
      files.push({ path: "index.html", contents: page({ node, title, basePrefix: "", main, nav: navFor(""), feed: hasFeed }) });
      for (const m of metas.slice(1)) emitSectionPage(m.section, m.slug);
    } else {
      const tiles = metas
        .map((m) => `<a class="tile" href="${escapeAttr(`${m.slug}/`)}">${escapeHtml(sectionLabel(m.section))}</a>`)
        .join("\n");
      const gridMain = `<section class="section"><div class="wrap">\n<div class="tiles">\n${tiles}\n</div>\n</div></section>\n`;
      files.push({ path: "index.html", contents: page({ node, title, basePrefix: "", main: gridMain, nav: navFor(""), feed: hasFeed }) });
      for (const m of metas) emitSectionPage(m.section, m.slug);
    }
  }

  // 4. Detail pages + pack file copies (generated regardless of layout).
  const detailCtx: RenderContext = { node, catalog, basePrefix: DETAIL_PREFIX };

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

    // Emit thumbnails for the raster images shown in cards/gallery.
    if (useThumbs) {
      const images = [pack.media?.cover, ...(Array.isArray(pack.media?.gallery) ? pack.media.gallery : [])];
      for (const rel of images) {
        if (typeof rel !== "string" || !isRasterImage(rel)) continue;
        const from = path.join(packDir, rel);
        if (await exists(from)) {
          thumbnails.push({ from, to: `.thumbs/${packAssetUrl("", pack, rel)}`, width: THUMB_WIDTH });
        }
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
      files.push({ path: `${base}/index.html`, contents: page({ node, title: `${pack.title} — ${title}`, basePrefix: DETAIL_PREFIX, main: body, feed: hasFeed }) });
    } else {
      const body = renderPackDetail(pack, detailCtx);
      files.push({ path: `${base}/index.html`, contents: page({ node, title: `${pack.title} — ${title}`, basePrefix: DETAIL_PREFIX, main: body, feed: hasFeed }) });
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
  thumbnails.sort((a, b) => (a.to < b.to ? -1 : a.to > b.to ? 1 : 0));
  return { files, assets, thumbnails, errors, warnings };
}
