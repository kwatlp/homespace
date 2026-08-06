/**
 * `node:fs/promises` for the browser bundle. Nothing here runs: the Builder
 * always passes an in-memory file access (TDD §6.6), and `writeDist` is
 * Node-only by design — the browser zips the build instead of writing it.
 * These exist so the bundle resolves, and they fail loudly if that ever stops
 * being true.
 */

function unavailable(name: string): never {
  throw new Error(
    `${name}() is not available in the browser — the Builder builds into memory and downloads a zip (TDD §15.2)`,
  );
}

export const readdir = (): never => unavailable("readdir");
export const readFile = (): never => unavailable("readFile");
export const stat = (): never => unavailable("stat");
export const mkdir = (): never => unavailable("mkdir");
export const writeFile = (): never => unavailable("writeFile");
export const copyFile = (): never => unavailable("copyFile");
export const rm = (): never => unavailable("rm");
export const rmdir = (): never => unavailable("rmdir");

export default { readdir, readFile, stat, mkdir, writeFile, copyFile, rm, rmdir };
