import { Ajv, type ErrorObject } from "ajv";

import { catalogSchema, homespaceSchema, packSchema } from "./schemas.generated.js";
import type { Catalog, HomespaceManifest, PackManifest } from "./types.generated.js";

/** A single validation problem, addressed by JSON Pointer path. */
export interface ValidationIssue {
  /** JSON Pointer into the validated value (`""` = root). */
  path: string;
  /** Human-readable, designer-facing description. */
  message: string;
}

/** Outcome of validating a value against one of the contracts. */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  /**
   * Non-fatal notices — chiefly unknown top-level fields, which the contracts
   * keep and pass through rather than reject (TDD §3, "warn, keep, pass
   * through").
   */
  warnings: ValidationIssue[];
}

const ajv = new Ajv({ allErrors: true, strict: false });

const validatePackFn = ajv.compile<PackManifest>(packSchema);
const validateHomespaceFn = ajv.compile<HomespaceManifest>(homespaceSchema);
const validateCatalogFn = ajv.compile<Catalog>(catalogSchema);

/** Known top-level keys per contract; anything else is warned-and-kept. */
const PACK_KNOWN_KEYS = new Set([
  "id",
  "type",
  "title",
  "summary",
  "version",
  "entrypoint",
  "media",
  "checksums",
  "tags",
  "license",
  "created",
  "updated",
  "discussion_url",
  "sandbox",
  "extra",
]);

const NODE_KNOWN_KEYS = new Set([
  "$schema",
  "name",
  "title",
  "tagline",
  "lang",
  "local",
  "layout",
  "theme",
  "nav",
  "markdown",
  "sections",
  "footer",
]);

function toIssue(error: ErrorObject): ValidationIssue {
  const path = error.instancePath;
  const where = path === "" ? "(root)" : path;
  let message = `${where}: ${error.message ?? "is invalid"}`;
  if (error.keyword === "enum" && Array.isArray(error.params["allowedValues"])) {
    message += ` (allowed: ${(error.params["allowedValues"] as unknown[]).join(", ")})`;
  }
  if (error.keyword === "additionalProperties") {
    message += ` ('${String(error.params["additionalProperty"])}')`;
  }
  return { path, message };
}

function issues(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  return (errors ?? []).map(toIssue);
}

function unknownKeyWarnings(
  data: unknown,
  known: ReadonlySet<string>,
): ValidationIssue[] {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return [];
  }
  return Object.keys(data)
    .filter((key) => !known.has(key))
    .map((key) => ({
      path: `/${key}`,
      message: `Unknown field '${key}' — kept and passed through (not part of the contract).`,
    }));
}

/** Validate a pack manifest (Contract #1). */
export function validatePack(data: unknown): ValidationResult {
  const valid = validatePackFn(data);
  return {
    valid,
    errors: valid ? [] : issues(validatePackFn.errors),
    warnings: unknownKeyWarnings(data, PACK_KNOWN_KEYS),
  };
}

/** Validate a homespace manifest (Contract #2). */
export function validateHomespace(data: unknown): ValidationResult {
  const valid = validateHomespaceFn(data);
  return {
    valid,
    errors: valid ? [] : issues(validateHomespaceFn.errors),
    warnings: unknownKeyWarnings(data, NODE_KNOWN_KEYS),
  };
}

/** Validate a catalog document (scanner output). */
export function validateCatalog(data: unknown): ValidationResult {
  const valid = validateCatalogFn(data);
  return {
    valid,
    errors: valid ? [] : issues(validateCatalogFn.errors),
    warnings: [],
  };
}
