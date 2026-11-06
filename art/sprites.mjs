// Every sprite in Woolhill, drawn by hand as text, one character a pixel. A sheep is stamped from parts (body, head, legs),
// so a frame differs from the last only where it should. `.` is empty. The colour keys are in the palettes below.

export const grid = (rows) => ({ w: Math.max(...rows.map((r) => r.length)), h: rows.length, rows });

export function canvas(w, h) {
  return { w, h, cells: Array.from({ length: h }, () => new Array(w).fill(".")) };
}

export function stamp(target, part, x, y) {
  part.rows.forEach((row, j) => [...row].forEach((c, i) => {
    if (c === "." || c === " ") return;
    const cx = x + i, cy = y + j;
    if (cx >= 0 && cy >= 0 && cx < target.w && cy < target.h) target.cells[cy][cx] = c;
  }));
  return target;
}

export function flip(picture) {
  return { ...picture, cells: picture.cells.map((row) => [...row].reverse()) };
}

// Colour keys to RGBA.
export function paint(picture, palette) {
  const px = new Uint8Array(picture.w * picture.h * 4);
  picture.cells.forEach((row, y) => row.forEach((c, x) => {
    if (c === ".") return;
    const hex = palette[c];
    if (!hex) throw new Error(`no colour for "${c}"`);
    const i = (y * picture.w + x) * 4;
    px[i] = parseInt(hex.slice(1, 3), 16);
    px[i + 1] = parseInt(hex.slice(3, 5), 16);
    px[i + 2] = parseInt(hex.slice(5, 7), 16);
    px[i + 3] = 255;
  }));
  return { w: picture.w, h: picture.h, px };
}

const LINE = "#33242f";

// Wool: h highlight, w body, s shade. Face: f, F its shadow, e eye, p inner ear and nose. Legs: l. Horn: n, N.
export const BREEDS = {
  cream: { name: "Cream", h: "#fffdf6", w: "#f5ecdc", s: "#d8c9b6", f: "#5c4a52", F: "#463741", e: "#17101a", p: "#d9988f", l: "#55434c", n: "#e6d6b4", N: "#b49d7c" },
  soot: { name: "Soot", h: "#6d6476", w: "#4f4759", s: "#3a3345", f: "#efe3d0", F: "#cdbda8", e: "#17101a", p: "#d9988f", l: "#2c2533", n: "#e6d6b4", N: "#b49d7c" },
  russet: { name: "Russet", h: "#e9a877", w: "#cf8450", s: "#a9623a", f: "#f3e3cc", F: "#d3bd9f", e: "#17101a", p: "#d9988f", l: "#6a4530", n: "#e6d6b4", N: "#b49d7c" },
  slate: { name: "Slate", h: "#c9d6e6", w: "#a5b6cc", s: "#7f92ad", f: "#37304a", F: "#292339", e: "#f5ecdc", p: "#c78ea0", l: "#37304a", n: "#e6d6b4", N: "#b49d7c" },
  ridge: { name: "Ridge", h: "#fbf3df", w: "#ece0c5", s: "#c9b892", f: "#3b2f35", F: "#2b2127", e: "#f2c14e", p: "#b98a70", l: "#3b2f35", n: "#f0dba8", N: "#b08a52" },
  gilt: { name: "Gilt", h: "#fff0a8", w: "#f6cf5c", s: "#d7a033", f: "#6a4a30", F: "#513722", e: "#17101a", p: "#e8a784", l: "#6a4a30", n: "#fff0a8", N: "#d7a033" },
};

export const sheepPalette = (breed) => ({ o: LINE, E: "#fff8ec", ...BREEDS[breed] });

const BODY = grid([
  "...oo..ooo..oo..",
  "..ohhoohhwoohwo.",
  ".ohhhwwhhwwwwwwo",
  "ohhwwwwwwwwwwwwo",
  "ohwwwwwwwwwwwwso",
  "owwwwwwwwwwwwsso",
  "owwwwwwwwwwswsso",
  ".owwswwwswwssso.",
  "..oosossosssoo..",
  "....o..oo.......",
]);

// The head, looking ahead. `n` horns are stamped over it for the Ridge.
const HEAD = grid([
  "..oooo...",
  ".offffoo.",
  "opoffffoo",
  "oFfEeffpo",
  ".oFffffpo",
  "..oFFFFo.",
  "...oooo..",
]);

const HEAD_ALERT = grid([
  "..o..o...",
  ".opoopo..",
  ".offffoo.",
  "oFfEeffpo",
  "oFfEeffpo",
  ".oFfffpo.",
  "..oooo...",
]);

const HEAD_DOWN = grid([
  ".oooo....",
  "offffoo..",
  "oFfEefpo.",
  ".oFffffpo",
  ".oFFffppo",
  "..ooFFoo.",
  "....oo...",
]);

const HEAD_CHEW = grid([
  ".oooo....",
  "offffoo..",
  "oFfEefpo.",
  ".oFffffpo",
  ".oFffffo.",
  "..oFFppo.",
  "...oooo..",
]);

const HEAD_SLEEP = grid([
  "..oooo...",
  ".offffoo.",
  "opoffffoo",
  "oFfoofppo",
  ".oFffffpo",
  "..oFFFFo.",
  "...oooo..",
]);

const HORNS = grid([
  ".nnn....",
  "nNoNn...",
  "nN..nn..",
  ".nn.....",
]);

const LEGS = {
  stand: grid(["..ll.......ll...", "..ll.......ll...", "..oo.......oo..."]),
  a: grid([".ll.........ll..", ".ll........ll...", ".oo........oo..."]),
  b: grid(["...ll.....ll....", "...ll.....ll....", "...oo.....oo...."]),
  c: grid(["..ll.......ll...", "..ll.......ll...", "..oo.......oo..."]),
  d: grid(["..ll.....ll.....", "...ll.....ll....", "...oo.....oo...."]),
};

const BODY_LOW = grid([
  "...oo..ooo..oo..",
  "..ohhoohhwoohwo.",
  ".ohhhwwhhwwwwwwo",
  "ohhwwwwwwwwwwwwo",
  "ohwwwwwwwwwwwwso",
  "owwwwwwwwwwwssso",
  ".owwwswwwswwsso.",
  "..oooooooooooo..",
]);

const SHEEP_W = 24, SHEEP_H = 15;

function sheep({ legs = "stand", head = HEAD, headX = 14, headY = 1, bob = 0, breed }) {
  const c = canvas(SHEEP_W, SHEEP_H);
  stamp(c, LEGS[legs], 1, 11 + 1);
  stamp(c, BODY, 1, 2 + bob + 1);
  stamp(c, head, headX, headY + bob + 1);
  if (breed === "ridge" && head !== HEAD_DOWN && head !== HEAD_CHEW) stamp(c, HORNS, headX - 1, headY + bob + 1);
  return c;
}

export function sheepFrames(breed) {
  const opts = { breed };
  return {
    stand: [sheep(opts)],
    alert: [sheep({ ...opts, head: HEAD_ALERT, headY: 0 })],
    walk: [
      sheep({ ...opts, legs: "a" }),
      sheep({ ...opts, legs: "c", bob: -1 }),
      sheep({ ...opts, legs: "b" }),
      sheep({ ...opts, legs: "d", bob: -1 }),
    ],
    graze: [
      sheep({ ...opts, head: HEAD_DOWN, headX: 14, headY: 6 }),
      sheep({ ...opts, head: HEAD_CHEW, headX: 14, headY: 6 }),
      sheep({ ...opts, head: HEAD_DOWN, headX: 14, headY: 6 }),
      sheep({ ...opts, head: HEAD, headX: 14, headY: 3 }),
    ],
    rest: [restPose(breed, false)],
    sleep: [restPose(breed, true)],
  };
}

function restPose(breed, asleep) {
  const c = canvas(SHEEP_W, SHEEP_H);
  stamp(c, BODY_LOW, 1, 7);
  const head = asleep ? HEAD_SLEEP : HEAD;
  stamp(c, head, 14, 6);
  if (breed === "ridge") stamp(c, HORNS, 13, 6);
  return c;
}

// The wolf, grey and long in the leg. a pale, g coat, G shade, d dark, e eye, t teeth.
export const WOLF_PALETTE = { o: "#241e33", a: "#b9b6cc", g: "#8884a3", G: "#625e80", d: "#47425f", e: "#f2c14e", t: "#f5ecdc", n: "#17101a" };

const WOLF_BODY = grid([
  "...........................",
  "oo.........................",
  "oGoo.......................",
  ".oGGoooooooooooooo.........",
  "..oGGggggggggggggGo........",
  "...oGgggggaggggggGGo.......",
  "...oGgggaaagggaggGGo.......",
  "....oGGaaaaaaaaagGo........",
  ".....ooooooooooooo.........",
]);

const WOLF_HEAD = grid([
  ".o.o....",
  "ogogo...",
  "oggggoo.",
  "ogegggao",
  "oGggaaan",
  ".oGaato.",
  "..oooo..",
]);

const WOLF_HEAD_LOW = grid([
  ".o.o....",
  "ogogoo..",
  "ogggggoo",
  "oGggeaan",
  ".oGgaaao",
  "..oooto.",
  "....oo..",
]);

const WOLF_LEGS = {
  stand: grid(["...dd.........dd..", "...dd.........dd..", "...oo.........oo.."]),
  a: grid(["..dd..........dd..", ".dd............dd.", ".oo............oo."]),
  b: grid(["....dd.......dd...", "....dd.......dd...", "....oo.......oo..."]),
  c: grid(["...dd.........dd..", "...dd.........dd..", "...oo.........oo.."]),
  d: grid(["....dd.....dd.....", ".....dd.....dd....", ".....oo.....oo...."]),
};

const WOLF_W = 28, WOLF_H = 14;

function wolf(legs, head, bob = 0, headY = 1) {
  const c = canvas(WOLF_W, WOLF_H);
  stamp(c, WOLF_LEGS[legs], 2, 11);
  stamp(c, WOLF_BODY, 0, 3 + bob);
  stamp(c, head, 18, headY + bob);
  return c;
}

export const wolfFrames = () => ({
  stand: [wolf("stand", WOLF_HEAD_LOW, 0, 3)],
  walk: [wolf("a", WOLF_HEAD_LOW, 0, 3), wolf("c", WOLF_HEAD_LOW, -1, 3), wolf("b", WOLF_HEAD_LOW, 0, 3), wolf("d", WOLF_HEAD_LOW, -1, 3)],
  run: [wolf("a", WOLF_HEAD, -1, 2), wolf("b", WOLF_HEAD, 0, 2), wolf("d", WOLF_HEAD, -1, 2), wolf("c", WOLF_HEAD, 0, 2)],
});

// The dog, black and white. k coat, K shade, w white, e eye, p tongue.
export const DOG_PALETTE = { o: "#1f1a26", k: "#3b3442", K: "#2a2431", w: "#f5ecdc", W: "#cfc2b0", e: "#17101a", p: "#e0787a", n: "#17101a" };

const DOG_SIT = grid([
  ".........oo.oo.",
  "........okoook.",
  "........okkkkko",
  ".o......okekwwn",
  "oko.....okwwwwo",
  "oko....okkwwpo.",
  ".okoooookkwwo..",
  "..okkkkkkkwwo..",
  "..okkkkkkwwwo..",
  "..okKkkkkwwwo..",
  "..oKKoKKowwwo..",
  "..oooooooooo...",
]);

const DOG_BODY = grid([
  ".........oo.oo.",
  "........okoook.",
  "........okkkkko",
  "o.......okekwwn",
  "ko......okwwwwo",
  "oko....okkwwpo.",
  ".okoooookkwwo..",
  "..okkkkkkkwwo..",
  "..oKkkkkkkKwo..",
  "...oooooooooo..",
]);

const DOG_LEGS = {
  a: grid(["..kk......ww.", ".kk........ww", ".oo........oo"]),
  b: grid(["...kk....ww..", "...kk....ww..", "...oo....oo.."]),
  c: grid(["..kk.....ww..", "..kk......ww.", "..oo......oo."]),
  d: grid(["....kk..ww...", "....kk..ww...", "....oo..oo..."]),
};

const DOG_W = 16, DOG_H = 13;

function dogTrot(legs, bob) {
  const c = canvas(DOG_W, DOG_H);
  stamp(c, DOG_LEGS[legs], 1, 10);
  stamp(c, DOG_BODY, 0, bob);
  return c;
}

export const dogFrames = () => ({
  sit: [stamp(canvas(DOG_W, DOG_H), DOG_SIT, 0, 1)],
  trot: [dogTrot("a", 1), dogTrot("b", 0), dogTrot("c", 1), dogTrot("d", 0)],
});

// A tuft of dropped wool, and the same one in the shop.
export const TUFT = grid([
  "...oooo..",
  "..ohhwwo.",
  ".ohhwwwso",
  "ohhwwwsso",
  "owwwwsso.",
  ".oosoooo.",
  "...oo....",
]);

export const FENCE_PALETTE = { o: "#3c2a26", b: "#a9825c", B: "#7d5c41", l: "#c9a57e" };

export const FENCE = grid([
  ".ol.............",
  ".olbo...........",
  "oobbooooooooooo.",
  "bbbBbbbbbbbbbbbo",
  "BBBBBBBBBBBBBBBo",
  "oobboooooooooo..",
  ".obBo...........",
  "oobbooooooooooo.",
  "bbbBbbbbbbbbbbbo",
  "BBBBBBBBBBBBBBBo",
  "oobbooooooooooo.",
  ".obBo...........",
  ".oooo...........",
]);

// Trees take their leaves from the season. L light, M middle, D dark, t trunk, T its shade.
export const SEASONS = {
  spring: { name: "Spring", L: "#c5e88a", M: "#96d06a", D: "#5ea85a", f: "#f6b8c8", F: "#e88aa8" },
  summer: { name: "Summer", L: "#97cf6a", M: "#62a955", D: "#3e7f4e", f: "#97cf6a", F: "#62a955" },
  autumn: { name: "Autumn", L: "#f2b950", M: "#de8538", D: "#b4522e", f: "#f2b950", F: "#de8538" },
  winter: { name: "Winter", L: "#f4f8fb", M: "#d3e0ea", D: "#a7bccf", f: "#f4f8fb", F: "#d3e0ea" },
};

const TREE_COLOURS = { o: "#2c2130", t: "#7a5540", T: "#573c32" };
export const treePalette = (season) => ({ ...TREE_COLOURS, ...SEASONS[season] });

export const TREE = grid([
  ".........oooooo.........",
  ".......ooLLLMMMoo.......",
  "......oLLLLLMMMMMo......",
  "....ooLLLfLLMMMMMMoo....",
  "...oLLLLLLLMMMMfMMMMo...",
  "..oLLLLLLMMMMMMMMMMMDo..",
  "..oLLfLLMMMMMMMMMMDDDo..",
  ".oLLLLMMMMMMMfMMMDDDDDo.",
  ".oLLMMMMMMMMMMMMMDDDDDo.",
  ".oMMMMMMfMMMMMMDDDDDDDo.",
  "oLMMMMMMMMMMMMDDDDfDDDDo",
  "oMMMMMMMMMMMDDDDDDDDDDDo",
  "oMMMfMMMMMDDDDDDDDDDDDDo",
  ".oMMMMMDDDDDDDDFDDDDDDo.",
  ".oDDDDDDDDDDDDDDDDDDDDo.",
  "..ooDDDDDDtTtDDDDDDDoo..",
  "....oooDDDtTTDDDoooo....",
  ".......ooottToooo.......",
  "..........ttT...........",
  "..........ttT...........",
  ".........ottTo..........",
  ".........ottTTo.........",
  "........ooooooo.........",
]);

export const PINE = grid([
  "........oo........",
  ".......oLMo.......",
  "......oLLMDo......",
  ".....oLLMMDDo.....",
  "......oMMMDo......",
  ".....oLLMMDDo.....",
  "....oLLMMMDDDo....",
  "...oLLLMMMDDDDo...",
  ".....ooMMDDoo.....",
  "....oLLMMMDDDo....",
  "...oLLLMMMDDDDo...",
  "..oLLMMMMMDDDDDo..",
  ".oLLMMMMMDDDDDDDo.",
  "...ooMMMDDDDDoo...",
  "..oLLMMMMDDDDDDo..",
  ".oLLMMMMMMDDDDDDo.",
  "oLMMMMMMMDDDDDDDDo",
  ".ooooDDDDDDDDoooo.",
  ".....ooottToo.....",
  "........ttT.......",
  ".......ottTo......",
  ".......ooooo......",
]);

export const BARN_PALETTE = { o: "#2c2130", r: "#c0483c", R: "#96352f", q: "#6d2629", w: "#f5ecdc", W: "#cfc2b0", s: "#58506a", S: "#433c54", T: "#6f6585", y: "#f6cf5c", Y: "#d7a033", d: "#3f2d2a" };

export const BARN = grid([
  "...............oooooooo...............",
  ".............ooTTTTTTTToo.............",
  "...........ooTTsssssssSSSoo...........",
  ".........ooTTsssssssssSSSSSoo.........",
  ".......ooTTssssswwwwsSSSSSSSSoo.......",
  ".....ooTTsssssswyyyYwSSSSSSSSSSoo.....",
  "...ooTTssssssssswyyYwSSSSSSSSSSSSoo...",
  ".ooTTsssssssssssswwwSSSSSSSSSSSSSSSoo.",
  "ooooooooooooooooooooooooooooooooooooooo",
  "..wrrrrrrrrrrrrrrrrrrrRRRRRRRRRRRRRw..",
  "..wrrqrrrqrrrqrrrqrrrRqRRRqRRRqRRRRw..",
  "..wrrqrrrqrrrqrrrqrrrRqRRRqRRRqRRRRw..",
  "..wrrqrwwwwwwwwwwwwwwwwwwwwwwqRRRRRw..",
  "..wrrqrwWddddddddddddddddddWwqRRRRRw..",
  "..wrrqrwdwddddddddddddddddwdwqRRRRRw..",
  "..wrrqrwddwddddddddddddddwddwqRRRRRw..",
  "..wrrqrwdddwddddddddddddwdddwqRRRRRw..",
  "..wrrqrwddddwddddddddddwddddwqRRRRRw..",
  "..wrrqrwdddddwddddddddwdddddwqRRRRRw..",
  "..wrrqrwddddddwddddddwddddddwqRRRRRw..",
  "..wrrqrwdddddddwwwwwwdddddddwqRRRRRw..",
  "..wrrqrwddddddwddddddwddddddwqRRRRRw..",
  "..wrrqrwdddddwddddddddwdddddwqRRRRRw..",
  "..wrrqrwddddwddddddddddwddddwqRRRRRw..",
  "..wrrqrwdddwddddddddddddwdddwqRRRRRw..",
  "..ooooooooooooooooooooooooooooooooo...",
]);

// Sky things. c cloud light, C its shade.
export const CLOUD_PALETTE = { c: "#ffffff", C: "#dce8f2" };
export const CLOUD_DIM = { c: "#8f98b4", C: "#6d7694" };
export const STAR_PALETTE = { a: "#f4f0dc", b: "#a9b4d4", c: "#6f7aa0" };

export const STARS = grid([
  "........................................................................b.....",
  "...a.............c.............................c...................a...........",
  "..............................b....................a...........................",
  ".........b...............................c.....................................",
  "...............................................................c...........b...",
  "......................a..............b.........................................",
  "...c.......................................................a...................",
  "..................................c...........b.........................c......",
  "..........a....................................................................",
  "...........................c...................................b...............",
  "........................................a......................................",
  "..b..............b....................................c................a.......",
]);

export const CLOUD_A = grid([
  ".........cccc...........",
  ".......cccccccc..ccc....",
  "...cccccccccccccccccc...",
  "..cccccccccccccccccccccc",
  ".CCCcccccccccccccccCCCCC",
  "..CCCCCCCCCCCCCCCCCCCC..",
]);

export const CLOUD_B = grid([
  "......ccc.......",
  "...ccccccccc....",
  ".ccccccccccccc..",
  "CCCcccccccccCCCC",
  ".CCCCCCCCCCCCC..",
]);

export const SUN_PALETTE = { y: "#fff0a8", Y: "#f6cf5c", z: "#f0a93c" };

export const SUN = grid([
  "....YYYY....",
  "..YYyyyyYY..",
  ".YyyyyyyyyY.",
  ".YyyyyyyyyY.",
  "YyyyyyyyyyyY",
  "YyyyyyyyyyyY",
  "YyyyyyyyyyyY",
  "YyyyyyyyyyyY",
  ".YyyyyyyyyY.",
  ".YyyyyyyyyY.",
  "..YYyyyyYY..",
  "....YYYY....",
]);

export const MOON_PALETTE = { m: "#f4f0dc", M: "#cfcbb6", d: "#b3af9c" };

export const MOON = grid([
  "....mmmm....",
  "..mmmmmmMM..",
  ".mmmmdmmmMM.",
  ".mmmmmmmmMM.",
  "mmdmmmmmmmMM",
  "mmmmmmmdmmMM",
  "mmmmmmmmmmMM",
  "mmmmdmmmmMMM",
  ".mmmmmmmmMM.",
  ".mmmmmmmMMM.",
  "..mmmmMMMM..",
  "....MMMM....",
]);

export const ZZZ_PALETTE = { z: "#f5ecdc", o: "#33242f" };

// The pond. a deep water, b water, c shine, r reed, R its head, s stone, S its shade, i ice.
export const pondPalette = (season) => (season === "winter"
  ? { o: "#6f8aa3", a: "#bcd3e4", b: "#d8e7f1", c: "#ffffff", r: "#8a7a5e", R: "#5e5140", s: "#c8d2da", S: "#9eabb6" }
  : { o: "#2f4f6b", a: "#4f8fb8", b: "#6fb2d0", c: "#d7f0f4", r: season === "autumn" ? "#b08a3e" : "#5ea85a", R: "#7a5540", s: "#a9a4ad", S: "#7f7a86" });

export const POND = grid([
  "..........R.....R.....................",
  "..........r..R..r.....................",
  ".........oroorooroooooooooooo.........",
  ".....oooobbbbbbbbbbbbbbbbbbbboooo.....",
  "...oobbbbbbbbbccbbbbbbbbbbbbbbbbboo...",
  ".obbbbbbaaaaaaaaaaaaaabbbbbbcccbbbbo..",
  "obbcccbaaaaaaaaaaaaaaaaaabbbbbbbbbbbo.",
  "obbbbbaaaaaaaaccccaaaaaaaaaabbbbbbbbo.",
  ".obbbbbbaaaaaaaaaaaaaaaaaabbbbbbbbsS..",
  "..oobbbbbbbbbbbbbbbbbbbbbbbbbbboosSSS.",
  ".....oooooobbbbbbbbbbbboooooooo.......",
  "...........oooooooooooo...............",
]);

// A small bitmap font, five wide and seven tall, for the card and the wordmark.
export const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"], B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"], D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"], F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"], H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"], J: ["00111", "00001", "00001", "00001", "00001", "10001", "01110"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"], L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"], N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"], P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"], R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"], T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"], V: ["10001", "10001", "10001", "10001", "01010", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"], X: ["10001", "01010", "01010", "00100", "01010", "01010", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"], Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10011", "10101", "10101", "10101", "11001", "01110"], 1: ["00100", "01100", "10100", "00100", "00100", "00100", "11111"],
  2: ["01110", "10001", "00001", "00110", "01000", "10000", "11111"], 3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"], 5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"], 7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"], 9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"], ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"], "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"], "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"], "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};
