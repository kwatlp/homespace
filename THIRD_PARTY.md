# Third-party notices

homespace is MIT-licensed and depends only on OSI-approved packages, per the
dependency budget in [`internal-docs/HomespaceTDD.md`](internal-docs/HomespaceTDD.md)
§5.4. Adding a dependency means amending that budget **and** this file in the
same PR.

## Runtime dependencies (installed)

| Package | Used by | Purpose | License |
|---|---|---|---|
| `ajv` | `homespace-schema` | JSON Schema validation | MIT |
| `micromark` | `homespace-renderer` | post markdown (raw HTML off by default) | MIT |
| `micromark-extension-gfm` | `homespace-renderer` | GitHub-flavored markdown | MIT |
| `chokidar` | `homespace-cli`, `homespace-serve` | dev/serve file watching | MIT |
| `bonjour-service` | `homespace-cli` | *optional* mDNS advertising for `local.host` | MIT |

## Optional runtime dependency (not bundled)

| Package | Used by | Purpose | License |
|---|---|---|---|
| `sharp` | `homespace-renderer` | thumbnail downscaling — the build degrades gracefully to full-size images when it isn't installed | Apache-2.0 |

## Dev-time dependencies

| Package | Purpose | License |
|---|---|---|
| `typescript` | type-checking / build | Apache-2.0 |
| `vitest` | test runner | MIT |
| `json-schema-to-typescript` | generate `types.generated.ts` from the JSON Schemas | MIT |
| `esbuild` | bundle the CLI and the Builder's browser page (§5.4 clarification, WO-21) | MIT |

Nothing above ships to a visitor. The Builder's page bundles only homespace's
own packages plus `ajv` and `micromark`, which are already runtime
dependencies — it adds no new ones.
| `@types/node` | Node type definitions | MIT |

No postinstall scripts. Lockfile committed. Vendored assets (e.g. archetype
fonts a creator adds under `theme/fonts/`) carry their own license files
alongside the asset.
