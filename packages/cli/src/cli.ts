import { build } from "./commands/build.js";
import { dev, type MdnsFactory } from "./commands/dev.js";
import { init } from "./commands/init.js";
import { newCommand } from "./commands/new.js";
import { serve } from "./commands/serve.js";
import { validate } from "./commands/validate.js";
import { consoleIO, type Context, type IO } from "./io.js";

export interface RunOptions {
  cwd?: string;
  io?: IO;
  /** Injectable mDNS advertiser factory (tests mock this). */
  mdns?: MdnsFactory;
}

const HELP = `homespace — a kit for composing self-hosted homespaces

Usage: homespace <command> [options]

Commands:
  init <archetype> [dir]                     Scaffold a new homespace from an archetype
  new pack <type> <id>                       Add a content pack
  validate [--verify]                        Validate the homespace manifest and all packs
  build [--out DIR] [--verify] [--stamp] [--base-url URL]   Build to dist/
  dev [--port N] [--host H] [--coi] [--hosts-hint]         Serve dist/ with live rebuild
  serve [--port N] [--host H]                              Tier-2 daemon (needs homespace-serve)
`;

/** Route a CLI invocation to a command. Returns a process exit code. */
export async function run(argv: string[], options: RunOptions = {}): Promise<number> {
  const ctx: Context = { cwd: options.cwd ?? process.cwd(), io: options.io ?? consoleIO };
  const [command, ...rest] = argv;

  switch (command) {
    case undefined:
    case "-h":
    case "--help":
      ctx.io.out(HELP);
      return command === undefined ? 1 : 0;
    case "init":
      return init(rest, ctx);
    case "new":
      return newCommand(rest, ctx);
    case "validate":
      return validate(rest, ctx);
    case "build":
      return build(rest, ctx);
    case "dev":
      return dev(rest, ctx, options.mdns);
    case "serve":
      return serve(rest, ctx);
    default:
      ctx.io.err(`unknown command '${command}'. Try: init, new, validate, build, dev\n`);
      return 1;
  }
}
