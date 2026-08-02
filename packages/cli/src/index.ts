/**
 * `homespace-cli` — the `homespace` command: `init | new | validate | build | dev`.
 * Thin orchestration over `homespace-schema`, `homespace-scanner`, and
 * `homespace-renderer`. See `internal-docs/HomespaceTDD.md` §7.
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
export { loadHomespace, type LoadedHomespace } from "./load.js";
export type { Context, IO } from "./io.js";
