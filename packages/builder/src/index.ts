/**
 * `homespace-builder` — the browser half of the kit. It runs the *same*
 * scanner and renderer as the CLI against an in-memory homespace and hands back
 * the built bytes, so a person can compose a homespace in a web page with
 * nothing installed and nothing uploaded.
 *
 * See `internal-docs/HomespaceTDD.md` §6.6, §15.
 */

export {
  buildInMemory,
  type BrowserBuildInput,
  type BrowserBuildResult,
  type BuiltFile,
  type Thumbnailer,
} from "./build.js";

export { memoryFiles, MEMORY_ROOT, type MemoryTree } from "./memory-files.js";
