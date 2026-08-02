/**
 * `@kwatlp/scanner` — walks a node's `content/` tree, validates each pack
 * manifest against `@kwatlp/schema`, confines every pack-relative path, and
 * emits a deterministic `catalog.json`. Pure with respect to rendering: it
 * produces data, never HTML.
 *
 * See `internal-docs/KwatlpTDD.md` §2, §5, §12.
 */

export {
  scan,
  serializeCatalog,
  type IssueSeverity,
  type ScanIssue,
  type ScanOptions,
  type ScanResult,
} from "./scan.js";

export {
  confineToBase,
  toPosix,
  type ConfineResult,
  type ConfineOk,
  type ConfineErr,
} from "./paths.js";
