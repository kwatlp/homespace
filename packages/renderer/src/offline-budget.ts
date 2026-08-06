import { isExternalUrl } from "./url.js";

export interface BudgetViolation {
  file: string;
  url: string;
}

export interface Crawlable {
  path: string;
  contents: string;
}

/**
 * Element attributes that fetch bytes — the sinks the offline budget covers
 * (TDD §10.2). Navigation (`<a href>`) is deliberately absent: that IS the
 * network. `srcset` holds a comma-separated candidate list; the rest hold one
 * URL each.
 *
 * Scope: this crawls the files the renderer *generates*. `static/` copies and
 * pack-authored HTML (a game's own `index.html`) are the documented escape
 * hatch and are not scanned; `homespace doctor` (WO-20) reports those as
 * warnings instead.
 */
const HTML_SINKS: Readonly<Record<string, readonly string[]>> = {
  link: ["href"],
  script: ["src"],
  img: ["src", "srcset"],
  iframe: ["src"],
  source: ["src", "srcset"],
  video: ["src", "poster"],
  audio: ["src"],
  embed: ["src"],
  track: ["src"],
  input: ["src"],
  object: ["data"],
};

const TAG = /<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g;
const ATTRIBUTE = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

/** Resource loads CSS can express, in stylesheets and in inline `<style>`. */
const CSS_PATTERNS: RegExp[] = [
  /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi,
  /@import\s+["']([^"']+)["']/gi,
];

/** Split a srcset into its candidate URLs ("url descriptor, url descriptor"). */
function srcsetUrls(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0] ?? "")
    .filter((v) => v !== "");
}

/** Find every external resource load across the generated HTML/CSS files. */
export function findBudgetViolations(files: Crawlable[]): BudgetViolation[] {
  const violations: BudgetViolation[] = [];

  for (const file of files) {
    if (!/\.(html?|css)$/i.test(file.path)) continue;
    const flag = (url: string): void => {
      if (isExternalUrl(url)) violations.push({ file: file.path, url });
    };

    if (/\.html?$/i.test(file.path)) {
      TAG.lastIndex = 0;
      let tag: RegExpExecArray | null;
      while ((tag = TAG.exec(file.contents)) !== null) {
        const sinks = HTML_SINKS[(tag[1] ?? "").toLowerCase()];
        if (sinks === undefined) continue;
        ATTRIBUTE.lastIndex = 0;
        let attribute: RegExpExecArray | null;
        while ((attribute = ATTRIBUTE.exec(tag[2] ?? "")) !== null) {
          const name = (attribute[1] ?? "").toLowerCase();
          if (!sinks.includes(name)) continue;
          const value = attribute[2] ?? attribute[3] ?? attribute[4] ?? "";
          if (name === "srcset") for (const url of srcsetUrls(value)) flag(url);
          else flag(value.trim());
        }
      }
    }

    for (const pattern of CSS_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(file.contents)) !== null) flag((match[1] ?? "").trim());
    }
  }

  return violations;
}

/** Throw if any generated file loads an external resource (the CI gate). */
export function assertOfflineBudget(files: Crawlable[]): void {
  const violations = findBudgetViolations(files);
  if (violations.length > 0) {
    const detail = violations.map((v) => `  ${v.file} → ${v.url}`).join("\n");
    throw new Error(
      `offline-budget violation: ${violations.length} external resource load(s) in dist/.\n` +
        `Every resource a homespace loads must ship in dist/ (TDD §10.2).\n${detail}`,
    );
  }
}
