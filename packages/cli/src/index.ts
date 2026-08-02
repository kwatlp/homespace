/**
 * `@kwatlp/cli` — the `kwatlp` command: `init | new | validate | build | dev`
 * (plus `serve` when the optional Tier-2 package is installed). Thin
 * orchestration over `@kwatlp/schema`, `@kwatlp/scanner`, and
 * `@kwatlp/renderer`; the heavy lifting lives in those.
 *
 * Scaffold only (TDD §11, WO-0). The commands land in WO-4.
 * See `internal-docs/KwatlpTDD.md` §7.
 */

/** Package identifier — placeholder until WO-4 lands the real surface. */
export const PACKAGE_NAME = "@kwatlp/cli";
