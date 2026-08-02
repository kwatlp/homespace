#!/usr/bin/env node
/**
 * `kwatlp` CLI entry point. Scaffold only (TDD §11, WO-0); command routing
 * (`init | new | validate | build | dev`) lands in WO-4. See §7 of the TDD.
 */

import { PACKAGE_NAME } from "../index.js";

function main(argv: readonly string[]): void {
  const [command] = argv;
  if (command === undefined || command === "--help" || command === "-h") {
    process.stdout.write(
      `${PACKAGE_NAME} (scaffold)\n` +
        "Commands land in WO-4: init | new | validate | build | dev\n",
    );
    return;
  }
  process.stderr.write(
    `kwatlp: '${command}' is not available yet — the CLI is a WO-0 scaffold.\n`,
  );
  process.exitCode = 1;
}

main(process.argv.slice(2));
