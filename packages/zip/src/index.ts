/**
 * `homespace-zip` — the one shared home for writing ZIP archives (TDD §15.4).
 *
 * Dependency-free and isomorphic: no Node built-ins, no `Buffer`, no
 * compression library. Entries are **stored** (uncompressed) unless the caller
 * hands in a `deflate` function, because a homespace is mostly already-
 * compressed images and wasm — and because a browser has no synchronous
 * deflate. Output is deterministic: a fixed DOS timestamp, no wall clock (§5.2).
 */

export interface ZipInput {
  /** Entry name: a POSIX path inside the archive. */
  name: string;
  /** Contents; strings are encoded as UTF-8. */
  data: Uint8Array | string;
}

export interface WriteZipOptions {
  /**
   * Raw-DEFLATE an entry. Omit to store entries verbatim. Node passes
   * `zlib.deflateRawSync`; a browser has no synchronous equivalent and stores.
   */
  deflate?: (data: Uint8Array) => Uint8Array;
}

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
/** UTF-8 entry names (general-purpose bit 11). */
const UTF8_FLAG = 0x800;
/** The DOS epoch, 1980-01-01 00:00 — fixed so archives are reproducible. */
const DOS_DATE = 0x0021;
const DOS_TIME = 0x0000;

const encoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** Starting value for an incremental CRC-32 (see `crc32Update`). */
export const CRC32_INIT = 0xffffffff;

/**
 * Fold more bytes into a running CRC-32. Start from `CRC32_INIT` and finish
 * with `crc32Finish` — that is how a reader checks an entry it is streaming.
 */
export function crc32Update(crc: number, bytes: Uint8Array): number {
  let c = crc;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return c >>> 0;
}

/** Turn a running CRC-32 into the value ZIP records. */
export function crc32Finish(crc: number): number {
  return (crc ^ 0xffffffff) >>> 0;
}

/** CRC-32 of a byte sequence, as ZIP records it. */
export function crc32(bytes: Uint8Array): number {
  return crc32Finish(crc32Update(CRC32_INIT, bytes));
}

interface Placed {
  name: Uint8Array;
  body: Uint8Array;
  size: number;
  crc: number;
  method: number;
  offset: number;
}

function concat(parts: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Build a ZIP archive from entries, in the order given. */
export function writeZip(entries: ZipInput[], options: WriteZipOptions = {}): Uint8Array {
  const parts: Uint8Array[] = [];
  const placed: Placed[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = typeof entry.data === "string" ? encoder.encode(entry.data) : entry.data;
    const deflated = options.deflate ? options.deflate(data) : undefined;
    // Compression that does not pay for itself is worse than none.
    const useDeflate = deflated !== undefined && deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const crc = crc32(data);

    const local = new Uint8Array(30);
    const view = new DataView(local.buffer);
    view.setUint32(0, LOCAL_SIG, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, UTF8_FLAG, true);
    view.setUint16(8, useDeflate ? 8 : 0, true);
    view.setUint16(10, DOS_TIME, true);
    view.setUint16(12, DOS_DATE, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, body.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true);

    parts.push(local, name, body);
    placed.push({ name, body, size: data.length, crc, method: useDeflate ? 8 : 0, offset });
    offset += local.length + name.length + body.length;
  }

  const central: Uint8Array[] = [];
  let centralSize = 0;
  for (const item of placed) {
    const header = new Uint8Array(46);
    const view = new DataView(header.buffer);
    view.setUint32(0, CENTRAL_SIG, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, UTF8_FLAG, true);
    view.setUint16(10, item.method, true);
    view.setUint16(12, DOS_TIME, true);
    view.setUint16(14, DOS_DATE, true);
    view.setUint32(16, item.crc, true);
    view.setUint32(20, item.body.length, true);
    view.setUint32(24, item.size, true);
    view.setUint16(28, item.name.length, true);
    view.setUint32(42, item.offset, true);

    central.push(header, item.name);
    centralSize += header.length + item.name.length;
  }

  const eocd = new Uint8Array(22);
  const view = new DataView(eocd.buffer);
  view.setUint32(0, EOCD_SIG, true);
  view.setUint16(8, placed.length, true);
  view.setUint16(10, placed.length, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, offset, true);

  const all = [...parts, ...central, eocd];
  return concat(all, all.reduce((sum, part) => sum + part.length, 0));
}
