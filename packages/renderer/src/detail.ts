import type { CatalogPack } from "@homespace/schema";

import { escapeAttr, escapeHtml } from "./escape.js";
import { packAssetUrl } from "./html.js";
import { PLAYER_SCRIPT, renderDownload, renderPlayer } from "./player.js";
import type { RenderContext } from "./sections.js";

/** Detail-page basePrefix: detail pages live two levels below dist root. */
export const DETAIL_PREFIX = "../../";

function galleryFigures(pack: CatalogPack, ctx: RenderContext): string {
  const gallery = pack.media?.gallery;
  if (!Array.isArray(gallery) || gallery.length === 0) return "";
  const imgs = gallery
    .filter((g): g is string => typeof g === "string")
    .map((g) => {
      const alt = pack.media?.alt?.[g] ?? "";
      return `<img src="${escapeAttr(packAssetUrl(ctx.basePrefix, pack, g))}" alt="${escapeAttr(alt)}" loading="lazy">`;
    })
    .join("\n");
  return `<div class="gallery">\n${imgs}\n</div>`;
}

function main(inner: string): string {
  return `<article class="section"><div class="wrap">\n${inner}\n</div></article>\n`;
}

/** Detail page body for a game/app/art/bundle pack (posts are separate). */
export function renderPackDetail(pack: CatalogPack, ctx: RenderContext): string {
  const parts: string[] = [`<h1>${escapeHtml(pack.title)}</h1>`];
  if (typeof pack.summary === "string") parts.push(`<p>${escapeHtml(pack.summary)}</p>`);

  const cover = pack.media?.cover;
  if (typeof cover === "string") {
    const alt = pack.media?.alt?.[cover] ?? pack.title;
    parts.push(`<img src="${escapeAttr(packAssetUrl(ctx.basePrefix, pack, cover))}" alt="${escapeAttr(alt)}">`);
  }

  const web = pack.entrypoint?.web;
  const hasPlayer = typeof web === "string";
  if (typeof web === "string") {
    parts.push(renderPlayer(packAssetUrl(ctx.basePrefix, pack, web), pack.sandbox));
  }

  const download = pack.entrypoint?.download;
  if (typeof download === "string") {
    parts.push(renderDownload(packAssetUrl(ctx.basePrefix, pack, download), pack.checksums?.[download]));
  }

  parts.push(galleryFigures(pack, ctx));

  if (Array.isArray(pack.tags) && pack.tags.length > 0) {
    parts.push(`<p class="tag">${pack.tags.map((t) => escapeHtml(t)).join(" · ")}</p>`);
  }

  const discussion = pack.discussion_url;
  if (typeof discussion === "string") {
    parts.push(`<p><a href="${escapeAttr(discussion)}">Discussion</a></p>`);
  }

  const body = main(parts.filter((p) => p !== "").join("\n"));
  return hasPlayer ? `${body}${PLAYER_SCRIPT}\n` : body;
}

/** Detail page body for a post, given its already-rendered markdown HTML. */
export function renderPostDetail(pack: CatalogPack, contentHtml: string): string {
  const date = typeof pack.created === "string"
    ? `<p class="tag"><time datetime="${escapeAttr(pack.created)}">${escapeHtml(pack.created.slice(0, 10))}</time></p>`
    : "";
  return main(
    `<h1>${escapeHtml(pack.title)}</h1>\n${date}\n<div class="prose">\n${contentHtml}\n</div>`,
  );
}
