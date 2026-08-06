/**
 * `node:crypto` for the browser bundle. Only the scanner's `--verify` pass
 * hashes anything, and the Builder never asks for it — a homespace being
 * composed has no checksums to re-verify yet. If that changes, this becomes a
 * WebCrypto-backed digest rather than a silent difference.
 */
export function createHash(): never {
  throw new Error(
    "checksum verification is not available in the browser — build without --verify (TDD §15.2)",
  );
}

export default { createHash };
