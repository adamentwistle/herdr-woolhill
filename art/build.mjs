// Writes every picture in mods/woolhill/art, and the pixel data the card needs in mods/woolhill/cardart.js. Run it with
// `node art/build.mjs`. It uses only Node. Art is drawn small and written at 6 pixels to an art pixel, because the app scales
// images smoothly and a small file would blur.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gif, png, scale } from "./encode.mjs";
import * as A from "./sprites.mjs";
import { buildFont } from "./font.mjs";
import { hillTile, TILE_H, TILE_W } from "./hills.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = join(root, "mods", "woolhill", "art");
const BY = 6;

rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const sprite = (g) => A.stamp(A.canvas(g.w, g.h), g, 0, 0);
const still = (name, picture, palette) => writeFileSync(join(dir, `${name}.png`), png(scale(A.paint(picture, palette), BY)));
const moving = (name, frames, palette, ms) => writeFileSync(join(dir, `${name}.gif`), gif(frames.map((f) => scale(A.paint(f, palette), BY)), [ms]));

// Both ways round, so a sprite never has to be turned at run time. Art faces right as drawn.
function bothWays(name, frames, palette, ms) {
  if (frames.length === 1) {
    still(`${name}-r`, frames[0], palette);
    still(`${name}-l`, A.flip(frames[0]), palette);
  } else {
    moving(`${name}-r`, frames, palette, ms);
    moving(`${name}-l`, frames.map(A.flip), palette, ms);
  }
}

for (const breed of Object.keys(A.BREEDS)) {
  const frames = A.sheepFrames(breed), palette = A.sheepPalette(breed);
  bothWays(`sheep-${breed}-stand`, frames.stand, palette);
  bothWays(`sheep-${breed}-alert`, frames.alert, palette);
  bothWays(`sheep-${breed}-rest`, frames.rest, palette);
  bothWays(`sheep-${breed}-sleep`, frames.sleep, palette);
  bothWays(`sheep-${breed}-walk`, frames.walk, palette, 170);
  bothWays(`sheep-${breed}-graze`, frames.graze, palette, 420);
}

const wolf = A.wolfFrames();
bothWays("wolf-stand", wolf.stand, A.WOLF_PALETTE);
bothWays("wolf-walk", wolf.walk, A.WOLF_PALETTE, 220);
bothWays("wolf-run", wolf.run, A.WOLF_PALETTE, 90);

const dog = A.dogFrames();
bothWays("dog-sit", dog.sit, A.DOG_PALETTE);
bothWays("dog-trot", dog.trot, A.DOG_PALETTE, 120);

still("tuft", sprite(A.TUFT), A.sheepPalette("cream"));
still("fence", sprite(A.FENCE), A.FENCE_PALETTE);
still("barn", sprite(A.BARN), A.BARN_PALETTE);
still("sun", sprite(A.SUN), A.SUN_PALETTE);
still("moon", sprite(A.MOON), A.MOON_PALETTE);
still("cloud-a", sprite(A.CLOUD_A), A.CLOUD_PALETTE);
still("cloud-b", sprite(A.CLOUD_B), A.CLOUD_PALETTE);
still("cloud-a-dim", sprite(A.CLOUD_A), A.CLOUD_DIM);
still("cloud-b-dim", sprite(A.CLOUD_B), A.CLOUD_DIM);
still("stars", sprite(A.STARS), A.STAR_PALETTE);

for (const season of Object.keys(A.SEASONS)) {
  still(`tree-${season}`, sprite(A.TREE), A.treePalette(season));
  still(`pine-${season}`, sprite(A.PINE), A.treePalette(season));
  still(`pond-${season}`, sprite(A.POND), A.pondPalette(season));
  for (const look of ["light", "dark"]) {
    const tile = hillTile(season, look);
    writeFileSync(join(dir, `hill-${look}-${season}.png`), png(scale(tile, BY)));
  }
}

// The card is drawn at run time from the owner's flock, so it needs the art as data. Each is a palette and rows of letters,
// in the same shape as the sprites above.
const pack = (picture, palette) => ({ w: picture.w, h: picture.h, rows: picture.cells.map((row) => row.join("")), palette });
const packed = { sheep: {}, season: {}, hill: {} };
for (const breed of Object.keys(A.BREEDS)) packed.sheep[breed] = pack(A.sheepFrames(breed).stand[0], A.sheepPalette(breed));
for (const season of Object.keys(A.SEASONS)) {
  packed.season[season] = { tree: pack(sprite(A.TREE), A.treePalette(season)), pine: pack(sprite(A.PINE), A.treePalette(season)), pond: pack(sprite(A.POND), A.pondPalette(season)) };
  packed.hill[season] = packTile(hillTile(season, "light"));
}
packed.wolf = pack(wolf.stand[0], A.WOLF_PALETTE);
packed.dog = pack(dog.sit[0], A.DOG_PALETTE);
packed.barn = pack(sprite(A.BARN), A.BARN_PALETTE);
packed.fence = pack(sprite(A.FENCE), A.FENCE_PALETTE);
packed.tuft = pack(sprite(A.TUFT), A.sheepPalette("cream"));
packed.font = Object.fromEntries(Object.entries(A.FONT).map(([k, v]) => [k, v.join("")]));
packed.tile = { w: TILE_W, h: TILE_H };

// A hill tile has many colours and no letters, so it goes as a palette of hex and one letter a pixel.
function packTile({ w, h, px }) {
  const palette = {}, names = new Map(), keys = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const rows = [];
  for (let y = 0; y < h; y++) {
    let row = "";
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i + 3] < 128) { row += "."; continue; }
      const hex = `#${[px[i], px[i + 1], px[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      if (!names.has(hex)) {
        const key = keys[names.size];
        if (!key) throw new Error("too many colours in a hill tile");
        names.set(hex, key);
        palette[key] = hex;
      }
      row += names.get(hex);
    }
    rows.push(row);
  }
  return { w, h, rows, palette };
}

mkdirSync(join(root, "mods", "woolhill", "fonts"), { recursive: true });
writeFileSync(join(root, "mods", "woolhill", "fonts", "WoolhillPixel.ttf"), buildFont());

writeFileSync(join(root, "mods", "woolhill", "cardart.js"), `// Written by art/build.mjs. Do not edit.\nexport const ART = ${JSON.stringify(packed)};\n`);
