/**
 * Minimal, dependency-free ZIP writer/reader.
 * Writer uses the STORE method (no compression) so bytes are copied verbatim —
 * this is intentional: original assets must be preserved byte-for-byte.
 * Reader supports STORE entries (what this app writes). Deflated entries from
 * other tools are rejected with a clear error instead of being misread.
 */

let CRC_TABLE: Uint32Array | null = null;

function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  CRC_TABLE = t;
  return t;
}

export function crc32(data: Uint8Array): number {
  const t = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = t[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function dosDateTime(d: Date): { time: number; date: number } {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function createZip(entries: ZipEntry[], now: Date = new Date()): Uint8Array {
  const { time, date } = dosDateTime(now);
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const seen = new Set<string>();

  for (const e of entries) {
    if (seen.has(e.name)) throw new Error(`Duplicate ZIP entry name: ${e.name}`);
    seen.add(e.name);
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;
    if (size > 0xfffffffe || offset > 0xfffffffe) throw new Error('ZIP64 not supported (file > 4 GB)');

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true); // version needed
    lh.setUint16(6, 0x0800, true); // UTF-8 names
    lh.setUint16(8, 0, true); // STORE
    lh.setUint16(10, time, true);
    lh.setUint16(12, date, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, size, true);
    lh.setUint32(22, size, true);
    lh.setUint16(26, nameBytes.length, true);
    lh.setUint16(28, 0, true);
    const lhBytes = new Uint8Array(lh.buffer);
    locals.push(lhBytes, nameBytes, e.data);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, time, true);
    ch.setUint16(14, date, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, size, true);
    ch.setUint32(24, size, true);
    ch.setUint16(28, nameBytes.length, true);
    ch.setUint16(30, 0, true);
    ch.setUint16(32, 0, true);
    ch.setUint16(34, 0, true);
    ch.setUint16(36, 0, true);
    ch.setUint32(38, 0, true);
    ch.setUint32(42, offset, true);
    centrals.push(new Uint8Array(ch.buffer), nameBytes);

    offset += 30 + nameBytes.length + size;
  }

  const centralSize = centrals.reduce((s, b) => s + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
  const total = parts.reduce((s, b) => s + b.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const b of parts) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}

export function readZip(buf: Uint8Array): ZipEntry[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // Find End Of Central Directory (scan back, max comment 64 KB)
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a ZIP file (end of central directory not found)');
  const count = dv.getUint16(eocd + 10, true);
  let cd = dv.getUint32(eocd + 16, true);
  const out: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (cd + 46 > buf.length || dv.getUint32(cd, true) !== 0x02014b50) throw new Error('Corrupt ZIP central directory');
    const method = dv.getUint16(cd + 10, true);
    const crc = dv.getUint32(cd + 16, true);
    const csize = dv.getUint32(cd + 20, true);
    const nameLen = dv.getUint16(cd + 28, true);
    const extraLen = dv.getUint16(cd + 30, true);
    const commentLen = dv.getUint16(cd + 32, true);
    const lho = dv.getUint32(cd + 42, true);
    const name = dec.decode(buf.subarray(cd + 46, cd + 46 + nameLen));
    if (method !== 0) throw new Error(`ZIP entry "${name}" is compressed; only backups created by this app can be restored`);
    if (dv.getUint32(lho, true) !== 0x04034b50) throw new Error('Corrupt ZIP local header');
    const lNameLen = dv.getUint16(lho + 26, true);
    const lExtraLen = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lNameLen + lExtraLen;
    if (start + csize > buf.length) throw new Error('ZIP entry exceeds file size (truncated file?)');
    const data = buf.slice(start, start + csize);
    if (crc32(data) !== crc) throw new Error(`CRC mismatch in ZIP entry "${name}" (file damaged)`);
    if (!name.endsWith('/')) out.push({ name, data });
    cd += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
