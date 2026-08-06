/**
 * `homespace-serve` — the optional **Tier 2** daemon: serve dist/ with range
 * requests, an operator write API (`PUT /api/packs/:id`, zip-slip-safe), and
 * scoped keys for linked systems. Additive by design; nothing else imports it.
 *
 * See `internal-docs/HomespaceTDD.md` §9.
 */

export { createServeServer, startServe, safeEntryName, type ServeHandle } from "./server.js";
export { rebuild, type RebuildResult } from "./rebuild.js";
export { authorize, bearerToken, canWrite, type Auth } from "./keys.js";
export {
  openZip,
  readZip,
  writeZip,
  DEFAULT_ZIP_LIMITS,
  type ZipArchive,
  type ZipEntry,
  type ZipLimits,
  type ZipMember,
  type WriteZipOptions,
} from "./zip.js";
export type { ScopedKey, ServeConfig } from "./config.js";
