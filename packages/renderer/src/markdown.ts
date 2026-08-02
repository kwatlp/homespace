import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";

export interface MarkdownOptions {
  /** Homespace-level opt-in for raw HTML in post markdown (TDD §6.3). Off by default. */
  allowHtml?: boolean;
}

/**
 * Render post markdown to HTML with GFM. Raw HTML is disabled by default
 * (dropped/escaped) and dangerous link protocols (`javascript:`) are always
 * sanitized. Relative links/images resolve within the post's own directory,
 * where its pack files are copied.
 */
export function renderMarkdown(src: string, options: MarkdownOptions = {}): string {
  return micromark(src, {
    allowDangerousHtml: options.allowHtml === true,
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  });
}
