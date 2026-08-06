import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { run } from "homespace-cli";
import { findBudgetViolations } from "homespace-renderer";
import { readZip } from "homespace-serve";
import { afterEach, describe, expect, test } from "vitest";

import { buildInMemory } from "./build";
import { masterZip, websiteZip } from "./download";
import { previewDocument } from "./preview";
import type { MemoryTree } from "./memory-files";
import {
  composeHomespace,
  defaultWizardState,
  masterCopy,
  slugify,
  startHere,
  type SpaceType,
  type WizardState,
} from "./wizard";

const CREATED = "2026-08-06T00:00:00Z";
const ALL_SPACES: SpaceType[] = ["art", "writing", "games", "apps", "links"];
const quiet = { out: () => {}, err: () => {} };
const decoder = new TextDecoder();

/** Tree entries are strings or bytes; read either as text. */
const text = (value: Uint8Array | string | undefined): string =>
  typeof value === "string" ? value : decoder.decode(value);

const temps: string[] = [];
afterEach(async () => {
  while (temps.length) await rm(temps.pop()!, { recursive: true, force: true });
});

async function tmp(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "homespace-wizard-"));
  temps.push(dir);
  return dir;
}

/** Write an in-memory homespace to disk, the way the download would unzip. */
async function materialize(tree: MemoryTree, root: string): Promise<void> {
  for (const [rel, contents] of Object.entries(tree)) {
    const dest = path.join(root, rel);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, typeof contents === "string" ? contents : Buffer.from(contents));
  }
}

async function listTree(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(rel: string): Promise<void> {
    for (const entry of await readdir(path.join(dir, rel), { withFileTypes: true })) {
      const child = rel === "" ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) await walk(child);
      else if (entry.isFile()) out.push(child);
    }
  }
  await walk("");
  return out.sort();
}

function state(overrides: Partial<WizardState> = {}): WizardState {
  return {
    ...defaultWizardState(CREATED),
    title: "Cedar Grove",
    tagline: "cedar, roots, worlds",
    slug: "cedar-grove",
    spaces: ALL_SPACES,
    footer: "© Cedar Grove",
    ...overrides,
  };
}

describe("wizard composition (WO-22)", () => {
  test("slugs are derived, safe, and never empty", () => {
    expect(slugify("Cedar Grove")).toBe("cedar-grove");
    expect(slugify("  Café & Co.  ")).toBe("cafe-co");
    // Letters outside a-z are folded where they decompose and dropped where
    // they do not — a slug is a URL, not a name.
    expect(slugify("kʷátɬp")).toBe("kwat-p");
    expect(slugify("!!!")).toBe("my-homespace");
  });

  test("every chosen space contributes a section, a nav entry, and a starter pack", () => {
    const { homespace, tree } = composeHomespace(state());
    expect(homespace.sections?.map((s) => s.type)).toEqual([
      "hero",
      "gallery",
      "posts",
      "packs",
      "links",
    ]);
    expect(homespace.nav?.map((n) => n.href)).toEqual(["#gallery", "#posts", "#packs", "#links"]);

    const packs = Object.keys(tree).filter((p) => p.endsWith("/manifest.json"));
    expect(packs).toEqual([
      "content/packs/gallery/manifest.json",
      "content/packs/first-post/manifest.json",
      "content/packs/first-game/manifest.json",
      "content/packs/first-app/manifest.json",
      "content/packs/link-1/manifest.json",
    ]);
  });

  test("choosing nothing still builds — the preview must work from the first paint", async () => {
    const { homespace, tree } = composeHomespace(state({ spaces: [] }));
    expect(homespace.sections?.map((s) => s.type)).toEqual(["hero"]);
    expect(homespace.nav).toBeUndefined();
    expect(Object.keys(tree).some((p) => p.startsWith("static/"))).toBe(true);

    const built = await buildInMemory({ homespace, tree });
    expect(built.errors).toEqual([]);
    expect(built.ok).toBe(true);
    expect(decoder.decode(built.files.find((f) => f.path === "index.html")!.bytes)).toContain(
      "Cedar Grove",
    );
  });

  test("skipped fields fall back to neutral placeholders, plugged-in files are used", () => {
    const placeholder = composeHomespace(state({ spaces: ["art"] }));
    expect(text(placeholder.tree["content/packs/gallery/manifest.json"])).toContain("image-1.svg");
    expect(text(placeholder.tree["static/banner.svg"])).toContain("<svg");
    // Nothing in a placeholder should look like branding.
    expect(text(placeholder.tree["content/packs/gallery/image-1.svg"])).not.toMatch(
      /homespace|kʷátɬp|logo/i,
    );

    const plugged = composeHomespace(
      state({
        spaces: ["art"],
        gallery: [{ name: "sunset.PNG", bytes: new Uint8Array([1, 2, 3]), alt: "A sunset" }],
        banner: { name: "wide.jpg", bytes: new Uint8Array([4, 5]) },
      }),
    );
    expect(plugged.tree["content/packs/gallery/image-1.png"]).toEqual(new Uint8Array([1, 2, 3]));
    expect(plugged.tree["static/banner.jpg"]).toEqual(new Uint8Array([4, 5]));
    expect(text(plugged.tree["content/packs/gallery/manifest.json"])).toContain("A sunset");
  });

  test("composition is deterministic", () => {
    expect(JSON.stringify(composeHomespace(state()))).toBe(JSON.stringify(composeHomespace(state())));
  });

  test("START-HERE.md speaks plainly and only about the spaces that exist", () => {
    const guide = startHere(state({ spaces: ["writing"] }));
    expect(guide).toContain("npx homespace build");
    expect(guide).toContain("To write another post");
    expect(guide).not.toContain("To add a picture");
    expect(guide).not.toMatch(/manifest schema|JSON Schema|scanner|renderer/i);
  });
});

describe("a wizard homespace builds, and its master copy rebuilds it (WO-22)", () => {
  test("browser build ≡ CLI build of the master copy, byte for byte", async () => {
    const answers = state();
    const { homespace, tree } = composeHomespace(answers);

    const inBrowser = await buildInMemory({ homespace, tree });
    expect(inBrowser.errors).toEqual([]);
    expect(inBrowser.ok).toBe(true);

    // Every chosen space actually rendered something.
    const index = decoder.decode(inBrowser.files.find((f) => f.path === "index.html")!.bytes);
    for (const id of ["hero", "gallery", "posts", "packs", "links"]) {
      expect(index, `index.html has no ${id} section`).toContain(`id="${id}"`);
    }
    expect(inBrowser.files.map((f) => f.path)).toContain("feed.xml");

    // The master copy is what the person keeps; it must rebuild the same site.
    const root = await tmp();
    await materialize(masterCopy(answers), root);
    expect(await run(["build"], { cwd: root, io: quiet })).toBe(0);

    const dist = path.join(root, "dist");
    expect(inBrowser.files.map((f) => f.path)).toEqual(await listTree(dist));
    for (const file of inBrowser.files) {
      const onDisk = await readFile(path.join(dist, file.path));
      expect(Buffer.from(file.bytes).equals(onDisk), `${file.path} differs from the CLI build`).toBe(true);
    }
  }, 120_000);

  test("the built site keeps the offline budget and stays readable without JS", async () => {
    const { homespace, tree } = composeHomespace(state());
    const built = await buildInMemory({ homespace, tree });

    const crawlable = built.files
      .filter((f) => /\.(html?|css)$/i.test(f.path))
      .map((f) => ({ path: f.path, contents: decoder.decode(f.bytes) }));
    expect(findBudgetViolations(crawlable)).toEqual([]);

    const index = crawlable.find((f) => f.path === "index.html")!.contents;
    expect(index).toContain("Cedar Grove");
    expect(index).not.toMatch(/<script\b[^>]*\bsrc=/i);
  });
});

describe("live preview (WO-22)", () => {
  test("inlines styles, points media at in-memory URLs, and keeps links inert", async () => {
    const { homespace, tree } = composeHomespace(state());
    const built = await buildInMemory({ homespace, tree });
    const doc = previewDocument(built.files, (p) => `memory:${p}`);

    // No resource in the preview may point at a path the frame would fetch.
    expect(doc).not.toMatch(/<link\b[^>]*stylesheet/i);
    expect(doc).toContain("<style>");
    expect(doc).toContain("--color-accent");
    // static/banner.svg lands at the dist root, and the preview points there.
    expect(doc).toContain('src="memory:banner.svg"');

    // A card link would navigate out of the preview; it is neutralized but
    // still says where it pointed.
    expect(doc).toContain('data-preview-link="posts/first-post/"');
    expect(doc).not.toMatch(/href="posts\/first-post\/"/);

    // External navigation is left exactly as the site has it.
    expect(doc).toContain('href="https://example.com"');
  });

  test("says so plainly when there is nothing to preview", () => {
    expect(previewDocument([], (p) => p)).toContain("Nothing to preview");
  });
});

describe("downloads (WO-22)", () => {
  test("the website zip is flat and holds the built site", async () => {
    const answers = state();
    const download = await websiteZip(answers);
    expect(download.ok).toBe(true);
    expect(download.filename).toBe("cedar-grove-website.zip");

    const names = readZip(Buffer.from(download.zip)).map((e) => e.name);
    expect(names).toContain("index.html");
    expect(names).toContain("feed.xml");
    expect(names.every((n) => !n.startsWith("cedar-grove/"))).toBe(true);
  });

  test("the master copy zip is one tidy folder with START-HERE.md", () => {
    const download = masterZip(state());
    expect(download.filename).toBe("cedar-grove-master-copy.zip");

    const entries = readZip(Buffer.from(download.zip));
    const names = entries.map((e) => e.name);
    expect(names).toContain("cedar-grove/START-HERE.md");
    expect(names).toContain("cedar-grove/homespace.manifest.jsonc");
    expect(names.every((n) => n.startsWith("cedar-grove/"))).toBe(true);

    const manifest = decoder.decode(entries.find((e) => e.name.endsWith("manifest.jsonc"))!.data);
    expect(manifest.startsWith("//")).toBe(true); // friendly notes for a human
    expect(manifest).toContain('"title": "Cedar Grove"');
  });

  test("packaging is deterministic", async () => {
    const first = await websiteZip(state());
    const second = await websiteZip(state());
    expect(Buffer.from(first.zip).equals(Buffer.from(second.zip))).toBe(true);
    expect(Buffer.from(masterZip(state()).zip).equals(Buffer.from(masterZip(state()).zip))).toBe(true);
  });
});
