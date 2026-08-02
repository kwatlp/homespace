// Regenerate src/types.generated.ts from the JSON Schemas.
// The schemas in ../schemas are the source of truth; run `npm run codegen`
// (from the package) after changing one. See TDD §5, WO-1.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { compile } from "json-schema-to-typescript";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

const SCHEMAS = ["pack.schema.json", "homespace.schema.json", "catalog.schema.json"];

const options = {
  bannerComment: "",
  additionalProperties: true,
  style: { singleQuote: false },
  declareExternallyReferenced: true,
  enableConstEnums: false,
};

const banner = [
  "/**",
  " * AUTO-GENERATED — do not edit by hand.",
  " * Source: packages/schema/schemas/*.json",
  " * Regenerate with: npm run codegen  (in homespace-schema)",
  " */",
  "",
].join("\n");

const parts = [];
for (const file of SCHEMAS) {
  const schema = JSON.parse(await readFile(here(`../schemas/${file}`), "utf8"));
  const ts = await compile(schema, schema.title, options);
  parts.push(ts.trim());
}

const out = `${banner}\n${parts.join("\n\n")}\n`;
await writeFile(here("../src/types.generated.ts"), out, "utf8");
console.log(`Wrote src/types.generated.ts from ${SCHEMAS.length} schemas.`);
