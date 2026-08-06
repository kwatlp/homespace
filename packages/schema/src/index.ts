/**
 * `homespace-schema` — the two contracts (pack manifest §3, homespace manifest §4) and
 * the emitted catalog, as JSON Schemas (the source of truth), the TypeScript
 * types generated from them, and `validate*()` entry points backed by ajv.
 *
 * See `internal-docs/HomespaceTDD.md` §3, §4, §5.
 */

export type {
  Catalog,
  CatalogPack,
  Checksums,
  Footer,
  LocalAddress,
  NavLink,
  HomespaceManifest,
  PackEntrypoint,
  PackManifest,
  PackMedia,
  Section,
  Source,
  Theme,
  ThemeTokens,
} from "./types.generated.js";

/**
 * The raw JSON Schemas — the source of truth — embedded at codegen time so the
 * package imports cleanly where there is no filesystem (TDD §15.2, WO-21).
 */
export { catalogSchema, homespaceSchema, packSchema } from "./schemas.generated.js";

export {
  validateCatalog,
  validateHomespace,
  validatePack,
  type ValidationIssue,
  type ValidationResult,
} from "./validate.js";
