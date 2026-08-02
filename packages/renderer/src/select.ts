import type { Catalog, CatalogPack, Source } from "@homespace/schema";

/**
 * Resolve a section's `source` filter against the catalog (TDD §4). Deterministic:
 * falls back to catalog order (already id-sorted) when no sort is given.
 */
export function selectPacks(catalog: Catalog, source: Source | undefined): CatalogPack[] {
  let packs = catalog.packs.slice();

  if (source?.types && source.types.length > 0) {
    const types = new Set(source.types);
    packs = packs.filter((p) => types.has(p.type));
  }
  if (source?.tags && source.tags.length > 0) {
    const wanted = new Set(source.tags);
    packs = packs.filter((p) => Array.isArray(p.tags) && p.tags.some((t) => wanted.has(t)));
  }
  if (source?.ids && source.ids.length > 0) {
    const ids = new Set(source.ids);
    packs = packs.filter((p) => ids.has(p.id));
  }

  if (source?.sort) {
    const key = source.sort;
    packs.sort((a, b) => compareBy(a, b, key));
  }

  if (typeof source?.limit === "number") {
    packs = packs.slice(0, Math.max(0, source.limit));
  }

  return packs;
}

function compareBy(a: CatalogPack, b: CatalogPack, key: "created" | "updated" | "title"): number {
  if (key === "title") return cmp(a.title, b.title);
  // created/updated: newest first; missing dates sort last.
  const av = typeof a[key] === "string" ? (a[key] as string) : "";
  const bv = typeof b[key] === "string" ? (b[key] as string) : "";
  if (av === bv) return cmp(a.id, b.id);
  if (av === "") return 1;
  if (bv === "") return -1;
  return av < bv ? 1 : -1;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
