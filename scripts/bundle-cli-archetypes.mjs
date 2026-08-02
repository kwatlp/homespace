// Copy the repo archetypes into the CLI package so a published @kwatlp/cli can
// `init` them off-monorepo. Source of truth stays /archetypes; the copies under
// packages/cli/templates/ are gitignored and regenerated at pack time.
import { cp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ARCHETYPES = ["link-hub", "author", "illustrator", "game-designer"];
const repo = new URL("../", import.meta.url);

for (const name of ARCHETYPES) {
  const from = fileURLToPath(new URL(`archetypes/${name}`, repo));
  const to = fileURLToPath(new URL(`packages/cli/templates/${name}`, repo));
  await rm(to, { recursive: true, force: true });
  await cp(from, to, { recursive: true });
  console.log(`bundled archetype ${name} → packages/cli/templates/${name}`);
}
