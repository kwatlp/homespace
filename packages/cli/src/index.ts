/**
 * `@kwatlp/cli` — the `kwatlp` command: `init | new | validate | build | dev`.
 * Thin orchestration over `@kwatlp/schema`, `@kwatlp/scanner`, and
 * `@kwatlp/renderer`. See `internal-docs/KwatlpTDD.md` §7.
 */

export { run, type RunOptions } from "./cli.js";

export {
  contentType,
  createHandler,
  hostsHint,
  resolveAddress,
  startDev,
  type DevAddress,
  type DevFlags,
  type DevHandle,
  type HandlerOptions,
  type MdnsAdvertiser,
  type MdnsFactory,
} from "./commands/dev.js";

export { isPackType, packScaffold, PACK_TYPES, type PackType } from "./templates.js";
export { parseJsonc, stripJsonComments } from "./jsonc.js";
export { loadNode, type LoadedNode } from "./load.js";
export type { Context, IO } from "./io.js";
