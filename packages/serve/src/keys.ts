import type { ScopedKey, ServeConfig } from "./config.js";

export type Auth = { operator: true } | { operator: false; key: ScopedKey };

/** Extract a bearer token from an Authorization header. */
export function bearerToken(header: string | undefined): string | undefined {
  if (typeof header !== "string") return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : undefined;
}

/** Authorize a token for pack writes; null when unauthorized. */
export function authorize(token: string | undefined, config: ServeConfig): Auth | null {
  if (token === undefined || token === "") return null;
  if (typeof config.operatorKey === "string" && token === config.operatorKey) {
    return { operator: true };
  }
  const key = config.keys?.find((k) => k.key === token);
  if (key && key.scopes.includes("packs:write")) return { operator: false, key };
  return null;
}

/** Enforce a scoped key's limits for a specific pack. */
export function canWrite(
  auth: Auth,
  packId: string,
  packType: string,
): { ok: true } | { ok: false; reason: string } {
  if (auth.operator) return { ok: true };
  const { key } = auth;
  if (typeof key.allowedIdPrefix === "string" && !packId.startsWith(key.allowedIdPrefix)) {
    return { ok: false, reason: `this key may only write ids starting with '${key.allowedIdPrefix}'` };
  }
  if (Array.isArray(key.allowedTypes) && !key.allowedTypes.includes(packType)) {
    return { ok: false, reason: `this key may not write '${packType}' packs` };
  }
  return { ok: true };
}
