/**
 * True when a URL points off the homespace — i.e. would trigger an external network
 * request if used as a resource load. Local schemes (`data:`, `blob:`) and
 * relative/rooted paths are internal. This is the core predicate behind both
 * the font-path guard (§6.1) and the offline-budget gate (§10.2).
 */
export function isExternalUrl(url: string): boolean {
  const s = url.trim();
  if (/^https?:\/\//i.test(s)) return true;
  if (s.startsWith("//")) return true; // protocol-relative
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    // Some other scheme — data:/blob: stay local; ftp:, etc. are external.
    return !/^(data|blob):/i.test(s);
  }
  return false;
}
