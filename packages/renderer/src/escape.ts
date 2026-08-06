/** Escape text for HTML element content. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Escape a string for an HTML attribute. Call sites all use double quotes;
 * single quotes are escaped too so a value stays safe if one ever doesn't.
 */
export function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Escape text for inclusion in XML (RSS/sitemap) content. */
export function escapeXml(value: string): string {
  return escapeHtml(value)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
