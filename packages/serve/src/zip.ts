import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, rm, writeFile, type FileHandle } from "node:fs/promises";
import path from "node:path";
import { Transform, type TransformCallback } from "node:stream";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";

import {
  CRC32_INIT,
  crc32,
  crc32Finish,
  crc32Update,
  writeZip as writeArchive,
} from "homespace-zip";

export interface ZipEntry {
  name: string;
  data: Buffer;
}

/** One central-directory record. Callers confine `name` themselves (§12). */
export interface ZipMember {
  name: string;
  /** Directory record (name ends with "/") — no contents to extract. */
  directory: boolean;
  /** Decompressed size declared by the archive. */
  size: number;
  compressedSize: number;
  /** Compression method: 0 stored, 8 deflated. Nothing else is accepted. */
  method: number;
  crc: number;
  /** Byte offset of this member's local file header. */
  offset: number;
}

/** Expansion caps. An upload cap alone does not bound a zip bomb (TDD §9.2). */
export interface ZipLimits {
  maxEntries: number;
  /** Decompressed bytes allowed for any single entry. */
  maxEntryBytes: number;
  /** Decompressed bytes allowed across the whole archive. */
  maxTotalBytes: number;
}

export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxEntries: 20_000,
  maxEntryBytes: 2 * 1024 ** 3,
  maxTotalBytes: 8 * 1024 ** 3,
};

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const ZIP64_LOCATOR_SIG = 0x07064b50;
const EOCD_MIN = 22;
/** EOCD plus the largest possible archive comment. */
const EOCD_SEARCH = EOCD_MIN + 0xffff;
const U32_MAX = 0xffffffff;
const U16_MAX = 0xffff;

interface Eocd {
  count: number;
  cdOffset: number;
  cdSize: number;
}

/**
 * Locate the end-of-central-directory record in the archive's tail. Its offsets
 * are absolute within the archive, so they index the whole file regardless of
 * where the tail was cut. Archives this reader cannot represent faithfully —
 * ZIP64, multi-disk, or at the u16 entry ceiling — are rejected here rather
 * than half-read (TDD §9.2).
 */
function parseEocd(tail: Buffer): Eocd {
  for (let i = tail.length - EOCD_MIN; i >= 0; i--) {
    if (tail.readUInt32LE(i) !== EOCD_SIG) continue;
    // The ZIP64 locator, when present, sits immediately before the EOCD.
    if (i >= 20 && tail.readUInt32LE(i - 20) === ZIP64_LOCATOR_SIG) {
      throw new Error("ZIP64 archives are not supported — repack the archive below 4 GiB with fewer than 65535 files");
    }
    if (tail.readUInt16LE(i + 4) !== 0 || tail.readUInt16LE(i + 6) !== 0) {
      throw new Error("multi-disk zip archives are not supported — repack the archive as a single file");
    }
    const count = tail.readUInt16LE(i + 10);
    if (count === U16_MAX) {
      throw new Error("archive declares 65535 files (the ZIP64 marker) — repack it with fewer files");
    }
    const cdSize = tail.readUInt32LE(i + 12);
    const cdOffset = tail.readUInt32LE(i + 16);
    if (cdSize === U32_MAX || cdOffset === U32_MAX) {
      throw new Error("ZIP64 archives are not supported — repack the archive below 4 GiB");
    }
    return { count, cdOffset, cdSize };
  }
  throw new Error("not a zip archive (no end-of-central-directory record)");
}

/** Read the central directory region into members, enforcing the declared caps. */
function parseCentralDirectory(cd: Buffer, count: number, limits: ZipLimits): ZipMember[] {
  if (count > limits.maxEntries) {
    throw new Error(`archive has ${count} files, more than the ${limits.maxEntries} allowed`);
  }
  const members: ZipMember[] = [];
  let at = 0;
  let declaredTotal = 0;

  for (let i = 0; i < count; i++) {
    if (at + 46 > cd.length || cd.readUInt32LE(at) !== CENTRAL_SIG) throw new Error("corrupt central directory");
    const flags = cd.readUInt16LE(at + 8);
    const method = cd.readUInt16LE(at + 10);
    const crc = cd.readUInt32LE(at + 16);
    const compressedSize = cd.readUInt32LE(at + 20);
    const size = cd.readUInt32LE(at + 24);
    const nameLen = cd.readUInt16LE(at + 28);
    const extraLen = cd.readUInt16LE(at + 30);
    const commentLen = cd.readUInt16LE(at + 32);
    const offset = cd.readUInt32LE(at + 42);
    const name = cd.toString("utf8", at + 46, at + 46 + nameLen);

    if ((flags & 0x1) !== 0) throw new Error(`entry '${name}' is encrypted — encrypted archives are not supported`);
    if (method !== 0 && method !== 8) {
      throw new Error(`entry '${name}' uses compression method ${method} — only stored and deflated entries are supported`);
    }
    if (compressedSize === U32_MAX || size === U32_MAX || offset === U32_MAX) {
      throw new Error(`entry '${name}' needs ZIP64 — repack the archive below 4 GiB`);
    }
    if (size > limits.maxEntryBytes) {
      throw new Error(`entry '${name}' expands to ${size} bytes, more than the ${limits.maxEntryBytes} allowed`);
    }
    declaredTotal += size;
    if (declaredTotal > limits.maxTotalBytes) {
      throw new Error(`archive expands to more than the ${limits.maxTotalBytes} bytes allowed`);
    }

    members.push({ name, directory: name.endsWith("/"), size, compressedSize, method, crc, offset });
    at += 46 + nameLen + extraLen + commentLen;
  }
  return members;
}

/** Where a member's compressed bytes begin, given its local file header. */
function dataStart(header: Buffer, member: ZipMember): number {
  if (header.length < 30 || header.readUInt32LE(0) !== LOCAL_SIG) {
    throw new Error(`corrupt local header for '${member.name}'`);
  }
  return member.offset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
}

function checkIntegrity(member: ZipMember, bytes: number, crc: number): void {
  if (bytes !== member.size) {
    throw new Error(`entry '${member.name}' is truncated (expected ${member.size} bytes, got ${bytes})`);
  }
  if (crc !== member.crc) {
    throw new Error(`entry '${member.name}' failed its CRC-32 check — the archive is corrupt or was tampered with`);
  }
}

/** Count bytes and CRC them as they pass, failing fast past `limit`. */
function guard(name: string, limit: number, done: (bytes: number, crc: number) => void): Transform {
  let bytes = 0;
  let crc = CRC32_INIT;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback: TransformCallback) {
      bytes += chunk.length;
      if (bytes > limit) {
        callback(new Error(`entry '${name}' expands beyond the ${limit}-byte limit`));
        return;
      }
      crc = crc32Update(crc, chunk);
      callback(null, chunk);
    },
    flush(callback) {
      done(bytes, crc32Finish(crc));
      callback();
    },
  });
}

export interface ZipArchive {
  members: ZipMember[];
  /** Read one member into memory; `maxBytes` caps it further than the limits do. */
  read(member: ZipMember, maxBytes?: number): Promise<Buffer>;
  /** Inflate one member straight to `destPath`, creating parent directories. */
  extract(member: ZipMember, destPath: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * Open a zip on disk for random-access reads. Entries are inflated one at a
 * time, straight to their destination, so a large upload never has to fit in
 * memory (TDD §9.2). Dependency-free: the upload path is the zip-slip surface,
 * so it stays fully under our control.
 */
export async function openZip(filePath: string, limits: Partial<ZipLimits> = {}): Promise<ZipArchive> {
  const lim: ZipLimits = { ...DEFAULT_ZIP_LIMITS, ...limits };
  const handle: FileHandle = await open(filePath, "r");
  let extractedTotal = 0;

  try {
    const size = (await handle.stat()).size;
    if (size < EOCD_MIN) throw new Error("not a zip archive (file is too short)");

    const tailStart = Math.max(0, size - EOCD_SEARCH);
    const eocd = parseEocd(await readAt(handle, tailStart, size - tailStart));
    if (eocd.cdOffset + eocd.cdSize > size) throw new Error("corrupt central directory (points past the end of the file)");

    const cd = await readAt(handle, eocd.cdOffset, eocd.cdSize);
    const members = parseCentralDirectory(cd, eocd.count, lim);

    const startOf = async (member: ZipMember): Promise<number> => {
      const start = dataStart(await readAt(handle, member.offset, 30), member);
      if (start + member.compressedSize > size) throw new Error(`entry '${member.name}' is truncated`);
      return start;
    };

    const account = (bytes: number): void => {
      extractedTotal += bytes;
      if (extractedTotal > lim.maxTotalBytes) {
        throw new Error(`archive expands to more than the ${lim.maxTotalBytes} bytes allowed`);
      }
    };

    return {
      members,

      async read(member, maxBytes = lim.maxEntryBytes) {
        if (member.directory) return Buffer.alloc(0);
        const cap = Math.min(maxBytes, lim.maxEntryBytes);
        if (member.size > cap) {
          throw new Error(`entry '${member.name}' is ${member.size} bytes, more than the ${cap} allowed here`);
        }
        const comp = await readAt(handle, await startOf(member), member.compressedSize);
        const data = member.method === 0 ? comp : inflate(comp, cap, member.name);
        checkIntegrity(member, data.length, crc32(data));
        account(data.length);
        return data;
      },

      async extract(member, destPath) {
        await mkdir(path.dirname(destPath), { recursive: true });
        if (member.directory) {
          await mkdir(destPath, { recursive: true });
          return;
        }
        try {
          if (member.compressedSize === 0) {
            // An empty stored entry has no byte range to stream.
            await writeFile(destPath, Buffer.alloc(0));
            checkIntegrity(member, 0, 0);
            return;
          }
          const start = await startOf(member);
          let bytes = 0;
          let crc = 0;
          const source = createReadStream(filePath, { start, end: start + member.compressedSize - 1 });
          const meter = guard(member.name, lim.maxEntryBytes, (b, c) => {
            bytes = b;
            crc = c;
          });
          const stages = member.method === 0
            ? [source, meter, createWriteStream(destPath)]
            : [source, zlib.createInflateRaw(), meter, createWriteStream(destPath)];
          await pipeline(stages);
          checkIntegrity(member, bytes, crc);
          account(bytes);
        } catch (e) {
          await rm(destPath, { force: true });
          throw e;
        }
      },

      async close() {
        await handle.close();
      },
    };
  } catch (e) {
    await handle.close();
    throw e;
  }
}

/** Read exactly `length` bytes at `offset`, or fewer at end of file. */
async function readAt(handle: FileHandle, offset: number, length: number): Promise<Buffer> {
  const buf = Buffer.alloc(length);
  let filled = 0;
  while (filled < length) {
    const { bytesRead } = await handle.read(buf, filled, length - filled, offset + filled);
    if (bytesRead === 0) break;
    filled += bytesRead;
  }
  return filled === length ? buf : buf.subarray(0, filled);
}

function inflate(comp: Buffer, maxOutputLength: number, name: string): Buffer {
  try {
    return zlib.inflateRawSync(comp, { maxOutputLength });
  } catch (e) {
    const error = e as NodeJS.ErrnoException;
    throw new Error(
      error.code === "ERR_BUFFER_TOO_LARGE"
        ? `entry '${name}' expands beyond the ${maxOutputLength}-byte limit`
        : `entry '${name}' could not be decompressed: ${error.message}`,
    );
  }
}

/**
 * Parse an in-memory ZIP into entries. Same caps and integrity checks as
 * `openZip`; use it for archives that are already buffers (fixtures, tests).
 */
export function readZip(buf: Buffer, limits: Partial<ZipLimits> = {}): ZipEntry[] {
  const lim: ZipLimits = { ...DEFAULT_ZIP_LIMITS, ...limits };
  if (buf.length < EOCD_MIN) throw new Error("not a zip archive (file is too short)");

  const eocd = parseEocd(buf.subarray(Math.max(0, buf.length - EOCD_SEARCH)));
  if (eocd.cdOffset + eocd.cdSize > buf.length) {
    throw new Error("corrupt central directory (points past the end of the file)");
  }
  const members = parseCentralDirectory(buf.subarray(eocd.cdOffset, eocd.cdOffset + eocd.cdSize), eocd.count, lim);

  const entries: ZipEntry[] = [];
  let total = 0;
  for (const member of members) {
    if (member.directory) {
      entries.push({ name: member.name, data: Buffer.alloc(0) });
      continue;
    }
    const start = dataStart(buf.subarray(member.offset, member.offset + 30), member);
    const comp = buf.subarray(start, start + member.compressedSize);
    if (comp.length !== member.compressedSize) throw new Error(`entry '${member.name}' is truncated`);
    const data = member.method === 0 ? Buffer.from(comp) : inflate(comp, lim.maxEntryBytes, member.name);
    checkIntegrity(member, data.length, crc32(data));
    total += data.length;
    if (total > lim.maxTotalBytes) throw new Error(`archive expands to more than the ${lim.maxTotalBytes} bytes allowed`);
    entries.push({ name: member.name, data });
  }
  return entries;
}

export interface WriteZipOptions {
  /** Deflate entries instead of storing them verbatim. */
  deflate?: boolean;
}

/**
 * Build a ZIP from entries — used by tests and fixtures. Writing lives in
 * `homespace-zip`, the one shared home (TDD §15.4); this wraps it with the
 * daemon's Node conveniences (`Buffer`, zlib deflate).
 */
export function writeZip(files: ZipEntry[], options: WriteZipOptions = {}): Buffer {
  const archive = writeArchive(
    files,
    options.deflate === true ? { deflate: (data) => zlib.deflateRawSync(data) } : {},
  );
  return Buffer.from(archive);
}
