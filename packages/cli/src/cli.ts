import { build } from "./commands/build.js";
import { dev, type MdnsFactory } from "./commands/dev.js";
import { init } from "./commands/init.js";
import { newCommand } from "./commands/new.js";
import { validate } from "./commands/validate.js";
import { consoleIO, type Context, type IO } from "./io.js";

export interface RunOptions {
  cwd?: string;
  io?: IO;
  /** Injectable mDNS advertiser factory (tests mock this). */
  mdns?: MdnsFactory;
}

const HELP = `kwatlp — a kit for composing self-hosted nodes

Usage: kwatlp <command> [options]

Commands:
  init <archetype> [dir]                     Scaffold a new node from an archetype
  new pack <type> <id>                       Add a content pack
  validate [--verify]                        Validate the node manifest and all packs
  build [--out DIR] [--verify] [--stamp] [--base-url URL]   Build to dist/
  dev [--port N] [--host H] [--coi] [--hosts-hint]         Serve dist/ with live rebuild
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
      ctx.io.err("kwatlp serve requires @kwatlp/serve (Tier 2) — arrives in WO-9\n");
      return 1;
    default:
      ctx.io.err(`unknown command '${command}'. Try: init, new, validate, build, dev\n`);
      return 1;
  }
}
