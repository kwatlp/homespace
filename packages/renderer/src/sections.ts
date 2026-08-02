import type { Catalog, CatalogPack, HomespaceManifest, Section } from "homespace-schema";

import { escapeAttr, escapeHtml } from "./escape.js";
import { packAssetUrl, packPageUrl, thumbAssetUrl } from "./html.js";
import { selectPacks } from "./select.js";
import { isRasterImage } from "./thumbnails.js";

export interface RenderContext {
  homespace: HomespaceManifest;
  catalog: Catalog;
  /** Prefix to reach dist root from the page being rendered. */
  basePrefix: string;
  /** Verbatim contents of `html` section files, keyed by manifest path. */
  htmlFiles?: ReadonlyMap<string, string>;
  /** When true, cards/gallery reference generated .thumbs/ images. */
  thumbnails?: boolean;
}

/** Pick the thumbnail URL when enabled and the image is a raster; else full. */
function imageUrl(pack: CatalogPack, rel: string, ctx: RenderContext): string {
  return ctx.thumbnails === true && isRasterImage(rel)
    ? thumbAssetUrl(ctx.basePrefix, pack, rel)
    : packAssetUrl(ctx.basePrefix, pack, rel);
}

/** The full v0 section registry (TDD §4). */
export const SUPPORTED_SECTIONS = new Set([
  "hero",
  "links",
  "packs",
  "posts",
  "gallery",
  "embed",
  "html",
]);

/** Render one section, or `null` if its type isn't in the registry. */
export function renderSection(section: Section, ctx: RenderContext): string | null {
  switch (section.type) {
    case "hero":
      return hero(section, ctx);
    case "links":
      return links(section, ctx);
    case "packs":
      return packs(section, ctx);
    case "posts":
      return posts(section, ctx);
    case "gallery":
      return gallery(section, ctx);
    case "embed":
      return embed(section, ctx);
    case "html":
      return htmlSection(section, ctx);
    default:
      return null;
  }
}

/** Human label for a section (used in generated nav / grid tiles). */
export function sectionLabel(section: Section): string {
  if (typeof section.title === "string" && section.title) return section.title;
  return section.type.charAt(0).toUpperCase() + section.type.slice(1);
}

const RESERVED_SLUGS = new Set(["packs", "posts"]);

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";
}

/**
 * Derive a unique, URL-safe slug for a section page (pages/grid layouts).
 * Avoids the reserved `packs/` and `posts/` detail directories.
 */
export function sectionSlug(section: Section, used: Set<string>): string {
  let base = typeof section.title === "string" && section.title ? slugify(section.title) : section.type;
  if (RESERVED_SLUGS.has(base)) base = `${base}-section`;
  let slug = base;
  let n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;
  used.add(slug);
  return slug;
}

function wrapSection(id: string, inner: string, extraClass = ""): string {
  const cls = `section${extraClass ? ` ${extraClass}` : ""}`;
  return `<section class="${cls}" id="${escapeAttr(id)}"><div class="wrap">\n${inner}\n</div></section>\n`;
}

function heading(title: unknown): string {
  return typeof title === "string" && title ? `<h2>${escapeHtml(title)}</h2>\n` : "";
}

function coverImg(pack: CatalogPack, ctx: RenderContext, className: string): string {
  const cover = pack.media?.cover;
  if (typeof cover !== "string") return "";
  const alt = pack.media?.alt?.[cover] ?? pack.title;
  const src = imageUrl(pack, cover, ctx);
  return `<img class="${className}" src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" loading="lazy">`;
}

function hero(section: Section, ctx: RenderContext): string {
  const parts: string[] = [];
  if (typeof section.heading === "string") parts.push(`<h1>${escapeHtml(section.heading)}</h1>`);
  if (typeof section.sub === "string") parts.push(`<p>${escapeHtml(section.sub)}</p>`);
  if (typeof section.media === "string") {
    parts.push(`<img src="${escapeAttr(ctx.basePrefix + section.media)}" alt="">`);
  }
  return wrapSection("hero", parts.join("\n"), "hero");
}

function links(section: Section, ctx: RenderContext): string {
  const selected = selectPacks(ctx.catalog, section.source);
  const items = selected
    .map((pack) => {
      const href = pack.entrypoint?.link;
      const label = typeof href === "string"
        ? `<a href="${escapeAttr(href)}">${escapeHtml(pack.title)}</a>`
        : escapeHtml(pack.title);
      const summary = typeof pack.summary === "string" ? `<p>${escapeHtml(pack.summary)}</p>` : "";
      return `<li><h3>${label}</h3>${summary}</li>`;
    })
    .join("\n");
  return wrapSection("links", `${heading(section.title)}<ul class="links">\n${items}\n</ul>`);
}

function packs(section: Section, ctx: RenderContext): string {
  const selected = selectPacks(ctx.catalog, section.source);
  const asList = section.style === "list";
  const items = selected.map((pack) => card(pack, ctx)).join("\n");
  const listClass = asList ? "links" : "cards";
  return wrapSection("packs", `${heading(section.title)}<div class="${listClass}">\n${items}\n</div>`);
}

function card(pack: CatalogPack, ctx: RenderContext): string {
  const href = packPageUrl(ctx.basePrefix, pack);
  const cover = coverImg(pack, ctx, "");
  const summary = typeof pack.summary === "string" ? `<p>${escapeHtml(pack.summary)}</p>` : "";
  const tags = Array.isArray(pack.tags) && pack.tags.length > 0
    ? `<p class="tag">${pack.tags.map((t) => escapeHtml(t)).join(" · ")}</p>`
    : "";
  return `<article class="card">${cover}<div class="card-body">` +
    `<h3><a class="card-link" href="${escapeAttr(href)}">${escapeHtml(pack.title)}</a></h3>` +
    `${summary}${tags}</div></article>`;
}

function posts(section: Section, ctx: RenderContext): string {
  const selected = selectPacks(ctx.catalog, section.source);
  const items = selected
    .map((pack) => {
      const href = packPageUrl(ctx.basePrefix, pack);
      const date = typeof pack.created === "string"
        ? `<time datetime="${escapeAttr(pack.created)}">${escapeHtml(pack.created.slice(0, 10))}</time>`
        : "";
      const summary = typeof pack.summary === "string" ? `<p>${escapeHtml(pack.summary)}</p>` : "";
      return `<li><h3><a href="${escapeAttr(href)}">${escapeHtml(pack.title)}</a></h3>${date}${summary}</li>`;
    })
    .join("\n");
  return wrapSection("posts", `${heading(section.title)}<ul class="feed">\n${items}\n</ul>`);
}

function gallery(section: Section, ctx: RenderContext): string {
  const selected = selectPacks(ctx.catalog, section.source);
  const figures: string[] = [];
  for (const pack of selected) {
    const images: string[] = [];
    if (typeof pack.media?.cover === "string") images.push(pack.media.cover);
    if (Array.isArray(pack.media?.gallery)) {
      for (const g of pack.media.gallery) if (typeof g === "string") images.push(g);
    }
    const href = packPageUrl(ctx.basePrefix, pack);
    for (const img of images) {
      const alt = pack.media?.alt?.[img] ?? pack.title;
      const src = imageUrl(pack, img, ctx);
      figures.push(
        `<a href="${escapeAttr(href)}"><img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" loading="lazy"></a>`,
      );
    }
  }
  return wrapSection("gallery", `${heading(section.title)}<div class="gallery">\n${figures.join("\n")}\n</div>`);
}

function embed(section: Section, ctx: RenderContext): string {
  if (typeof section.src !== "string") return wrapSection("embed", heading(section.title));
  const src = escapeAttr(ctx.basePrefix + section.src);
  const height = typeof section.height === "number" ? section.height : 420;
  const title = escapeAttr(sectionLabel(section));
  const iframe =
    `<iframe class="embed" src="${src}" title="${title}" loading="lazy" ` +
    `style="width:100%;height:${height}px;border:0"></iframe>`;
  return wrapSection("embed", `${heading(section.title)}${iframe}`, "embed-section");
}

function htmlSection(section: Section, ctx: RenderContext): string {
  const raw = typeof section.file === "string" ? ctx.htmlFiles?.get(section.file) ?? "" : "";
  // Operator-authored: inserted verbatim (TDD §6.5).
  return wrapSection("html", raw, "html-section");
}
