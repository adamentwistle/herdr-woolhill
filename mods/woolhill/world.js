// The hill itself: the sky for the hour, and where everything bought stands.
export const ART = 3;
export const STRIP_ROWS = 48;
export const TILE_PX = 256 * ART;

// `on_size_change` reports window pixels, and everything drawn is in the app's own units, which the zoom scales.
export function appSize(size, zoom) {
  const scale = zoom > 0 ? zoom : 1;
  return { width: size.width / scale, height: size.height / scale };
}

export function phaseAt(hour) {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

// Flat bands from the top of the sky to the hills, as pixel art would have it. `shade` goes over the whole hill.
const SKIES = {
  light: {
    dawn: { bands: ["#8fa8d8", "#b5b4dc", "#dcbcd4", "#f4c8bc", "#fcd8b0", "#fde8c0"], shade: "#f08a5030" },
    day: { bands: ["#8ec8ec", "#a0d4f0", "#b4dff3", "#c6e8f5", "#d8eff6", "#e6f4f4"], shade: null },
    dusk: { bands: ["#5a5a9c", "#8a64a4", "#c06f98", "#e88a7c", "#f8a868", "#fcc878"], shade: "#b0407048" },
    night: { bands: ["#141a3c", "#1a2248", "#202a54", "#283460", "#2f3e6c", "#384a78"], shade: "#10184870" },
  },
  dark: {
    dawn: { bands: ["#232a4a", "#3a3558", "#5a4262", "#805064", "#a46462", "#c07e64"], shade: "#c8603040" },
    day: { bands: ["#1f3a52", "#28485f", "#32566b", "#3e6578", "#4c7584", "#5c8590"], shade: null },
    dusk: { bands: ["#1c1c44", "#30234e", "#4c2c56", "#70385a", "#964858", "#b85e54"], shade: "#70205048" },
    night: { bands: ["#0a0d20", "#0e1228", "#121730", "#161d3a", "#1b2344", "#212a4e"], shade: "#0a103074" },
  },
};

export const skyFor = (look, phase) => SKIES[look][phase];

// Where the sun or the moon sits, from the clock: `across` from 0 at one end of its arc to 1 at the other.
export function bodyAt(hour, minute) {
  const time = hour + minute / 60;
  const sun = time >= 5 && time < 20;
  const across = sun ? (time - 5) / 15 : ((time + 4) % 24) / 9;
  return { art: sun ? "sun" : "moon", across, height: 1 - 4 * (across - 0.5) * (across - 0.5) };
}

// Things bought, back to front, each as art path, position in strip pixels and size in art pixels.
export function propsOn(state, width) {
  const has = (id) => state.owned.includes(id);
  const season = state.season, list = [];
  const at = (share) => Math.round(width * share);
  const put = (art, x, rowFeet, w, h) => list.push({ art, x, top: (rowFeet - h) * ART, w: w * ART, h: h * ART });
  if (has("tree-3")) {
    put(`tree-${season}`, at(0.56), 31, 24, 23);
    put(`pine-${season}`, at(0.595), 31, 18, 22);
    put(`tree-${season}`, at(0.62), 32, 24, 23);
  }
  if (has("tree-2")) put(`pine-${season}`, at(0.3), 31, 18, 22);
  if (has("tree-1")) put(`tree-${season}`, at(0.235), 32, 24, 23);
  const posts = has("fence-3") ? Math.ceil(width / (16 * ART)) : has("fence-2") ? 10 : has("fence-1") ? 5 : 0;
  const start = has("fence-3") ? 0 : at(0.36);
  for (let n = 0; n < posts; n++) put("fence", start + n * 16 * ART, 36, 16, 13);
  if (has("barn")) put("barn", width - 62 * ART, 37, 39, 26);
  if (has("pond")) put(`pond-${season}`, at(0.08), 40, 38, 12);
  return list;
}

// The barn's loft window, lit from dusk on. It's drawn over the evening's shade, so it stays bright.
export function lampOn(state, width, phase) {
  if (!state.owned.includes("barn") || phase === "day" || phase === "dawn") return null;
  return { x: width - 62 * ART + 16 * ART, top: (37 - 26 + 5) * ART, w: 4 * ART, h: 2 * ART };
}

// Clouds drift with the clock, so they move without a timer of their own.
export function cloudsAt(hour, minute, width) {
  const drift = (hour * 60 + minute) / 1440;
  return [["cloud-a", 0.18, 3, 24, 6], ["cloud-b", 0.47, 7, 16, 5], ["cloud-a", 0.74, 2, 24, 6]].map(([art, share, row, w, h]) => ({
    art, x: Math.round(((share + drift * 0.6) % 1) * (width + 120)) - 100, top: row * ART, w: w * ART, h: h * ART,
  }));
}
