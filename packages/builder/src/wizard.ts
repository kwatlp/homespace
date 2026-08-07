import type { HomespaceManifest, Section } from "homespace-schema";

import type { MemoryTree } from "./memory-files.js";
import {
  placeholderArt,
  placeholderBanner,
  placeholderIcon,
  placeholderWebBuild,
  type PlaceholderColors,
} from "./placeholders.js";

/** The kinds of space step 2 offers. Driven by what the renderer can compose. */
export type SpaceType = "art" | "writing" | "games" | "apps" | "links";

/** The pack kinds that hold a plugged-in web build, each with its own slot. */
export type BuildKind = "game" | "app";

export const BUILD_KINDS: BuildKind[] = ["game", "app"];

/** A file the person plugged in, already read into memory. */
export interface WizardAsset {
  /** File name as it will sit in the homespace folder. */
  name: string;
  bytes: Uint8Array;
  /** Description for screen readers; blank or absent falls back to a caption. */
  alt?: string;
}

export interface WizardLink {
  label: string;
  url: string;
  note?: string;
}

export interface WizardTheme {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  /** Corner roundness, in pixels. */
  radius: number;
  /** Page width, in pixels. */
  maxWidth: number;
  /** Text size multiplier. */
  fontScale: number;
}

export interface WizardState {
  // Step 1 — name of space
  title: string;
  tagline: string;
  lang: string;
  /** Derived from the title, shown and editable, never required. */
  slug: string;
  // Step 2 — types of spaces
  spaces: SpaceType[];
  // Step 3 — rest of setup
  layout: "scroll" | "pages" | "grid";
  theme: WizardTheme;
  footer: string;
  // Plugged-in assets; anything omitted falls back to a neutral placeholder.
  icon?: WizardAsset;
  banner?: WizardAsset;
  gallery: WizardAsset[];
  post?: { title: string; body: string };
  /**
   * One plugged-in build per kind — a game and an app are different things and
   * land in different packs. Flat file lists only: the page picker hands over
   * files without their folder structure, so a foldered export goes in through
   * the master copy instead (§15.3).
   */
  build: Record<BuildKind, WizardAsset[]>;
  links: WizardLink[];
  /**
   * Creation timestamp for the starter packs, as an ISO string. Passed in
   * rather than read from the clock so a build stays reproducible (TDD §5.2).
   */
  created: string;
}

/** Turn a title into a URL-safe slug. */
export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // drop combining accents left by NFKD
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? "my-homespace" : slug;
}

/** A blank wizard: sensible defaults, nothing chosen yet. */
export function defaultWizardState(created: string): WizardState {
  return {
    title: "My Homespace",
    tagline: "",
    lang: "en",
    slug: "my-homespace",
    spaces: [],
    layout: "scroll",
    theme: {
      bg: "#14100c",
      surface: "#1f1813",
      text: "#f3e9dd",
      muted: "#b9a893",
      accent: "#d97b4a",
      radius: 10,
      maxWidth: 760,
      fontScale: 1,
    },
    footer: "",
    gallery: [],
    build: { game: [], app: [] },
    links: [],
    created,
  };
}

const SPACE_ORDER: SpaceType[] = ["art", "writing", "games", "apps", "links"];

/** Step 2's choices, in the order they are offered and composed. */
export const SPACE_LABELS: Record<SpaceType, string> = {
  art: "Art gallery",
  writing: "Writing",
  games: "Games",
  apps: "Apps & toys",
  links: "Links",
};

function colorsOf(state: WizardState): PlaceholderColors {
  return {
    bg: state.theme.bg,
    surface: state.theme.surface,
    muted: state.theme.muted,
    accent: state.theme.accent,
  };
}

/** File extension of an uploaded name, lowercased, or a fallback. */
function extensionOf(name: string, fallback: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? `.${match[1]!.toLowerCase()}` : fallback;
}

interface PackFile {
  path: string;
  contents: Uint8Array | string;
}

interface StarterPack {
  manifest: Record<string, unknown>;
  files: PackFile[];
}

function artPack(state: WizardState): StarterPack {
  const colors = colorsOf(state);
  const chosen = state.gallery;
  const files: PackFile[] = [];
  const gallery: string[] = [];
  const alt: Record<string, string> = {};

  if (chosen.length > 0) {
    chosen.forEach((asset, index) => {
      const name = `image-${index + 1}${extensionOf(asset.name, ".png")}`;
      files.push({ path: name, contents: asset.bytes });
      gallery.push(name);
      // A described picture keeps its description; a blank field keeps the
      // numbered fallback, so nothing ever ships with an empty alt (§5.3).
      const described = asset.alt?.trim() ?? "";
      alt[name] = described === "" ? `Picture ${index + 1}` : described;
    });
  } else {
    for (let index = 0; index < 3; index++) {
      const name = `image-${index + 1}.svg`;
      files.push({ path: name, contents: placeholderArt(colors, index) });
      gallery.push(name);
      alt[name] = "A placeholder shape — replace this file with your own picture.";
    }
  }

  const [cover, ...rest] = gallery;
  return {
    manifest: {
      id: "gallery",
      type: "art",
      title: "Gallery",
      summary: "Pictures.",
      created: state.created,
      media: { cover, gallery: rest, alt },
    },
    files,
  };
}

function writingPack(state: WizardState): StarterPack {
  const post = state.post;
  const title = post?.title?.trim() ? post.title.trim() : "Hello";
  const body = post?.body?.trim()
    ? post.body.trim()
    : [
        "This is your first post.",
        "",
        "To write another one, copy this folder, rename it, and change the",
        "title in its `manifest.json`. Everything in it is a plain text file.",
      ].join("\n");

  return {
    manifest: {
      id: "first-post",
      type: "post",
      title,
      summary: "The first thing here.",
      created: state.created,
      entrypoint: { post: "index.md" },
    },
    files: [{ path: "index.md", contents: `# ${title}\n\n${body}\n` }],
  };
}

function projectPack(state: WizardState, kind: BuildKind): StarterPack {
  const id = kind === "game" ? "first-game" : "first-app";
  const title = kind === "game" ? "My Game" : "My Toy";
  const files: PackFile[] = [];

  const plugged = state.build[kind];
  if (plugged.length > 0) {
    for (const asset of plugged) files.push({ path: asset.name, contents: asset.bytes });
  } else {
    files.push({ path: "index.html", contents: placeholderWebBuild(title, colorsOf(state)) });
  }

  return {
    manifest: {
      id,
      type: kind,
      title,
      summary: kind === "game" ? "Press play." : "A small thing to poke at.",
      created: state.created,
      entrypoint: { web: "index.html" },
    },
    files,
  };
}

function linkPacks(state: WizardState): StarterPack[] {
  const links = state.links.length > 0
    ? state.links
    : [{ label: "Somewhere else", url: "https://example.com", note: "Change this to a place you like." }];

  return links.map((link, index) => ({
    manifest: {
      id: `link-${index + 1}`,
      type: "link",
      title: link.label.trim() === "" ? `Link ${index + 1}` : link.label.trim(),
      ...(link.note ? { summary: link.note } : {}),
      created: state.created,
      entrypoint: { link: link.url },
    },
    files: [],
  }));
}

function starterPacks(state: WizardState): StarterPack[] {
  const packs: StarterPack[] = [];
  for (const space of SPACE_ORDER) {
    if (!state.spaces.includes(space)) continue;
    if (space === "art") packs.push(artPack(state));
    if (space === "writing") packs.push(writingPack(state));
    if (space === "games") packs.push(projectPack(state, "game"));
    if (space === "apps") packs.push(projectPack(state, "app"));
    if (space === "links") packs.push(...linkPacks(state));
  }
  return packs;
}

function sectionsFor(state: WizardState, bannerPath: string | undefined): Section[] {
  const hero: Section = {
    type: "hero",
    heading: state.title,
    ...(state.tagline ? { sub: state.tagline } : {}),
    ...(bannerPath ? { media: bannerPath } : {}),
  } as Section;

  const sections: Section[] = [hero];
  const projectTypes: string[] = [];
  if (state.spaces.includes("games")) projectTypes.push("game");
  if (state.spaces.includes("apps")) projectTypes.push("app");

  for (const space of SPACE_ORDER) {
    if (!state.spaces.includes(space)) continue;
    if (space === "art") {
      sections.push({ type: "gallery", title: "Art", source: { types: ["art"] } } as Section);
    }
    if (space === "writing") {
      sections.push({ type: "posts", title: "Writing", source: { types: ["post"] }, rss: true } as Section);
    }
    if (space === "games" && projectTypes.length > 0) {
      // Games and apps share one section when both are chosen.
      sections.push({ type: "packs", title: projectTitle(projectTypes), source: { types: projectTypes }, style: "cards" } as Section);
    }
    if (space === "apps" && !state.spaces.includes("games")) {
      sections.push({ type: "packs", title: "Apps & toys", source: { types: ["app"] }, style: "cards" } as Section);
    }
    if (space === "links") {
      sections.push({ type: "links", title: "Elsewhere", source: { types: ["link"] } } as Section);
    }
  }
  return sections;
}

function projectTitle(types: string[]): string {
  if (types.length === 2) return "Games & toys";
  return types[0] === "app" ? "Apps & toys" : "Games";
}

/** Anchor ids the renderer gives each section type, for scroll-layout nav. */
const SECTION_ANCHORS: Record<string, string> = {
  gallery: "Art",
  posts: "Writing",
  packs: "Play",
  links: "Elsewhere",
};

export interface ComposedHomespace {
  homespace: HomespaceManifest;
  /** Source files (content/, static/) — not the manifest, see `masterCopy`. */
  tree: MemoryTree;
}

/**
 * Turn wizard answers into a homespace: a manifest plus the source files that
 * make every chosen space render non-empty from the very first build
 * (TDD §15.3). Pure and deterministic — the same answers always compose the
 * same homespace.
 */
export function composeHomespace(state: WizardState): ComposedHomespace {
  const tree: MemoryTree = {};
  const colors = colorsOf(state);

  // static/ — the browser-tab icon and the hero banner. Both keep the format
  // they arrived in: a PNG named .ico is a PNG that browsers may refuse to
  // show, so the manifest names the real file and the renderer links its real
  // type (TDD §4, `icon`).
  const icon = state.icon;
  const iconName = icon ? `icon${extensionOf(icon.name, ".png")}` : "icon.svg";
  tree[`static/${iconName}`] = icon ? icon.bytes : placeholderIcon(colors);

  const banner = state.banner;
  const bannerName = banner ? `banner${extensionOf(banner.name, ".png")}` : "banner.svg";
  tree[`static/${bannerName}`] = banner ? banner.bytes : placeholderBanner(colors);

  for (const pack of starterPacks(state)) {
    const id = String(pack.manifest["id"]);
    tree[`content/packs/${id}/manifest.json`] = `${JSON.stringify(pack.manifest, null, 2)}\n`;
    for (const file of pack.files) tree[`content/packs/${id}/${file.path}`] = file.contents;
  }

  const sections = sectionsFor(state, `static/${bannerName}`);
  const nav = state.layout === "scroll"
    ? sections
        .filter((s) => s.type !== "hero" && SECTION_ANCHORS[s.type] !== undefined)
        .map((s) => ({ label: SECTION_ANCHORS[s.type]!, href: `#${s.type}` }))
    : [];

  const homespace: HomespaceManifest = {
    name: state.slug,
    title: state.title,
    ...(state.tagline ? { tagline: state.tagline } : {}),
    lang: state.lang,
    icon: `static/${iconName}`,
    layout: state.layout,
    theme: {
      tokens: {
        color: {
          bg: state.theme.bg,
          surface: state.theme.surface,
          text: state.theme.text,
          muted: state.theme.muted,
          accent: state.theme.accent,
        },
        // System font stacks only at v1 — no font files to ship, nothing to load.
        font: { scale: state.theme.fontScale },
        space: { unit: 8 },
        radius: state.theme.radius,
        maxWidth: state.theme.maxWidth,
      },
    },
    ...(nav.length > 0 ? { nav } : {}),
    sections,
    footer: { text: state.footer === "" ? `© ${state.title}` : state.footer, links: [] },
  } as HomespaceManifest;

  return { homespace, tree };
}

const MANIFEST_HEADER = [
  "// This file composes your homespace: what it is called, how it is laid out,",
  "// and what it is made of. It is plain text — change it, run the build again,",
  "// and the site changes. Lines starting with // are notes, not settings.",
  "",
].join("\n");

/**
 * The master copy: everything a person needs to rebuild the site later, in the
 * shape `homespace build` expects. Keep this folder; the website is made from it.
 */
export function masterCopy(state: WizardState): MemoryTree {
  const { homespace, tree } = composeHomespace(state);
  return {
    ...tree,
    "homespace.manifest.jsonc": `${MANIFEST_HEADER}${JSON.stringify(homespace, null, 2)}\n`,
    "START-HERE.md": startHere(state),
  };
}

/** The plain-language guide that travels with the master copy (TDD §15.3). */
export function startHere(state: WizardState): string {
  const has = (space: SpaceType): boolean => state.spaces.includes(space);
  const lines: string[] = [
    `# ${state.title}`,
    "",
    "This folder is your website's master copy. Keep it somewhere safe.",
    "The website itself was built from these files — if you ever want to change",
    "something, change it here and build again.",
    "",
    "## What is in here",
    "",
    "- `homespace.manifest.jsonc` — the name, colours, and running order of your site.",
    "- `content/packs/` — one folder per thing you have made.",
    "- `static/` — files copied to your site exactly as they are, like the tab icon.",
    "",
    "## Adding things",
    "",
  ];

  if (has("art")) {
    lines.push(
      "**To add a picture:** put the image file in `content/packs/gallery/`, then open",
      "`content/packs/gallery/manifest.json` and add its file name to the `gallery` list.",
      "",
      "**To describe a picture:** in that same `manifest.json` there is an `alt` list —",
      "one line per picture, matching its file name. What you write there is read aloud",
      "to people using a screen reader, and shows in place of the picture if it does not",
      "load. Say what is in it, plainly: `\"image-1.png\": \"Two herons on a wet log\"`.",
      "You can change these any time; they are just text.",
      "",
    );
  }
  if (has("writing")) {
    lines.push(
      "**To write another post:** copy the `content/packs/first-post` folder, give the copy",
      "a new name, and open the `index.md` inside it. The first line starting with `#` is",
      "the title. Change the `id` and `title` in that folder's `manifest.json` to match.",
      "",
    );
  }
  if (has("games") || has("apps")) {
    lines.push(
      "**To put your own build in:** replace the files in `content/packs/first-game/`",
      "(or `first-app/`) with your exported build. It needs an `index.html` at the top.",
      "",
      "This is also where a build with **folders inside it** goes — a Unity or Godot",
      "export with its own `Build/` and `TemplateData/` folders, say. The Builder page",
      "could only take loose files, but here you can copy the whole exported folder in,",
      "folders and all, and it will work.",
      "",
    );
  }
  if (has("links")) {
    lines.push(
      "**To add a link:** copy a `content/packs/link-1` folder, change its `id`, `title`,",
      "and the web address in `entrypoint.link`.",
      "",
    );
  }

  lines.push(
    "## Building it again",
    "",
    "You need [Node](https://nodejs.org) installed. Then, in this folder:",
    "",
    "```",
    "npx homespace build",
    "```",
    "",
    "That makes a `dist` folder. That folder *is* your website — upload it the same way",
    "you uploaded it the first time.",
    "",
    "Nothing here phones home, and nothing about your site lives on anyone else's",
    "computer unless you put it there.",
    "",
  );

  return lines.join("\n");
}
