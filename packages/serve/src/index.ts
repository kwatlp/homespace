/**
 * `@kwatlp/serve` — the optional **Tier 2** daemon: watch `content/` and
 * rebuild, serve `dist/` with range requests, and expose an operator write API
 * plus scoped keys for linked systems. Additive by design — the static tiers
 * (0 and 1) never require it, and nothing else in the workspace imports it.
 *
 * Scaffold only (TDD §11, WO-0). The daemon lands LAST, in WO-9.
 * See `internal-docs/KwatlpTDD.md` §9.
 */

/** Package identifier — placeholder until WO-9 lands the real surface. */
export const PACKAGE_NAME = "@kwatlp/serve";
