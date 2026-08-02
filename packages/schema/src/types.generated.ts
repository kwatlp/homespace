/**
 * AUTO-GENERATED — do not edit by hand.
 * Source: packages/schema/schemas/*.json
 * Regenerate with: npm run codegen  (in @homespace/schema)
 */

/**
 * Contract #1 — a publishable pack: a directory plus this manifest.json. See TDD §3.
 */
export type PackManifest = {
  [k: string]: unknown;
} & {
  /**
   * Slug; also the pack folder name under content/packs/.
   */
  id: string;
  type: "game" | "app" | "art" | "post" | "link" | "bundle";
  title: string;
  /**
   * One short sentence.
   */
  summary?: string;
  version?: string;
  entrypoint?: PackEntrypoint;
  media?: PackMedia;
  checksums?: Checksums;
  tags?: string[];
  license?: string;
  /**
   * ISO-8601 timestamp.
   */
  created?: string;
  /**
   * ISO-8601 timestamp.
   */
  updated?: string;
  discussion_url?: string;
  /**
   * Player isolation level for embedded web builds. See TDD §6.4.
   */
  sandbox?: "standard" | "strict";
  /**
   * Freeform escape hatch, passed through to templates untouched.
   */
  extra?: {
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

/**
 * Only the keys relevant to the pack type are required.
 */
export interface PackEntrypoint {
  /**
   * Relative path to an HTML entry (game/app).
   */
  web?: string;
  /**
   * Relative path to a downloadable file.
   */
  download?: string;
  /**
   * Relative path to a markdown file.
   */
  post?: string;
  /**
   * Outbound URL.
   */
  link?: string;
}
export interface PackMedia {
  cover?: string;
  gallery?: string[];
  /**
   * Map of media path → alt text (accessibility; TDD §5.3).
   */
  alt?: {
    [k: string]: string;
  };
}
/**
 * Map of relative file path → 'sha256:<64 hex>'.
 */
export interface Checksums {
  [k: string]: string;
}

/**
 * One ordered composition block. type selects the renderer module (v0 registry).
 */
export type Section = {
  [k: string]: unknown;
} & {
  type: "hero" | "links" | "packs" | "posts" | "gallery" | "embed" | "html";
  title?: string;
  heading?: string;
  sub?: string;
  media?: string;
  style?: string;
  rss?: boolean;
  src?: string;
  height?: number;
  file?: string;
  source?: Source;
  [k: string]: unknown;
};

/**
 * Contract #2 — the composition layer for a homespace. See TDD §4.
 */
export interface HomespaceManifest {
  $schema?: string;
  /**
   * Machine slug.
   */
  name: string;
  /**
   * Display name.
   */
  title?: string;
  tagline?: string;
  lang?: string;
  local?: LocalAddress;
  layout?: "scroll" | "pages" | "grid";
  theme?: Theme;
  nav?: NavLink[];
  markdown?: {
    /**
     * Homespace-level opt-in for raw HTML in post markdown (TDD §6.3).
     */
    allowHtml?: boolean;
  };
  sections?: Section[];
  footer?: Footer;
  [k: string]: unknown;
}
/**
 * Local dev/serve address (TDD §7.1).
 */
export interface LocalAddress {
  host?: string;
  port?: number;
  mdns?: boolean;
}
export interface Theme {
  tokens?: ThemeTokens;
  /**
   * Optional custom stylesheet, loaded last.
   */
  css?: string;
}
/**
 * Designer-facing variables; additional tokens are allowed.
 */
export interface ThemeTokens {
  color?: {
    bg?: string;
    surface?: string;
    text?: string;
    accent?: string;
    [k: string]: string;
  };
  font?: {
    body?: string;
    display?: string;
    scale?: number;
    [k: string]: unknown;
  };
  space?: {
    unit?: number;
    [k: string]: unknown;
  };
  radius?: number;
  maxWidth?: number;
  [k: string]: unknown;
}
export interface NavLink {
  label: string;
  href: string;
}
/**
 * Filter resolved against catalog.json (TDD §4).
 */
export interface Source {
  types?: ("game" | "app" | "art" | "post" | "link" | "bundle")[];
  tags?: string[];
  ids?: string[];
  sort?: "created" | "updated" | "title";
  limit?: number;
}
export interface Footer {
  text?: string;
  links?: NavLink[];
}

/**
 * Deterministic scanner output: content/ → catalog.json. Consumed by the renderer. See TDD §2, §6. Refined in WO-2.
 */
export interface Catalog {
  /**
   * Catalog format version.
   */
  version: 1;
  /**
   * Optional build stamp (ISO-8601); omitted unless the build ran with --stamp (determinism).
   */
  generated?: string;
  packs: CatalogPack[];
}
/**
 * A validated pack manifest plus scanner-derived fields.
 */
export interface CatalogPack {
  id: string;
  type: "game" | "app" | "art" | "post" | "link" | "bundle";
  title: string;
  summary?: string;
  version?: string;
  /**
   * URL-safe identifier for detail-page routing (derived from id).
   */
  slug: string;
  /**
   * Pack folder path relative to the homespace root, e.g. content/packs/<id>.
   */
  dir: string;
  entrypoint?: {
    web?: string;
    download?: string;
    post?: string;
    link?: string;
    [k: string]: unknown;
  };
  media?: {
    cover?: string;
    gallery?: string[];
    alt?: {
      [k: string]: string;
    };
    [k: string]: unknown;
  };
  checksums?: {
    [k: string]: string;
  };
  tags?: string[];
  license?: string;
  created?: string;
  updated?: string;
  discussion_url?: string;
  sandbox?: "standard" | "strict";
  extra?: {
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
