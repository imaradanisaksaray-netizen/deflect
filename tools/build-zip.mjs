/**
 * Packages game/ into a ZIP ready for the YouTube Playables developer portal.
 *
 * Run with:  node tools/build-zip.mjs
 * Output:    dist/deflect-playables.zip  (index.html sits at the archive root)
 *
 * The ZIP writer is hand-rolled on top of node:zlib so the project stays
 * dependency-free. Timestamps are fixed, which makes builds reproducible.
 */

import { deflateRawSync } from 'node:zlib';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SOURCE = join(ROOT, 'game');
const OUTPUT = join(ROOT, 'dist', 'deflect-playables.zip');

/** Fixed DOS timestamp (1980-01-01) keeps the archive byte-identical per build. */
const DOS_TIME = 0;
const DOS_DATE = 33;
const UTF8_FLAG = 0x0800;
const METHOD_DEFLATE = 8;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(fullPath));
    else files.push(fullPath);
  }
  return files.sort();
}

function localHeader(entry) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(UTF8_FLAG, 6);
  header.writeUInt16LE(METHOD_DEFLATE, 8);
  header.writeUInt16LE(DOS_TIME, 10);
  header.writeUInt16LE(DOS_DATE, 12);
  header.writeUInt32LE(entry.crc, 14);
  header.writeUInt32LE(entry.compressed.length, 18);
  header.writeUInt32LE(entry.size, 22);
  header.writeUInt16LE(entry.nameBuffer.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, entry.nameBuffer]);
}

function centralHeader(entry) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(UTF8_FLAG, 8);
  header.writeUInt16LE(METHOD_DEFLATE, 10);
  header.writeUInt16LE(DOS_TIME, 12);
  header.writeUInt16LE(DOS_DATE, 14);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(entry.compressed.length, 20);
  header.writeUInt32LE(entry.size, 24);
  header.writeUInt16LE(entry.nameBuffer.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(entry.offset, 42);
  return Buffer.concat([header, entry.nameBuffer]);
}

function endOfCentralDirectory(count, size, offset) {
  const record = Buffer.alloc(22);
  record.writeUInt32LE(0x06054b50, 0);
  record.writeUInt16LE(0, 4);
  record.writeUInt16LE(0, 6);
  record.writeUInt16LE(count, 8);
  record.writeUInt16LE(count, 10);
  record.writeUInt32LE(size, 12);
  record.writeUInt32LE(offset, 16);
  record.writeUInt16LE(0, 20);
  return record;
}

async function build() {
  const files = await collectFiles(SOURCE);
  const chunks = [];
  const entries = [];
  let offset = 0;

  for (const filePath of files) {
    const contents = await readFile(filePath);
    // ZIP paths always use forward slashes, regardless of host platform.
    const name = relative(SOURCE, filePath).split(/[\\/]/).join('/');

    const entry = {
      name,
      nameBuffer: Buffer.from(name, 'utf8'),
      size: contents.length,
      crc: crc32(contents),
      compressed: deflateRawSync(contents, { level: 9 }),
      offset,
    };

    const header = localHeader(entry);
    chunks.push(header, entry.compressed);
    offset += header.length + entry.compressed.length;
    entries.push(entry);
  }

  const centralStart = offset;
  const centralChunks = entries.map(centralHeader);
  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);

  const archive = Buffer.concat([
    ...chunks,
    ...centralChunks,
    endOfCentralDirectory(entries.length, centralSize, centralStart),
  ]);

  await mkdir(join(ROOT, 'dist'), { recursive: true });
  await writeFile(OUTPUT, archive);

  const rawSize = entries.reduce((sum, entry) => sum + entry.size, 0);
  console.log(`packed ${entries.length} files`);
  for (const entry of entries) {
    console.log(`  ${entry.name.padEnd(34)} ${String(entry.size).padStart(7)} B`);
  }
  console.log(`raw      ${(rawSize / 1024).toFixed(1)} KB`);
  console.log(`archive  ${(archive.length / 1024).toFixed(1)} KB`);
  console.log(`written  ${OUTPUT}`);

  if (!entries.some((entry) => entry.name === 'index.html')) {
    console.error('WARNING: index.html is not at the archive root — Playables will reject this.');
    process.exitCode = 1;
  }
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
