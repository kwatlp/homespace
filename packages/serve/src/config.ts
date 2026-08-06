import type { ZipLimits } from "./zip.js";

/** A scoped key for a linked system (TDD §9.3). */
export interface ScopedKey {
  key: string;
  /** Granted scopes; the write API requires "packs:write". */
  scopes: string[];
  /** If set, the key may only write these pack types. */
  allowedTypes?: string[];
  /** If set, the key may only write ids beginning with this prefix. */
  allowedIdPrefix?: string;
}

export interface ServeConfig {
  /** Homespace root (contains content/, dist/, homespace.manifest.*). */
  root: string;
  /**
   * Operator bearer key — full write access. Prefer the `HOMESPACE_OPERATOR_KEY`
   * environment variable; a key in `homespace.serve.json` is a file to keep out
   * of version control (TDD §9.2, §12).
   */
  operatorKey?: string;
  /** Scoped keys for linked systems. */
  keys?: ScopedKey[];
  port?: number;
  host?: string;
  /** Largest upload body accepted, in bytes. Default 1 GiB; over it → 413. */
  maxUploadBytes?: number;
  /** Overrides for archive expansion caps (see `DEFAULT_ZIP_LIMITS`). */
  zipLimits?: Partial<ZipLimits>;
}
