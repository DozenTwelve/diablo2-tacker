// A ZIP archive of files stored as they are (no compression), to hand several organized saves back as one download.
const TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (bytes) => {
  let c = ~0;
  for (const b of bytes) c = TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return ~c >>> 0;
};

// A date as DOS time and date fields (local time, 2 second steps); 1980-01-01 without one
const dosTime = (ms) => {
  if (ms == null) return [0, 0x21];
  const d = new Date(ms);
  return [(d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()];
};

// files: [{ name, bytes: Uint8Array, time? (ms) }] -> Uint8Array. Names are UTF-8 (flag bit 11). Each file keeps its
// time: D2R lists characters by when their save was last changed, so organized mules mustn't all look new.
export function zip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { name, bytes, time } of files) {
    const path = new TextEncoder().encode(name);
    const crc = crc32(bytes);
    const [dosT, dosD] = dosTime(time);
    // Fields shared by the local header (from offset 4) and the central directory entry (from offset 6)
    const fields = (view, at) => {
      [20, 0x0800, 0, dosT, dosD].forEach((v, i) => view.setUint16(at + 2 * i, v, true)); // version, flags, stored, time, date
      view.setUint32(at + 10, crc, true);
      view.setUint32(at + 14, bytes.length, true);
      view.setUint32(at + 18, bytes.length, true);
      view.setUint16(at + 22, path.length, true);
    };
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    fields(local, 4);
    parts.push(new Uint8Array(local.buffer), path, bytes);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    fields(entry, 6);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), path);
    offset += 30 + path.length + bytes.length;
  }
  const size = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  const out = new Uint8Array(offset + size + 22);
  let at = 0;
  for (const p of [...parts, ...central, new Uint8Array(end.buffer)]) out.set(p, (at += p.length) - p.length);
  return out;
}
