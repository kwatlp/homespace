# Contributing to homespace

Thanks for building with us. This project has a **locked, detailed design** and a
**strict build order** — reading a little before you code saves everyone time.

## Read first

1. [`internal-docs/HomespaceTDD.md`](internal-docs/HomespaceTDD.md) — the Technical
   Design Document. It is the source of truth. In particular:
   - **§3 / §4** — the two contracts (pack manifest, homespace manifest). Binding.
   - **§5.4** — the runtime dependency budget. Binding.
   - **§11** — the work-order sequence (WO-0 … WO-10).
   - **Appendix A** — coding conventions.
2. [`CLAUDE.md`](CLAUDE.md) — how the two agents (Claude Code / Cowork) divide
   work, and the code-request workflow.

## Ground rules

- **Build in work-order sequence.** Don't start WO-N+1 until WO-N's exit
  criteria (its tests) pass. Each WO lands with tests in the same PR.
- **Contracts are source of truth.** If implementation pressure suggests
  changing a contract, amend the TDD **first**, then code — in the same PR.
- **No ad-hoc additions.** New runtime dependencies, section types, or manifest
  fields all require a TDD amendment (§5.4 for deps) in the same PR. No
  postinstall scripts; the lockfile is committed.
- **Output constraints are hard.** Build output is static HTML + CSS + minimal
  vanilla JS. **No framework, no bundle, and no external resource request** in
  `dist/`. Core browsing/reading must work with JavaScript disabled. Builds are
  deterministic (stable ordering, no wall-clock in output except behind
  `--stamp`).
- **Module boundaries.** `scanner` never renders; `renderer` never walks the
  filesystem outside its declared inputs/outputs; `serve` imports the others and
  never the reverse. TypeScript strict, named exports only, small modules over
  clever ones.
- **Error voice.** Path + problem + fix, in language a designer (not a sysadmin)
  can act on.

## Local development

```bash
npm install
npm test           # vitest across all workspace packages
npm run typecheck  # tsc --build (strict)
```

From WO-3 onward the **offline-budget test** (TDD §10.2) is a permanent CI gate:
it crawls `dist/` and fails the build if any external URL appears as a resource
load (script / stylesheet / img / font / iframe src). External `<a href>`
navigation is fine — that's the network.

## Proposing code changes without running code (Cowork)

If you're working through the Cowork bridge (research/planning/docs only), don't
edit code or run git. Instead, copy
[`internal-docs/CODE_REQUEST_TEMPLATE.md`](internal-docs/CODE_REQUEST_TEMPLATE.md),
fill it in, and save it under
`internal-docs/requests/<milestone>/<NNN-slug>.md`. Keep requests
outcome-oriented (what should be true + how to verify), not line-by-line edits.
See [`internal-docs/requests/README.md`](internal-docs/requests/README.md) for
the layout, numbering, and lifecycle.

## Licensing

By contributing you agree your contributions are licensed under the project's
[MIT License](LICENSE). Only add dependencies with OSI-approved licenses, and
record third-party notices in [THIRD_PARTY.md](THIRD_PARTY.md).
