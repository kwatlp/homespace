/**
 * The POSIX subset of `node:path` the scanner and renderer use, for the browser
 * bundle (TDD §15.2). An in-memory homespace is always POSIX, so this is not a
 * lossy substitute — it is the same semantics with one separator. There is no
 * working directory in a browser, so `resolve()` treats `/` as the root.
 */

export const sep = "/";

function normalize(pathname: string, allowAboveRoot: boolean): string {
  const out: string[] = [];
  for (const segment of pathname.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (out.length > 0 && out[out.length - 1] !== "..") out.pop();
      else if (allowAboveRoot) out.push("..");
      continue;
    }
    out.push(segment);
  }
  return out.join("/");
}

export function isAbsolute(pathname: string): boolean {
  return pathname.startsWith("/");
}

export function join(...parts: string[]): string {
  const joined = parts.filter((part) => part !== "").join("/");
  if (joined === "") return ".";
  const absolute = isAbsolute(joined);
  const normalized = normalize(joined, !absolute);
  if (normalized === "") return absolute ? "/" : ".";
  return absolute ? `/${normalized}` : normalized;
}

export function resolve(...parts: string[]): string {
  let resolved = "";
  let absolute = false;
  for (let i = parts.length - 1; i >= 0 && !absolute; i--) {
    const part = parts[i];
    if (part === undefined || part === "") continue;
    resolved = resolved === "" ? part : `${part}/${resolved}`;
    absolute = isAbsolute(part);
  }
  const normalized = normalize(resolved, false);
  return normalized === "" ? "/" : `/${normalized}`;
}

export function dirname(pathname: string): string {
  if (pathname === "") return ".";
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const at = trimmed.lastIndexOf("/");
  if (at === -1) return ".";
  if (at === 0) return "/";
  return trimmed.slice(0, at);
}

export function relative(from: string, to: string): string {
  const start = resolve(from).split("/").filter((p) => p !== "");
  const end = resolve(to).split("/").filter((p) => p !== "");
  let shared = 0;
  while (shared < start.length && shared < end.length && start[shared] === end[shared]) shared += 1;
  const up: string[] = new Array(start.length - shared).fill("..");
  return [...up, ...end.slice(shared)].join("/");
}

export function basename(pathname: string): string {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const at = trimmed.lastIndexOf("/");
  return at === -1 ? trimmed : trimmed.slice(at + 1);
}

export function extname(pathname: string): string {
  const base = basename(pathname);
  const at = base.lastIndexOf(".");
  return at <= 0 ? "" : base.slice(at);
}

export default { sep, isAbsolute, join, resolve, dirname, relative, basename, extname };
