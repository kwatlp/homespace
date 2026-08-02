import type { NodeManifest } from "@kwatlp/schema";

import { escapeAttr, escapeHtml } from "./escape.js";

export interface PageOptions {
  node: NodeManifest;
  /** Text for <title>. */
  title: string;
  /** Prefix to reach dist root from this page ("" at root, "../../" in detail). */
  basePrefix: string;
  /** Rendered contents of <main>. */
  main: string;
}

/** Rewrite an in-page nav anchor so it resolves from a nested detail page. */
function navHref(href: string, basePrefix: string): string {
  return href.startsWith("#") ? `${basePrefix}${href}` : href;
}

/** Render a complete, self-contained HTML document. */
export function page(options: PageOptions): string {
  const { node, basePrefix } = options;
  const lang = typeof node.lang === "string" && node.lang ? node.lang : "en";
  const siteTitle = node.title ?? node.name;

  const nav = Array.isArray(node.nav) && node.nav.length > 0
    ? `<nav class="site-nav" aria-label="Primary"><ul>${node.nav
        .map(
          (item) =>
            `<li><a href="${escapeAttr(navHref(item.href, basePrefix))}">${escapeHtml(item.label)}</a></li>`,
        )
        .join("")}</ul></nav>`
    : "";

  const footer = node.footer
    ? `<footer class="site-footer"><div class="wrap">${footerContent(node)}</div></footer>`
    : "";

  return `<!doctype html>
<html lang="${escapeAttr(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)}</title>
<link rel="stylesheet" href="${escapeAttr(basePrefix)}tokens.css">
<link rel="stylesheet" href="${escapeAttr(basePrefix)}base.css">${
  typeof node.theme?.css === "string"
    ? `\n<link rel="stylesheet" href="${escapeAttr(basePrefix)}custom.css">`
    : ""
}
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

function footerContent(node: NodeManifest): string {
  const footer = node.footer ?? {};
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
