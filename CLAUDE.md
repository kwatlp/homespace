# CLAUDE.md

Orientation for AI agents working in this repo. Read this first.

## Who does what — READ FIRST

Two agents touch this repo, and they have **different jobs**:

- **Claude Code** (CLI, runs natively on the real filesystem) — owns **all code
  and git**. Editing source/config/build files, running git, running builds or
  tests: Claude Code only.
- **Cowork** (the desktop app, runs over a mounted bridge) — owns **research,
  planning, and documentation**. The bridge is not safe for code/git writes:
  concurrent or large writes can corrupt the git index and silently truncate
  files on the mount.

**Cowork MUST NOT:**

- run any git command that writes — `add`, `commit`, `mv`, `rm`, `checkout`,
  `restore`, `reset`, `stash`, `branch -f`, `merge`, `rebase`, `pull`, `push`;
- create, edit, or delete **code / config / build** files — anything under
  `packages/`, `archetypes/`, `examples/`, plus `package.json`,
  `package-lock.json`, `tsconfig*.json`, `vitest.config.ts`, `.gitignore`,
  `.gitattributes`, and any `*.ts / *.tsx / *.js / *.mjs / *.json / *.css /
  *.html`;
- run scripts that mutate the repo — installs, builds, tests, `kwatlp build`.

**Cowork MAY:** read anything; run **read-only** git (`status`, `log`, `diff`,
`show`, `ls-files`); research; and create/edit **documentation and request
specs** — Markdown under `internal-docs/`, `docs/` prose, `THEME.md` prose, and
`code-requests/`. After writing any file, Cowork re-reads it to confirm the
mount didn't truncate it.

**How code/git work actually happens:** when a change needs code or git, Cowork
fills out [`internal-docs/CODE_REQUEST_TEMPLATE.md`](internal-docs/CODE_REQUEST_TEMPLATE.md)
and saves it to `code-requests/<milestone>/<NNN-slug>.md` (see
[`code-requests/README.md`](code-requests/README.md)). The human then runs that
request with Claude Code, which does the actual work.

## What this is

**kwatlp** (working name) — a **kit for composing self-hosted "nodes"**: single,
operator-owned public websites that hold whatever their creator brings (games,
apps, art, writing, links-with-depth, raw HTML). TypeScript (strict), Node ≥ 20,
npm workspaces. Builds to **plain static files** with **zero external resource
requests** — no framework, no bundle, no CDN in the output. A **Kwatlp** studio
project, MIT-licensed, OSI-approved dependencies only.

The design is fixed and detailed. **The source of truth is the TDD:**
[`internal-docs/KwatlpTDD.md`](internal-docs/KwatlpTDD.md). Read it before
building. The two contracts (pack manifest §3, node manifest §4) and the
dependency budget (§5.4) are binding; changing one means amending the TDD
**first**, then coding.

## How to build (per the TDD)

- Build strictly in **work-order sequence** (TDD §11, WO-0 … WO-10). Each WO has
  explicit exit criteria; do not start WO-N+1 until WO-N's tests pass.
- Every WO lands with tests (vitest). The **offline-budget gate** (TDD §10.2) is
  a permanent CI gate from WO-3 onward: nothing in `dist/` may load an external
  resource.
- New runtime dependencies require an amendment to the dependency budget
  (TDD §5.4) in the same PR. Do not add packages, section types, or manifest
  fields ad hoc.
- Conventions for all sessions: TDD Appendix A. In short — TS strict, named
  exports only, small modules; `scanner` never renders, `renderer` never walks
  the filesystem outside its inputs/outputs, `serve` imports the others and
  never the reverse; deterministic output (stable sorts, no wall-clock except
  behind `--stamp`); error messages give path + problem + fix in
  designer-readable language.

## Repo map (high level)

- `packages/schema/` — JSON Schemas (pack, node, catalog) + generated TS types +
  `validate()`
- `packages/scanner/` — `content/` → `catalog.json` (pure; no rendering
  knowledge)
- `packages/renderer/` — `(catalog, node manifest)` → `dist/` (pure; no
  fs-walking knowledge)
- `packages/cli/` — `kwatlp init|new|validate|build|dev` (thin orchestration)
- `packages/serve/` — **Tier 2 only**, optional daemon; nothing else imports it
- `archetypes/` — presets: `link-hub`, `author`, `illustrator`, `game-designer`
- `examples/` — fixture nodes used by tests
- `docs/` — **public** docs; the docs site is itself a node (dogfooding, WO-10)
- `internal-docs/` — **private** planning: the TDD, milestones, plans, design;
  never published
- `code-requests/` — change requests from Cowork for Claude Code (internal)

## Common commands

```bash
npm install            # install workspace deps
npm test               # run all package test suites (vitest)
npm run typecheck      # tsc --build (strict) across the workspace
npx kwatlp build       # validate → scan → render → dist/ (once the CLI exists)
```

## Important caveat

Do **not** run git operations in this repo (IDE git integration, a git GUI,
commits) while an agent is actively working in it. Concurrent writes to
`.git/index` on a mounted drive can corrupt the index. One git writer at a time.
