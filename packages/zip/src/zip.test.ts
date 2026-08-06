import { deflateRawSync } from "node:zlib";
import { describe, expect, test } from "vitest";

import { crc32, crc32Finish, crc32Update, CRC32_INIT, writeZip } from "./index";

const encoder = new TextEncoder();

/** Read the fields this suite asserts on, without depending on a reader. */
function inspect(archive: Uint8Array): { count: number; entries: { name: string; method: number }[] } {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const eocd = archive.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  const count = view.getUint16(eocd + 10, true);

  let at = view.getUint32(eocd + 16, true);
  const entries: { name: string; method: number }[] = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const method = view.getUint16(at + 10, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    const name = new TextDecoder().decode(archive.subarray(at + 46, at + 46 + nameLen));
    entries.push({ name, method });
    at += 46 + nameLen + extraLen + commentLen;
  }
  return { count, entries };
}

describe("writeZip", () => {
  test("writes one central-directory record per entry, in order", () => {
    const archive = writeZip([
      { name: "manifest.json", data: '{"id":"hello"}' },
      { name: "nested/deep/file.bin", data: new Uint8Array([1, 2, 3, 4]) },
      { name: "empty.txt", data: "" },
    ]);
    const { count, entries } = inspect(archive);
    expect(count).toBe(3);
    expect(entries.map((e) => e.name)).toEqual(["manifest.json", "nested/deep/file.bin", "empty.txt"]);
    expect(entries.every((e) => e.method === 0)).toBe(true);
  });

  test("deflates when it pays and stores when it does not", () => {
    const compressible = { name: "big.txt", data: "x".repeat(4096) };
    const tiny = { name: "small.bin", data: new Uint8Array([7, 3, 9]) };
    const deflate = (data: Uint8Array): Uint8Array => deflateRawSync(data);

    expect(writeZip([compressible], { deflate }).length).toBeLessThan(writeZip([compressible]).length);
    expect(inspect(writeZip([compressible], { deflate })).entries[0]?.method).toBe(8);
    // Deflating three bytes makes them bigger; storing is the honest choice.
    expect(inspect(writeZip([tiny], { deflate })).entries[0]?.method).toBe(0);
  });

  test("is deterministic — no wall clock in the archive", () => {
    const entries = [{ name: "a.txt", data: "hello" }];
    expect(Buffer.from(writeZip(entries)).equals(Buffer.from(writeZip(entries)))).toBe(true);
  });

  test("writes UTF-8 entry names", () => {
    expect(inspect(writeZip([{ name: "kʷátɬp/pack.json", data: "{}" }])).entries[0]?.name).toBe(
      "kʷátɬp/pack.json",
    );
  });

  test("crc32 matches the standard check value, incrementally too", () => {
    expect(crc32(encoder.encode("123456789"))).toBe(0xcbf43926);
    let running = CRC32_INIT;
    running = crc32Update(running, encoder.encode("12345"));
    running = crc32Update(running, encoder.encode("6789"));
    expect(crc32Finish(running)).toBe(0xcbf43926);
  });
});
