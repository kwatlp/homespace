import type { HomespaceManifest } from "@homespace/schema";

import { escapeAttr, escapeHtml } from "./escape.js";

export interface NavItem {
  label: string;
  href: string;
}

export interface PageOptions {
  homespace: HomespaceManifest;
  /** Text for <title>. */
  title: string;
  /** Prefix to reach dist root from this page ("" at root, "../../" in detail). */
  basePrefix: string;
  /** Rendered contents of <main>. */
  main: string;
  /** Nav override (already-resolved hrefs); falls back to homespace.nav when absent. */
  nav?: NavItem[];
  /** Emit an RSS <link rel="alternate"> pointing at feed.xml. */
  feed?: boolean;
}

/** Rewrite an in-page nav anchor so it resolves from a nested detail page. */
function navHref(href: string, basePrefix: string): string {
  return href.startsWith("#") ? `${basePrefix}${href}` : href;
}

/** Render a complete, self-contained HTML document. */
export function page(options: PageOptions): string {
  const { homespace, basePrefix } = options;
  const lang = typeof homespace.lang === "string" && homespace.lang ? homespace.lang : "en";
  const siteTitle = homespace.title ?? homespace.name;

  const navItems: NavItem[] = options.nav
    ? options.nav
    : Array.isArray(homespace.nav)
      ? homespace.nav.map((item) => ({ label: item.label, href: navHref(item.href, basePrefix) }))
      : [];
  const nav = navItems.length > 0
    ? `<nav class="site-nav" aria-label="Primary"><ul>${navItems
        .map((item) => `<li><a href="${escapeAttr(item.href)}">${escapeHtml(item.label)}</a></li>`)
        .join("")}</ul></nav>`
    : "";

  const feedLink = options.feed === true
    ? `\n<link rel="alternate" type="application/rss+xml" href="${escapeAttr(basePrefix)}feed.xml" title="${escapeAttr(siteTitle)}">`
    : "";

  const footer = homespace.footer
    ? `<footer class="site-footer"><div class="wrap">${footerContent(homespace)}</div></footer>`
    : "";

  return `<!doctype html>
<html lang="${escapeAttr(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)}</title>
<link rel="stylesheet" href="${escapeAttr(basePrefix)}tokens.css">
<link rel="stylesheet" href="${escapeAttr(basePrefix)}base.css">${
  typeof homespace.theme?.css === "string"
    ? `\n<link rel="stylesheet" href="${escapeAttr(basePrefix)}custom.css">`
    : ""
}${feedLink}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap">
<p class="site-title">${escapeHtml(siteTitle)}</p>
${nav}
</div></header>
<main id="main">
${options.main}
</main>
${footer}
</body>
</html>
`;
}

function footerContent(homespace: HomespaceManifest): string {
  const footer = homespace.footer ?? {};
  const text = typeof footer.text === "string" ? `<p>${escapeHtml(footer.text)}</p>` : "";
  const links = Array.isArray(footer.links) && footer.links.length > 0
    ? `<ul class="links">${footer.links
        .map((l) => `<li><a href="${escapeAttr(l.href)}">${escapeHtml(l.label)}</a></li>`)
        .join("")}</ul>`
    : "";
  return `${text}${links}`;
}

/**
 * Build a URL to a file a pack copied into dist, honoring page depth. Non-post
 * packs keep their files under a `files/` subdir so they never collide with the
 * generated detail `index.html`; posts sit flat so relative markdown images
 * resolve against the post page.
 */
export function packAssetUrl(basePrefix: string, pack: { type: string; slug: string }, rel: string): string {
  const base = pack.type === "post" ? `posts/${pack.slug}` : `packs/${pack.slug}/files`;
  return `${basePrefix}${base}/${rel}`;
}

/** Build a URL to a pack's detail page. */
export function packPageUrl(basePrefix: string, pack: { type: string; slug: string }): string {
  const base = pack.type === "post" ? `posts/${pack.slug}` : `packs/${pack.slug}`;
  return `${basePrefix}${base}/`;
}

/** URL to a generated thumbnail (mirrors the asset path under .thumbs/). */
export function thumbAssetUrl(basePrefix: string, pack: { type: string; slug: string }, rel: string): string {
  return `${basePrefix}.thumbs/${packAssetUrl("", pack, rel)}`;
}
