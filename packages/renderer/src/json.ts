/** Recursively sort object keys so serialized JSON is order-independent. */
function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = stableSort((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Serialize to deterministic JSON (sorted keys, trailing newline). */
export function stableStringify(value: unknown): string {
  return `${JSON.stringify(stableSort(value), null, 2)}\n`;
}
