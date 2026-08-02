import type { IO } from "./io.js";

/** Print warning lines (non-fatal). */
export function warn(io: IO, messages: string[]): void {
  for (const m of messages) io.err(`warning: ${m}\n`);
}

/** Print error lines. */
export function fail(io: IO, messages: string[]): void {
  for (const m of messages) io.err(`error: ${m}\n`);
}
