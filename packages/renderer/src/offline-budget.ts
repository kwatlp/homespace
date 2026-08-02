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
 * Resource-loading sinks the offline budget covers (TDD §10.2): stylesheet/
 * script/img/iframe/source loads in HTML, plus url() references in CSS.
 * Navigation (`<a href>`) is deliberately excluded — that IS the network.
 */
const RESOURCE_PATTERNS: RegExp[] = [
  /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi,
  /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,
  /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,
  /<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,
  /<source\b[^>]*\b(?:src|srcset)\s*=\s*["']([^"']+)["']/gi,
  /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi,
];

function candidatesFrom(raw: string): string[] {
  // srcset can hold a comma-separated list of "url descriptor" pairs.
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
    for (const pattern of RESOURCE_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(file.contents)) !== null) {
        for (const candidate of candidatesFrom(match[1] ?? "")) {
          if (isExternalUrl(candidate)) {
            violations.push({ file: file.path, url: candidate });
          }
        }
      }
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
