/**
 * `@kwatlp/scanner` — walks a node's `content/` tree, validates each pack
 * manifest, verifies checksums when asked, and emits a deterministic
 * `catalog.json`. Pure with respect to rendering: it knows nothing about HTML.
 *
 * Scaffold only (TDD §11, WO-0). The scanner lands in WO-2.
 * See `internal-docs/KwatlpTDD.md` §2, §12.
 */

/** Package identifier — placeholder until WO-2 lands the real surface. */
export const PACKAGE_NAME = "@kwatlp/scanner";
