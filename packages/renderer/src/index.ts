/**
 * `homespace-renderer` — turns a `(catalog, homespace manifest)` pair plus a homespace's
 * theme/static/pack files into a `dist/` of static HTML + CSS with no external
 * requests. Deterministic; never walks the filesystem outside its inputs.
 *
 * See `internal-docs/HomespaceTDD.md` §6, §10.2.
 */

export {
  render,
  type RenderInput,
  type RenderResult,
  type RenderIssue,
  type OutputFile,
  type CopyOp,
  type ThumbOp,
} from "./render.js";

export { writeDist, type WriteOptions } from "./write.js";
export { loadSharpThumbnailer, isRasterImage, THUMB_WIDTH, type Thumbnailer } from "./thumbnails.js";

export {
  assertOfflineBudget,
  findBudgetViolations,
  type BudgetViolation,
  type Crawlable,
} from "./offline-budget.js";

export { renderMarkdown, type MarkdownOptions } from "./markdown.js";
export { sandboxTokens } from "./player.js";
export { renderTokensCss, DEFAULT_TOKENS, type TokensCss, type FontAsset } from "./tokens.js";
export { selectPacks } from "./select.js";
export { isExternalUrl } from "./url.js";
export { BASE_CSS } from "./assets.js";
