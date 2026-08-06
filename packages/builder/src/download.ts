import { writeZip, type ZipInput } from "homespace-zip";

import { buildInMemory, type Thumbnailer } from "./build.js";
import { composeHomespace, masterCopy, type WizardState } from "./wizard.js";

export interface DownloadResult {
  ok: boolean;
  /** The archive bytes; empty when the build failed. */
  zip: Uint8Array;
  /** Suggested file name for the download. */
  filename: string;
  errors: string[];
  warnings: string[];
}

/** Sort entries so the same answers always package to the same bytes (§5.2). */
function sorted(entries: ZipInput[]): ZipInput[] {
  return [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * **Your website** — the built site, flat at the root of the archive so a host
 * that unzips into the site root (the golden path, §15.5) puts `index.html`
 * where it belongs. Drag it online as-is.
 */
export async function websiteZip(state: WizardState, thumbnailer?: Thumbnailer): Promise<DownloadResult> {
  const { homespace, tree } = composeHomespace(state);
  const built = await buildInMemory({
    homespace,
    tree,
    ...(thumbnailer ? { thumbnailer } : {}),
  });

  const filename = `${state.slug}-website.zip`;
  if (!built.ok) {
    return { ok: false, zip: new Uint8Array(0), filename, errors: built.errors, warnings: built.warnings };
  }
  return {
    ok: true,
    zip: writeZip(sorted(built.files.map((file) => ({ name: file.path, data: file.bytes })))),
    filename,
    errors: [],
    warnings: built.warnings,
  };
}

/**
 * **Your master copy** — the source folder plus `START-HERE.md`, wrapped in one
 * directory so unzipping it anywhere stays tidy. `npx homespace build` in that
 * folder reproduces the website byte for byte.
 */
export function masterZip(state: WizardState): DownloadResult {
  const tree = masterCopy(state);
  const entries = Object.entries(tree).map(([path, contents]) => ({
    name: `${state.slug}/${path}`,
    data: contents,
  }));
  return {
    ok: true,
    zip: writeZip(sorted(entries)),
    filename: `${state.slug}-master-copy.zip`,
    errors: [],
    warnings: [],
  };
}
