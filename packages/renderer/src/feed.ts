import type { CatalogPack, HomespaceManifest } from "homespace-schema";

import { escapeXml } from "./escape.js";

/** Join a site base (possibly empty) with a rooted path, avoiding `//`. */
function url(site: string, path: string): string {
  if (site === "") return path;
  return `${site.replace(/\/$/, "")}${path}`;
}

function rfc822(iso: string): string | null {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t).toUTCString();
}

/**
 * Build an RSS 2.0 feed for a set of post packs. `site` is an optional absolute
 * base URL; when empty, links are site-relative (distribution is the link —
 * TDD §1.1.3). Pure and deterministic.
 */
export function renderFeed(homespace: HomespaceManifest, postsList: CatalogPack[], site = ""): string {
  const channelTitle = homespace.title ?? homespace.name;
  const items = postsList
    .map((pack) => {
      const link = url(site, `/posts/${pack.slug}/`);
      const desc = typeof pack.summary === "string" ? pack.summary : "";
      const pub = typeof pack.created === "string" ? rfc822(pack.created) : null;
      return [
        "    <item>",
        `      <title>${escapeXml(pack.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="false">${escapeXml(pack.id)}</guid>`,
        desc ? `      <description>${escapeXml(desc)}</description>` : "",
        pub ? `      <pubDate>${escapeXml(pub)}</pubDate>` : "",
        "    </item>",
      ]
        .filter((l) => l !== "")
        .join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${escapeXml(url(site, "/"))}</link>
    <description>${escapeXml(typeof homespace.tagline === "string" ? homespace.tagline : channelTitle)}</description>
${items}
  </channel>
</rss>
`;
}

/** Build sitemap.txt: one URL per line, deterministic. */
export function renderSitemap(paths: string[], site = ""): string {
  const lines = paths
    .map((p) => url(site, p))
    .sort()
    .filter((v, i, arr) => arr.indexOf(v) === i);
  return `${lines.join("\n")}\n`;
}
