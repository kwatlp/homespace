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
  /** Node root (contains content/, dist/, node.manifest.*). */
  root: string;
  /** Operator bearer key — full write access. */
  operatorKey?: string;
  /** Scoped keys for linked systems. */
  keys?: ScopedKey[];
  port?: number;
  host?: string;
}
