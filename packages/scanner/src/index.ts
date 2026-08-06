/**
 * `homespace-scanner` — walks a homespace's `content/` tree, validates each pack
 * manifest against `homespace-schema`, confines every pack-relative path, and
 * emits a deterministic `catalog.json`. Pure with respect to rendering: it
 * produces data, never HTML.
 *
 * See `internal-docs/HomespaceTDD.md` §2, §5, §12.
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

export type { DirEntry, FileAccess, PathKind } from "./files.js";
export { nodeFiles } from "./node-files.js";
