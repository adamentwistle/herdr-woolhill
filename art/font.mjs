// Turns the bitmap font in sprites.mjs into a TrueType file, so the app can use it like any font. Each lit pixel run is a
// square-cornered outline. The em is 8 art pixels, so text is sharpest at sizes that are multiples of 8.
import { FONT } from "./sprites.mjs";

const PX = 128, EM = PX * 8, ADVANCE = PX * 6, ASCENT = PX * 7, DESCENT = PX;
export const FAMILY = "Woolhill Pixel";

class Out {
  constructor() { this.bytes = []; }
  u8(v) { this.bytes.push(v & 255); return this; }
  u16(v) { return this.u8(v >> 8).u8(v); }
  i16(v) { return this.u16(v & 0xffff); }
  u32(v) { return this.u16(v >>> 16).u16(v & 0xffff); }
  raw(list) { for (const b of list) this.bytes.push(b); return this; }
  tag(text) { return this.raw(Buffer.from(text, "latin1")); }
  pad() { while (this.bytes.length % 4) this.bytes.push(0); return this; }
}

// Runs of lit pixels, as rectangles in font units with y going up.
function rectangles(rows) {
  const list = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < 5;) {
      if (row[x] !== "1") { x += 1; continue; }
      let end = x;
      while (end < 5 && row[end] === "1") end += 1;
      list.push({ left: (x + 0.5) * PX, right: (end + 0.5) * PX, top: (7 - y) * PX, bottom: (6 - y) * PX });
      x = end;
    }
  });
  return list;
}

function glyph(rects) {
  if (!rects.length) return [];
  const out = new Out();
  const xMin = Math.min(...rects.map((r) => r.left)), xMax = Math.max(...rects.map((r) => r.right));
  const yMin = Math.min(...rects.map((r) => r.bottom)), yMax = Math.max(...rects.map((r) => r.top));
  out.i16(rects.length).i16(xMin).i16(yMin).i16(xMax).i16(yMax);
  rects.forEach((_, i) => out.u16(i * 4 + 3));
  out.u16(0);
  const points = rects.flatMap((r) => [[r.left, r.bottom], [r.left, r.top], [r.right, r.top], [r.right, r.bottom]]);
  for (const _ of points) out.u8(1);
  let last = 0;
  for (const [x] of points) { out.i16(x - last); last = x; }
  last = 0;
  for (const [, y] of points) { out.i16(y - last); last = y; }
  if (out.bytes.length % 2) out.u8(0);
  return out.bytes;
}

function nameTable() {
  const names = [[1, FAMILY], [2, "Regular"], [3, `${FAMILY} 1`], [4, FAMILY], [5, "Version 1.0"], [6, FAMILY.replace(/ /g, "")]];
  const utf16 = (text) => [...text].flatMap((c) => [0, c.charCodeAt(0)]);
  const records = [];
  let offset = 0;
  const strings = [];
  for (const [platform, encoding, language, encode] of [[1, 0, 0, (t) => [...Buffer.from(t, "latin1")]], [3, 1, 0x409, utf16]]) {
    for (const [id, text] of names) {
      const bytes = encode(text);
      records.push([platform, encoding, language, id, bytes.length, offset]);
      strings.push(...bytes);
      offset += bytes.length;
    }
  }
  const out = new Out().u16(0).u16(records.length).u16(6 + records.length * 12);
  for (const record of records) for (const v of record) out.u16(v);
  return out.raw(strings).bytes;
}

function cmapTable(codes) {
  const sorted = [...codes.entries()].sort((a, b) => a[0] - b[0]);
  const segments = [...sorted.map(([code, id]) => ({ code, id })), { code: 0xffff, id: 0 }];
  const count = segments.length, log = Math.floor(Math.log2(count)), range = 2 * 2 ** log;
  const out = new Out().u16(0).u16(1).u16(3).u16(1).u32(12);
  out.u16(4).u16(16 + count * 8).u16(0).u16(count * 2).u16(range).u16(log).u16(count * 2 - range);
  for (const s of segments) out.u16(s.code);
  out.u16(0);
  for (const s of segments) out.u16(s.code);
  for (const s of segments) out.u16(s.code === 0xffff ? 1 : (s.id - s.code) & 0xffff);
  for (const _ of segments) out.u16(0);
  return out.bytes;
}

export function buildFont() {
  const letters = Object.keys(FONT);
  const notdef = glyph([{ left: 0.5 * PX, right: 5.5 * PX, top: 7 * PX, bottom: 0 }]);
  const glyphs = [notdef, ...letters.map((letter) => glyph(rectangles(FONT[letter])))];
  const codes = new Map();
  letters.forEach((letter, i) => {
    codes.set(letter.charCodeAt(0), i + 1);
    if (/[A-Z]/.test(letter)) codes.set(letter.toLowerCase().charCodeAt(0), i + 1);
  });

  const glyf = new Out(), offsets = [];
  for (const g of glyphs) {
    offsets.push(glyf.bytes.length);
    glyf.raw(g);
  }
  offsets.push(glyf.bytes.length);
  const loca = new Out();
  for (const at of offsets) loca.u32(at);

  const head = new Out().u32(0x00010000).u32(0x00010000).u32(0).u32(0x5f0f3cf5).u16(0b1011).u16(EM);
  head.u32(0).u32(0).u32(0).u32(0);
  head.i16(0).i16(-DESCENT).i16(ADVANCE).i16(ASCENT).u16(0).u16(8).i16(2).i16(1).i16(0);

  const hhea = new Out().u32(0x00010000).i16(ASCENT).i16(-DESCENT).i16(0).u16(ADVANCE).i16(0).i16(0).i16(ADVANCE).i16(1).i16(0).i16(0);
  for (let i = 0; i < 4; i++) hhea.i16(0);
  hhea.i16(0).u16(glyphs.length);

  const hmtx = new Out();
  for (const _ of glyphs) hmtx.u16(ADVANCE).i16(0);

  const maxp = new Out().u32(0x00010000).u16(glyphs.length).u16(64).u16(16).u16(0).u16(0).u16(2);
  for (let i = 0; i < 8; i++) maxp.u16(0);

  const os2 = new Out().u16(3).i16(ADVANCE).u16(400).u16(5).u16(0);
  for (let i = 0; i < 10; i++) os2.i16(0);
  os2.i16(0);
  for (let i = 0; i < 10; i++) os2.u8(0);
  os2.u32(0).u32(0).u32(0).u32(0).tag("WOOL").u16(0x40).u16(32).u16(122);
  os2.i16(ASCENT).i16(-DESCENT).i16(0).u16(ASCENT).u16(DESCENT).u32(1).u32(0).i16(PX * 5).i16(PX * 7).u16(0).u16(32).u16(0);

  const post = new Out().u32(0x00030000).u32(0).i16(-PX).i16(PX / 2).u32(1).u32(0).u32(0).u32(0).u32(0);

  const tables = { "OS/2": os2.bytes, cmap: cmapTable(codes), glyf: glyf.bytes, head: head.bytes, hhea: hhea.bytes, hmtx: hmtx.bytes, loca: loca.bytes, maxp: maxp.bytes, name: nameTable(), post: post.bytes };
  const tags = Object.keys(tables).sort();
  const log = Math.floor(Math.log2(tags.length));
  const file = new Out().u32(0x00010000).u16(tags.length).u16(16 * 2 ** log).u16(log).u16(tags.length * 16 - 16 * 2 ** log);
  const sum = (bytes) => {
    let total = 0;
    for (let i = 0; i < bytes.length; i += 4) total = (total + (((bytes[i] ?? 0) << 24) | ((bytes[i + 1] ?? 0) << 16) | ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0))) >>> 0;
    return total;
  };
  let offset = 12 + tags.length * 16;
  for (const tag of tags) {
    const bytes = tables[tag];
    file.tag(tag.padEnd(4, " ")).u32(sum(bytes)).u32(offset).u32(bytes.length);
    offset += Math.ceil(bytes.length / 4) * 4;
  }
  const headAt = () => {
    let at = 12 + tags.length * 16;
    for (const tag of tags) {
      if (tag === "head") return at;
      at += Math.ceil(tables[tag].length / 4) * 4;
    }
    return at;
  };
  for (const tag of tags) file.raw(tables[tag]).pad();
  const adjustment = (0xb1b0afba - sum(file.bytes)) >>> 0, at = headAt() + 8;
  file.bytes[at] = adjustment >>> 24;
  file.bytes[at + 1] = (adjustment >>> 16) & 255;
  file.bytes[at + 2] = (adjustment >>> 8) & 255;
  file.bytes[at + 3] = adjustment & 255;
  return Buffer.from(file.bytes);
}
