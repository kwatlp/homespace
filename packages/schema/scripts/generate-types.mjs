// Regenerate src/types.generated.ts and src/schemas.generated.ts from the JSON
// Schemas. The schemas in ../schemas are the source of truth; run `npm run
// codegen` (from the package) after changing one. See TDD §5, WO-1, WO-21.
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

// Exported const name per schema file.
const CONST_NAMES = {
  "pack.schema.json": "packSchema",
  "homespace.schema.json": "homespaceSchema",
  "catalog.schema.json": "catalogSchema",
};

const parts = [];
const embedded = [];
for (const file of SCHEMAS) {
  const source = await readFile(here(`../schemas/${file}`), "utf8");
  const schema = JSON.parse(source);
  const ts = await compile(schema, schema.title, options);
  parts.push(ts.trim());

  // Embedding keeps the package importable where there is no filesystem —
  // the Builder's browser bundle (TDD §15.2, WO-21).
  embedded.push(
    `/** \`schemas/${file}\`, embedded. */\nexport const ${CONST_NAMES[file]}: Readonly<Record<string, unknown>> = ${JSON.stringify(schema, null, 2)};`,
  );
}

const out = `${banner}\n${parts.join("\n\n")}\n`;
await writeFile(here("../src/types.generated.ts"), out, "utf8");
await writeFile(here("../src/schemas.generated.ts"), `${banner}\n${embedded.join("\n\n")}\n`, "utf8");
console.log(`Wrote src/types.generated.ts and src/schemas.generated.ts from ${SCHEMAS.length} schemas.`);
