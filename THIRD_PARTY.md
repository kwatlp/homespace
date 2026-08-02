# Third-party notices

kwatlp is MIT-licensed and depends only on OSI-approved packages, per the
dependency budget in [`internal-docs/KwatlpTDD.md`](internal-docs/KwatlpTDD.md)
§5.4. Adding a dependency means amending that budget **and** this file in the
same PR.

## Runtime dependencies (installed)

| Package | Used by | Purpose | License |
|---|---|---|---|
| `ajv` | `@kwatlp/schema` | JSON Schema validation | MIT |
| `micromark` | `@kwatlp/renderer` | post markdown (raw HTML off by default) | MIT |
| `micromark-extension-gfm` | `@kwatlp/renderer` | GitHub-flavored markdown | MIT |
| `chokidar` | `@kwatlp/cli`, `@kwatlp/serve` | dev/serve file watching | MIT |
| `bonjour-service` | `@kwatlp/cli` | *optional* mDNS advertising for `local.host` | MIT |

## Optional runtime dependency (not bundled)

| Package | Used by | Purpose | License |
|---|---|---|---|
| `sharp` | `@kwatlp/renderer` | thumbnail downscaling — the build degrades gracefully to full-size images when it isn't installed | Apache-2.0 |

## Dev-time dependencies

| Package | Purpose | License |
|---|---|---|
| `typescript` | type-checking / build | Apache-2.0 |
| `vitest` | test runner | MIT |
| `json-schema-to-typescript` | generate `types.generated.ts` from the JSON Schemas | MIT |
| `@types/node` | Node type definitions | MIT |

No postinstall scripts. Lockfile committed. Vendored assets (e.g. archetype
fonts a creator adds under `theme/fonts/`) carry their own license files
alongside the asset.
