/**
 * `@homespace/schema` — the two contracts (pack manifest §3, homespace manifest §4) and
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

export {
  catalogSchema,
  homespaceSchema,
  packSchema,
  validateCatalog,
  validateHomespace,
  validatePack,
  type ValidationIssue,
  type ValidationResult,
} from "./validate.js";
