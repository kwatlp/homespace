#!/usr/bin/env node
/**
 * `homespace` — the public launcher. `npx homespace <command>` resolves to this
 * package (named `homespace`), which delegates to the `homespace-cli`
 * implementation. See `internal-docs/HomespaceTDD.md` §7.
 */
import { run } from "homespace-cli";

run(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`homespace: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
