# Third-party notices

kwatlp is MIT-licensed and depends only on OSI-approved packages. This file
records the runtime and dev dependencies bundled with or required by the
project, per the dependency budget in
[`internal-docs/KwatlpTDD.md`](internal-docs/KwatlpTDD.md) §5.4. Adding a
dependency means amending that budget **and** listing it here in the same PR.

## Runtime dependencies (budgeted — TDD §5.4)

| Package | Purpose | License |
|---|---|---|
| `ajv` | schema validation | MIT |
| `micromark` (+ gfm ext) | markdown for posts; raw HTML off by default | MIT |
| `sharp` | *optional* thumbnails; build degrades gracefully without it | Apache-2.0 |
| `chokidar` | dev/serve watch | MIT |
| `bonjour-service` | *optional* mDNS advertising for `local.host` | MIT |

## Dev-time dependencies

| Package | Purpose | License |
|---|---|---|
| `esbuild` | CLI bundling | MIT |
| `vitest` | test runner | MIT |
| `typescript` | type-checking / build | Apache-2.0 |

> Not all budgeted dependencies are installed yet — packages are added as their
> work order (TDD §11) lands. This table is the ceiling, not the current
> lockfile. Vendored assets (e.g. OFL-licensed archetype fonts) carry their own
> license files alongside the asset.
