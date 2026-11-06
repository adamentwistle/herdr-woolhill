// PNG and GIF writers for the sprite build. Pictures are { w, h, px } with px a Uint8Array of RGBA.
import { deflateSync } from "node:zlib";

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}

export function png({ w, h, px }) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(px.buffer, px.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

function lzw(indices, minCode) {
  const clear = 1 << minCode, end = clear + 1, out = [];
  let size = minCode + 1, next = end + 1, bits = 0, count = 0, table = new Map();
  const put = (code) => {
    bits |= code << count;
    count += size;
    while (count >= 8) {
      out.push(bits & 255);
      bits >>>= 8;
      count -= 8;
    }
  };
  put(clear);
  let run = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const key = run * 256 + indices[i], known = table.get(key);
    if (known !== undefined) {
      run = known;
      continue;
    }
    put(run);
    if (next < 4096) {
      table.set(key, next);
      if (next === 1 << size && size < 12) size += 1;
      next += 1;
    } else {
      put(clear);
      table = new Map();
      size = minCode + 1;
      next = end + 1;
    }
    run = indices[i];
  }
  put(run);
  put(end);
  if (count > 0) out.push(bits & 255);
  return out;
}

// One palette for all frames, index 0 transparent, each frame cleared before the next. `delays` are in milliseconds.
export function gif(frames, delays) {
  const { w, h } = frames[0], colours = new Map(), list = [[0, 0, 0]];
  const pixels = frames.map(({ px }) => {
    const row = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (px[i * 4 + 3] < 128) continue;
      const key = (px[i * 4] << 16) | (px[i * 4 + 1] << 8) | px[i * 4 + 2];
      if (!colours.has(key)) {
        colours.set(key, list.length);
        list.push([px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]);
      }
      row[i] = colours.get(key);
    }
    return row;
  });
  if (list.length > 256) throw new Error(`a gif can hold 256 colours, this one has ${list.length}`);
  let depth = 1;
  while (1 << depth < list.length) depth += 1;
  const bytes = [...Buffer.from("GIF89a"), w & 255, w >> 8, h & 255, h >> 8, 0xf0 | (depth - 1), 0, 0];
  for (let i = 0; i < 1 << depth; i++) bytes.push(...(list[i] ?? [0, 0, 0]));
  bytes.push(0x21, 0xff, 11, ...Buffer.from("NETSCAPE2.0"), 3, 1, 0, 0, 0);
  pixels.forEach((row, n) => {
    const delay = Math.round(delays[n % delays.length] / 10);
    bytes.push(0x21, 0xf9, 4, 0x09, delay & 255, delay >> 8, 0, 0);
    bytes.push(0x2c, 0, 0, 0, 0, w & 255, w >> 8, h & 255, h >> 8, 0);
    const minCode = Math.max(2, depth);
    const data = lzw(row, minCode);
    bytes.push(minCode);
    for (let i = 0; i < data.length; i += 255) {
      const part = data.slice(i, i + 255);
      bytes.push(part.length);
      for (const b of part) bytes.push(b);
    }
    bytes.push(0);
  });
  bytes.push(0x3b);
  return Buffer.from(bytes);
}

// Whole-number scaling, one art pixel to a square of `by`.
export function scale({ w, h, px }, by) {
  const out = new Uint8Array(w * by * h * by * 4);
  for (let y = 0; y < h * by; y++) {
    for (let x = 0; x < w * by; x++) {
      const from = (Math.floor(y / by) * w + Math.floor(x / by)) * 4, to = (y * w * by + x) * 4;
      out[to] = px[from];
      out[to + 1] = px[from + 1];
      out[to + 2] = px[from + 2];
      out[to + 3] = px[from + 3];
    }
  }
  return { w: w * by, h: h * by, px: out };
}
