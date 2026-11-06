// The flock card: a PNG drawn pixel by pixel in this file, because a mod has no canvas and Woolhill runs no helper program. It
// holds game numbers and art, and nothing about any project. A render or a task is stopped at about 55 ms and this engine
// is slow, so the work is a list of small steps with a pause between each, as `main.js` runs them.
//
// `fs.writeFile` writes an empty file for a Uint8Array on Herdr 0.1.13, though it reports success. So the card leaves here as
// base64 text, and a tool the system already has turns that into the PNG. See `decodeCommand`.
import { ART } from "./cardart.js";
import { breedsOwned, count, span } from "./game.js";

export const CARD_W = 1200, CARD_H = 628;
const BY = 4, W = CARD_W / BY, H = CARD_H / BY;
const SCENE_TOP = H - ART.tile.h;
const ROWS_PER_STEP = 2;

const INK = "#15111c", PANEL = "#211a2b", LINE = "#3a2f47", WORDS = "#f4e9d8", AMBER = "#f2b950", DIM = "#8c7f9a";

const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

// Colours become palette numbers as they're first used, so the PNG can hold one byte a pixel.
function picture() {
  const palette = [], known = new Map(), px = new Uint8Array(W * H);
  const index = (hex) => {
    let n = known.get(hex);
    if (n === undefined) {
      n = palette.length;
      known.set(hex, n);
      palette.push(hex);
    }
    return n;
  };
  return { palette, px, index };
}

function fillRect(p, x, y, w, h, hex) {
  const n = p.index(hex);
  for (let j = Math.max(0, y); j < Math.min(H, y + h); j++) p.px.fill(n, j * W + Math.max(0, x), j * W + Math.min(W, x + w));
}

function sprite(p, art, x, y) {
  const numbers = {};
  for (const key of Object.keys(art.palette)) numbers[key] = p.index(art.palette[key]);
  art.rows.forEach((row, j) => {
    const py = y + j;
    if (py < 0 || py >= H) return;
    for (let i = 0; i < row.length; i++) {
      const c = row[i], pixel = x + i;
      if (c !== "." && pixel >= 0 && pixel < W) p.px[py * W + pixel] = numbers[c];
    }
  });
}

const CHAR_W = 6;
export const textWidth = (text, size = 1) => text.length * CHAR_W * size;

function text(p, words, x, y, hex, size = 1) {
  const n = p.index(hex);
  [...words.toUpperCase()].forEach((letter, at) => {
    const glyph = ART.font[letter] ?? ART.font[" "];
    for (let j = 0; j < 7; j++) {
      for (let i = 0; i < 5; i++) {
        if (glyph[j * 5 + i] !== "1") continue;
        const left = x + (at * CHAR_W + i) * size, top = y + j * size;
        for (let b = 0; b < size; b++) p.px.fill(n, (top + b) * W + left, (top + b) * W + left + size);
      }
    }
  });
}

function tile(p, x, y, w, value, label) {
  fillRect(p, x, y, w, 26, LINE);
  fillRect(p, x + 1, y + 1, w - 2, 24, PANEL);
  text(p, value, x + 6, y + 5, WORDS);
  text(p, label, x + 6, y + 15, DIM);
}

function scene(p, model) {
  const { state } = model, has = (id) => state.owned.includes(id), season = state.season;
  for (let x = 0; x < W; x += ART.tile.w) sprite(p, ART.hill[season], x, SCENE_TOP);
  const feet = (row, height) => SCENE_TOP + row - height;
  if (has("tree-3")) {
    sprite(p, ART.season[season].tree, 176, feet(31, 23));
    sprite(p, ART.season[season].pine, 192, feet(31, 22));
  }
  if (has("tree-2")) sprite(p, ART.season[season].pine, 96, feet(31, 22));
  if (has("tree-1")) sprite(p, ART.season[season].tree, 72, feet(32, 23));
  const posts = has("fence-3") ? 19 : has("fence-2") ? 8 : has("fence-1") ? 3 : 0;
  for (let n = 0; n < posts; n++) sprite(p, ART.fence, (has("fence-3") ? 0 : 118) + n * 16, feet(36, 13));
  if (has("barn")) sprite(p, ART.barn, 240, feet(37, 26));
  if (has("pond")) sprite(p, ART.season[season].pond, 150, feet(40, 12));
  const breeds = breedsOwned(state), flock = Math.max(1, Math.min(7, state.peak));
  for (let n = 0; n < flock; n++) sprite(p, ART.sheep[breeds[n % breeds.length]], 8 + n * 37 + (n % 2) * 6, feet(n % 2 ? 44 : 47, 15));
  if (has("dog")) sprite(p, ART.dog, 272, feet(47, 13));
}

// `model` is the state and when it was drawn. Run each step in turn, then `bytes` holds the file.
export function makeCard(model) {
  const p = picture(), { state } = model, made = { bytes: null };
  const steps = [
    () => fillRect(p, 0, 0, W, H, INK),
    () => {
      text(p, "Woolhill", 12, 10, WORDS, 2);
      const corner = model.demo ? "Sample flock" : "For Herdr";
      text(p, corner, W - 12 - textWidth(corner), 14, DIM);
      fillRect(p, 12, 30, W - 24, 1, LINE);
    },
    () => {
      text(p, "Lifetime wool", 12, 37, DIM);
      text(p, count(state.lifetime), 12, 48, AMBER, 4);
    },
    () => {
      const x = 156, w = 64;
      tile(p, x, 37, w, count(state.wolves), "Wolves");
      tile(p, x + w + 4, 37, w, span(state.longestMs), "Long run");
      tile(p, x, 66, w, count(state.turns), "Turns");
      tile(p, x + w + 4, 66, w, count(state.peak), "At once");
    },
    () => fillRect(p, 0, SCENE_TOP, W, H - SCENE_TOP, "#a0d4f0"),
    () => scene(p, model),
  ];
  const encoder = pngSteps(p, (bytes) => { made.bytes = bytes; });
  const pieces = [];
  const spell = [...Array(Math.ceil(CARD_BYTES_MOST / BASE64_PIECE)).keys()].map((n) => () => { pieces[n] = toBase64(made.bytes.subarray(n * BASE64_PIECE, (n + 1) * BASE64_PIECE)); });
  return { steps: [...steps, ...encoder, ...spell, () => { made.base64 = pieces.join(""); }], made };
}

// Whole groups of three bytes at a time, so the pieces join into one base64 text. The file is a little over one byte a pixel,
// and a piece past its end is empty.
const BASE64_PIECE = 24576;
const CARD_BYTES_MOST = (CARD_W + 1) * CARD_H + 4096;

export function toBase64(bytes) {
  let out = "";
  for (let at = 0; at < bytes.length; at += BASE64_PIECE) out += btoa(String.fromCharCode.apply(null, bytes.subarray(at, at + BASE64_PIECE)));
  return out;
}

// How this system turns base64 text into a file, using only what ships with it.
export function decodeCommand(platform, from, to) {
  if (platform === "windows") return ["certutil", ["-f", "-decode", from, to]];
  if (platform === "macos") return ["base64", ["-D", "-i", from, "-o", to]];
  return ["sh", ["-c", 'base64 -d "$1" > "$2"', "sh", from, to]];
}

const CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const be32 = (out, at, value) => {
  out[at] = value >>> 24;
  out[at + 1] = (value >>> 16) & 255;
  out[at + 2] = (value >>> 8) & 255;
  out[at + 3] = value & 255;
};

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  be32(out, 0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  let c = 0xffffffff;
  for (let i = 4; i < 8 + data.length; i++) c = CRC[(c ^ out[i]) & 255] ^ (c >>> 8);
  be32(out, 8 + data.length, (c ^ 0xffffffff) >>> 0);
  return out;
}

const MAX_BLOCK = 65535;

// One PNG, 8-bit palette, scaled up by BY. The image is stored in zlib without compressing, because compressing here would
// cost more than the file is worth. Each step starts from `mark` and only moves it when it finishes, so a step Herdr stopped
// halfway can simply run again.
function pngSteps(p, done) {
  const rowBytes = CARD_W + 1, raw = rowBytes * CARD_H, blocks = Math.ceil(raw / MAX_BLOCK);
  const file = new Uint8Array(8 + raw + blocks * 5 + 6);
  const idat = [73, 68, 65, 84];
  let start = 0xffffffff;
  for (const b of idat) start = CRC[(start ^ b) & 255] ^ (start >>> 8);
  file[0] = 0x78;
  file[1] = 0x01;
  start = CRC[(start ^ 0x78) & 255] ^ (start >>> 8);
  start = CRC[(start ^ 0x01) & 255] ^ (start >>> 8);
  const mark = { at: 2, written: 0, a: 1, b: 0, crc: start };

  const encode = (from, to) => {
    let { at, written, a, b, crc } = mark;
    const raw8 = (value) => {
      file[at++] = value;
      crc = CRC[(crc ^ value) & 255] ^ (crc >>> 8);
    };
    const put = (value) => {
      if (written % MAX_BLOCK === 0) {
        const size = Math.min(MAX_BLOCK, raw - written);
        raw8(size === raw - written ? 1 : 0);
        raw8(size & 255);
        raw8(size >> 8);
        raw8(~size & 255);
        raw8((~size >> 8) & 255);
      }
      raw8(value);
      written += 1;
      a += value;
      if (a >= 65521) a -= 65521;
      b += a;
      if (b >= 65521) b -= 65521;
    };
    for (let y = from; y < to; y++) {
      const base = y * W;
      for (let copy = 0; copy < BY; copy++) {
        put(0);
        for (let x = 0; x < W; x++) {
          const value = p.px[base + x];
          for (let n = 0; n < BY; n++) put(value);
        }
      }
    }
    Object.assign(mark, { at, written, a, b, crc });
  };

  const steps = [];
  for (let from = 0; from < H; from += ROWS_PER_STEP) {
    const taken = { from };
    steps.push(() => {
      if (taken.ran) return;
      encode(taken.from, Math.min(H, taken.from + ROWS_PER_STEP));
      taken.ran = true;
    });
  }
  steps.push(() => {
    let { at, crc } = mark;
    const sum = new Uint8Array(4);
    be32(sum, 0, ((mark.b << 16) | mark.a) >>> 0);
    for (const value of sum) {
      file[at++] = value;
      crc = CRC[(crc ^ value) & 255] ^ (crc >>> 8);
    }
    const header = new Uint8Array(13);
    be32(header, 0, CARD_W);
    be32(header, 4, CARD_H);
    header[8] = 8;
    header[9] = 3;
    const colours = new Uint8Array(p.palette.length * 3);
    p.palette.forEach((hex, i) => colours.set(rgb(hex), i * 3));
    const sign = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const head = chunk("IHDR", header), plte = chunk("PLTE", colours), end = chunk("IEND", new Uint8Array(0));
    const out = new Uint8Array(sign.length + head.length + plte.length + 12 + at + end.length);
    let to = 0;
    for (const part of [sign, head, plte]) {
      out.set(part, to);
      to += part.length;
    }
    be32(out, to, at);
    out.set(idat, to + 4);
    out.set(file.subarray(0, at), to + 8);
    be32(out, to + 8 + at, (crc ^ 0xffffffff) >>> 0);
    out.set(end, to + 12 + at);
    done(out);
  });
  return steps;
}
