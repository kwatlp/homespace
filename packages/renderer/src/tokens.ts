import type { ThemeTokens } from "homespace-schema";

import { isExternalUrl } from "./url.js";

/** A self-hosted font file to copy into dist, keyed by the CSS family it backs. */
export interface FontAsset {
  family: string;
  /** Path relative to the homespace root (and to dist). */
  path: string;
}

export interface TokensCss {
  css: string;
  fontAssets: FontAsset[];
  errors: string[];
}

/**
 * Default token values. Dark palette with AA-contrast text on background
 * (TDD §5.3); every archetype may override any of these.
 */
export const DEFAULT_TOKENS = {
  color: {
    bg: "#14100c",
    surface: "#1f1813",
    text: "#f3e9dd",
    muted: "#b9a893",
    accent: "#d97b4a",
  },
  space: { unit: 8 },
  radius: 10,
  maxWidth: 760,
  fontScale: 1,
} as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Compile theme tokens into a `:root` block of CSS custom properties, plus
 * `@font-face` rules for self-hosted fonts. Font paths must be local — an
 * http(s) font path is a hard error (principle 1.1.5).
 */
export function renderTokensCss(tokens: ThemeTokens | undefined): TokensCss {
  const errors: string[] = [];
  const fontAssets: FontAsset[] = [];
  const vars: string[] = [];
  const faces: string[] = [];

  const color = isPlainObject(tokens?.color) ? tokens.color : {};
  const colors: Record<string, unknown> = { ...DEFAULT_TOKENS.color, ...color };
  for (const key of Object.keys(colors).sort()) {
    const value = colors[key];
    if (typeof value === "string") vars.push(`  --color-${key}: ${value};`);
  }

  const unit =
    isPlainObject(tokens?.space) && typeof tokens.space["unit"] === "number"
      ? (tokens.space["unit"] as number)
      : DEFAULT_TOKENS.space.unit;
  vars.push(`  --space-unit: ${unit}px;`);

  const radius = typeof tokens?.radius === "number" ? tokens.radius : DEFAULT_TOKENS.radius;
  vars.push(`  --radius: ${radius}px;`);

  const maxWidth = typeof tokens?.maxWidth === "number" ? tokens.maxWidth : DEFAULT_TOKENS.maxWidth;
  vars.push(`  --max-width: ${maxWidth}px;`);

  const font = isPlainObject(tokens?.font) ? tokens.font : {};
  const scale = typeof font["scale"] === "number" ? font["scale"] : DEFAULT_TOKENS.fontScale;
  vars.push(`  --font-scale: ${scale};`);

  for (const role of ["body", "display"] as const) {
    const path = font[role];
    if (typeof path === "string" && path.length > 0) {
      if (isExternalUrl(path)) {
        errors.push(
          `theme.tokens.font.${role} '${path}' is an external URL — fonts must be self-hosted; ship the file in theme/fonts/ and reference it by relative path`,
        );
        vars.push(`  --font-${role}: ${fallbackFamily(role)};`);
        continue;
      }
      const family = `homespace-${role}`;
      faces.push(fontFace(family, path));
      fontAssets.push({ family, path });
      vars.push(`  --font-${role}: "${family}", ${fallbackFamily(role)};`);
    } else {
      vars.push(`  --font-${role}: ${fallbackFamily(role)};`);
    }
  }

  const root = `:root {\n${vars.join("\n")}\n}\n`;
  const css = faces.length > 0 ? `${faces.join("\n")}\n\n${root}` : root;
  return { css, fontAssets, errors };
}

function fallbackFamily(role: "body" | "display"): string {
  return role === "display"
    ? "Georgia, 'Times New Roman', serif"
    : "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
}

function fontFormat(path: string): string {
  if (/\.woff2$/i.test(path)) return "woff2";
  if (/\.woff$/i.test(path)) return "woff";
  if (/\.ttf$/i.test(path)) return "truetype";
  if (/\.otf$/i.test(path)) return "opentype";
  return "woff2";
}

function fontFace(family: string, path: string): string {
  return [
    "@font-face {",
    `  font-family: "${family}";`,
    `  src: url("${path}") format("${fontFormat(path)}");`,
    "  font-display: swap;",
    "}",
  ].join("\n");
}
