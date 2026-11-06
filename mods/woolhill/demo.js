// Made-up agents and a made-up save, for screenshots and tests. Nothing here is real, and demo mode never saves.
import { CATALOG, fresh } from "./game.js";

const agent = (address, status, tab) => ({ address, pane: `demo-${address}`, status, tab_name: tab, space_name: "meadowlark", program: { name: "Agent" } });

export const demoAgents = () => [
  agent("d1", "working", "lantern"),
  agent("d2", "working", "kettle"),
  agent("d3", "blocked", "postbox"),
  agent("d4", "idle", "tinder"),
  agent("d5", "working", "ferry"),
  agent("d6", "done", "pepper"),
  agent("d7", "working", "bramble"),
  agent("d8", "idle", "marble"),
];

export const demoState = () => ({
  ...fresh(),
  wool: 1284,
  lifetime: 6412,
  wolves: 73,
  longestMs: 3 * 3600000 + 41 * 60000,
  turns: 918,
  peak: 11,
  owned: CATALOG.filter((item) => item.id !== "breed-gilt" && item.id !== "season-winter").map((item) => item.id),
  season: "summer",
  nick: "hillfolk",
});

export const demoBoard = () => [
  { nick: "barley", wool: 18234, wolves: 212, longestMin: 402, peak: 14 },
  { nick: "north-fell", wool: 11907, wolves: 96, longestMin: 287, peak: 9 },
  { nick: "hillfolk", wool: 6412, wolves: 73, longestMin: 221, peak: 11 },
  { nick: "tarn", wool: 4080, wolves: 51, longestMin: 190, peak: 6 },
  { nick: "gimmer", wool: 2755, wolves: 18, longestMin: 96, peak: 4 },
];

// Fixed spots, so every state shows at once and in the same place. `spread` runs from 0 to 1 across the strip.
export const DEMO_SPOTS = {
  d1: { spread: 0.02, lane: 1, facing: "r", mode: "walk" },
  d2: { spread: 0.13, lane: 2, facing: "l", mode: "graze" },
  d3: { spread: 0.3, lane: 2, facing: "r", mode: "alert" },
  d4: { spread: 0.55, lane: 0, facing: "l", mode: "sleep" },
  d5: { spread: 0.6, lane: 2, facing: "r", mode: "graze" },
  d6: { spread: 0.72, lane: 1, facing: "r", mode: "stand" },
  d7: { spread: 0.87, lane: 2, facing: "l", mode: "walk" },
  d8: { spread: 1, lane: 1, facing: "l", mode: "rest" },
};
