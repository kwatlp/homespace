import type { BuiltFile } from "./build.js";

const decoder = new TextDecoder();

/** Resolve a page-relative URL against the directory a page sits in. */
function resolveFrom(dir: string, url: string): string {
  const parts = dir === "" ? [] : dir.split("/");
  for (const segment of url.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return parts.join("/");
}

/** True for anything the preview must not try to resolve inside the build. */
function isOffsite(url: string): boolean {
  return url === "" || url.startsWith("#") || url.startsWith("data:") || /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//");
}

/**
 * Turn a built site into one self-contained document for the preview frame:
 * stylesheets inlined, media pointed at in-memory URLs, and links to other
 * pages neutralized — the preview shows the landing page, and a click that
 * navigated away would only lead nowhere.
 *
 * `urlFor` maps a dist path to something the frame can load (a blob URL in the
 * browser). Injected so this stays a pure function worth testing.
 */
export function previewDocument(files: BuiltFile[], urlFor: (path: string) => string): string {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const index = byPath.get("index.html");
  if (index === undefined) return "<!doctype html><title>Nothing to preview</title>";

  const textOf = (path: string): string | undefined => {
    const file = byPath.get(path);
    return file === undefined ? undefined : decoder.decode(file.bytes);
  };

  let html = decoder.decode(index.bytes);

  // Stylesheets become inline <style>, so the frame needs no extra fetch.
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const href = /\bhref\s*=\s*"([^"]*)"/i.exec(tag)?.[1];
    if (href === undefined || isOffsite(href)) return tag;
    if (!/\brel\s*=\s*"stylesheet"/i.test(tag)) return ""; // feed links load nothing here
    const css = textOf(resolveFrom("", href));
    return css === undefined ? "" : `<style>\n${css}</style>`;
  });

  // Media and frames point at in-memory URLs; nothing reaches the network.
  html = html.replace(
    /(<(?:img|iframe|source|video|audio)\b[^>]*?\b(?:src|poster)\s*=\s*")([^"]*)(")/gi,
    (whole, head: string, url: string, tail: string) => {
      if (isOffsite(url)) return whole;
      const target = resolveFrom("", url);
      return byPath.has(target) ? `${head}${urlFor(target)}${tail}` : whole;
    },
  );

  // Links to other built pages would leave the preview; keep them inert.
  html = html.replace(/(<a\b[^>]*?\bhref\s*=\s*")([^"]*)(")/gi, (whole, head: string, url: string, tail: string) => {
    if (isOffsite(url)) return whole;
    return `${head}#${tail} data-preview-link="${url}"`;
  });

  return html;
}
