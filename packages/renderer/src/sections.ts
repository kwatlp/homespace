import type { Catalog, CatalogPack, NodeManifest, Section } from "@kwatlp/schema";

import { escapeAttr, escapeHtml } from "./escape.js";
import { packAssetUrl, packPageUrl } from "./html.js";
import { selectPacks } from "./select.js";

export interface RenderContext {
  node: NodeManifest;
  catalog: Catalog;
  /** Prefix to reach dist root from the page being rendered. */
  basePrefix: string;
}

/** Section types this WO can render. gallery/embed/html arrive in WO-5. */
export const SUPPORTED_SECTIONS = new Set(["hero", "links", "packs", "posts"]);

/** Render one section, or `null` if its type isn't supported yet. */
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
    default:
      return null;
  }
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
  const src = packAssetUrl(ctx.basePrefix, pack, cover);
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
