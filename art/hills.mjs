// The hillside: a far slope of walled fields, a nearer rise and the grass the flock stands on. One tile, seamless, for each
// season and each look. Every wave has a whole number of cycles across the tile, so its ends meet.
export const TILE_W = 256, TILE_H = 48;

const wave = (x, cycles, phase) => Math.sin((x / TILE_W) * Math.PI * 2 * cycles + phase);

// Slopes run from the far fields back to the ground: far1 far2 far3, rise top, rise, rise shade, grass top, grass, grass shade.
const LOOKS = {
  light: {
    spring: { fields: ["#a8d8a0", "#b9e0a0", "#94cf98", "#c6e4a4"], wall: "#7fae8c", riseTop: "#a5dc7c", rise: "#8ccb6c", riseShade: "#74b860", top: "#b2e682", grass: "#93d26c", shade: "#7cc060", deep: "#68ad57", speck: ["#f6b8c8", "#fff0a8", "#ffffff"] },
    summer: { fields: ["#9cc89a", "#b3cf8d", "#8abd92", "#c4d287"], wall: "#6f9c82", riseTop: "#8ecb68", rise: "#74b75a", riseShade: "#5fa552", top: "#9dd66c", grass: "#7cc05a", shade: "#68ad51", deep: "#569a4b", speck: ["#fff0a8", "#ffffff", "#c9e88a"] },
    autumn: { fields: ["#c9b878", "#d8a860", "#b8a870", "#dcbc70"], wall: "#94815c", riseTop: "#d4a850", rise: "#bf9044", riseShade: "#a77a3c", top: "#dcb45a", grass: "#c49a48", shade: "#ad843f", deep: "#957038", speck: ["#de8538", "#b4522e", "#f2b950"] },
    winter: { fields: ["#e4ecf2", "#dbe5ee", "#eef3f7", "#d3dfe9"], wall: "#9fb0c0", riseTop: "#f7fafc", rise: "#e3ebf2", riseShade: "#cfdbe6", top: "#ffffff", grass: "#eaf0f5", shade: "#d7e1ea", deep: "#c4d1dd", speck: ["#ffffff", "#b7c7d6", "#a7bccf"] },
  },
  dark: {
    spring: { fields: ["#35604f", "#3f6a50", "#2e5749", "#487253"], wall: "#274a42", riseTop: "#4f8a58", rise: "#3f774e", riseShade: "#336745", top: "#5f9f60", grass: "#478653", shade: "#3a7549", deep: "#2f6441", speck: ["#e39ab2", "#e8d890", "#d9e4d9"] },
    summer: { fields: ["#2e5a4c", "#39624a", "#285146", "#436b4a"], wall: "#214740", riseTop: "#468252", rise: "#376f49", riseShade: "#2c6041", top: "#55955a", grass: "#3f7d4e", shade: "#336d45", deep: "#285c3d", speck: ["#d8c878", "#cfdccf", "#7fae68"] },
    autumn: { fields: ["#5e5540", "#6e5a3a", "#544f40", "#74603c"], wall: "#443f34", riseTop: "#8a6c38", rise: "#755a33", riseShade: "#624c2f", top: "#997a3e", grass: "#806436", shade: "#6d5532", deep: "#5a472d", speck: ["#c0702f", "#94422a", "#d0a040"] },
    winter: { fields: ["#5d6f84", "#54667b", "#667990", "#4d5e73"], wall: "#3f4e60", riseTop: "#a4b6c8", rise: "#8799ac", riseShade: "#73859a", top: "#bfcfdd", grass: "#9db0c3", shade: "#8a9db1", deep: "#778a9f", speck: ["#e2ebf2", "#6f8296", "#5e7086"] },
  },
};

// A small seeded generator, so the tile is the same on every build.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

export function hillTile(season, look) {
  const c = LOOKS[look][season], w = TILE_W, h = TILE_H, px = new Uint8Array(w * h * 4);
  const put = (x, y, hex) => {
    const wrapped = ((x % w) + w) % w;
    if (y < 0 || y >= h) return;
    const i = (y * w + wrapped) * 4, [r, g, b] = rgb(hex);
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
  };
  const far = (x) => Math.round(14.5 + 3.4 * wave(x, 2, 0.6) + 1.6 * wave(x, 5, 2.1));
  const rise = (x) => Math.round(25.5 + 2.2 * wave(x, 3, 3.6) + 1 * wave(x, 7, 1.2));
  const grass = (x) => Math.round(32.5 + 1 * wave(x, 4, 0.2) + 0.6 * wave(x, 9, 4.0));

  // The far slope, cut into fields by walls that lean with the hill.
  const walls = [18, 47, 79, 104, 139, 171, 196, 233];
  const lean = (x, y) => x + (y - 14) * 0.8;
  const fieldAt = (x, y) => {
    const at = ((lean(x, y) % w) + w) % w;
    let n = walls.findIndex((v) => at < v);
    if (n < 0) n = 0;
    return (n + (y > 20 ? 1 : 0)) % c.fields.length;
  };
  for (let x = 0; x < w; x++) {
    for (let y = far(x); y < h; y++) put(x, y, c.fields[fieldAt(x, y)]);
    for (const v of walls) for (let y = far(x); y < 30; y++) if (Math.round(lean(x, y)) % w === v) put(x, y, c.wall);
    if ((x + far(x)) % 2 === 0) put(x, 20 + Math.round(wave(x, 2, 0.6)), c.wall);
    put(x, far(x), c.wall);
  }

  // The rise, with a lit edge and a band of shade dithered in under it.
  for (let x = 0; x < w; x++) {
    const top = rise(x);
    for (let y = top; y < h; y++) put(x, y, c.rise);
    put(x, top, c.riseTop);
    if (x % 2 === 0) put(x, top + 1, c.riseTop);
    for (let y = top + 3; y < top + 7; y++) if ((x + y) % 2 === 0 && y - top > 3 + ((x >> 3) % 2)) put(x, y, c.riseShade);
  }

  // The grass the flock stands on.
  for (let x = 0; x < w; x++) {
    const top = grass(x);
    for (let y = top; y < h; y++) put(x, y, c.grass);
    put(x, top, c.top);
    if ((x * 7) % 3 !== 0) put(x, top + 1, c.top);
    for (let y = h - 6; y < h; y++) if ((x + y) % 2 === 0 || y >= h - 3) put(x, y, y >= h - 2 ? c.deep : c.shade);
    if (x % 2 === 0) put(x, h - 7, c.shade);
  }

  // Tufts, and small things in the grass.
  const random = seeded(season.length * 977 + (look === "dark" ? 31 : 7));
  for (let n = 0; n < 200; n++) {
    const x = Math.floor(random() * w), y = 35 + Math.floor(random() * 12), tall = random() < 0.4;
    put(x, y, c.top);
    if (tall) {
      put(x - 1, y + 1, c.top);
      put(x + 1, y + 1, c.top);
    }
  }
  for (let n = 0; n < 44; n++) {
    const x = Math.floor(random() * w), y = 35 + Math.floor(random() * 12), colour = c.speck[n % c.speck.length];
    put(x, y, colour);
    if (n % 3 === 0) put(x + 1, y, colour);
  }
  return { w, h, px };
}
