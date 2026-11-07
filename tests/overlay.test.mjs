// Runs main.js, scene.js and shop.js against the stand-ins in stubs.mjs: the strip, every overlay page and every control.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test, { beforeEach } from "node:test";
import { inflateSync } from "node:zlib";
import { fakeCx, resetWorld, world } from "./stubs.mjs";

const { default: Woolhill } = await import("../mods/woolhill/main.js");
const { DEMO_KEY, STATE_KEY, CATALOG, fresh } = await import("../mods/woolhill/game.js");
const { REST_MS, TICK_MS } = await import("../mods/woolhill/flock.js");
const { CARD_H, CARD_W, decodeCommand, makeCard, toBase64 } = await import("../mods/woolhill/card.js");
const { demoAgents, demoState } = await import("../mods/woolhill/demo.js");
const { hasStrip, pinPlan, withStrip } = await import("../mods/woolhill/place.js");
const { boardBody, boardReady, sendScore, topScores } = await import("../mods/woolhill/board.js");
const { LEADERBOARD_URL } = await import("../mods/woolhill/config.js");
const { bodyAt, phaseAt, propsOn, skyFor } = await import("../mods/woolhill/world.js");

const MODS = new URL("../mods/woolhill/", import.meta.url);
const agent = (address, status, more = {}) => ({ address, status, pane: `p-${address}`, tab_name: `tab ${address}`, space_name: "space", ...more });

beforeEach(() => resetWorld());

async function open(props = {}) {
  world.props = props;
  const view = new Woolhill(), cx = fakeCx();
  view.init(props, cx);
  await cx.settled();
  return { view, cx, tree: () => view.render(cx) };
}

async function press(tree, id, cx) {
  const target = tree().find(id);
  assert.ok(target, `${id} is on screen`);
  assert.ok(target.press, `${id} can be pressed`);
  target.press({}, cx);
  await cx.settled();
}

const saved = () => world.shared[STATE_KEY];
const assetOf = (path) => new URL(path.replace("mods/woolhill/", ""), MODS);

test("the strip draws a sheep for each agent and pays for a finished turn", async () => {
  world.agents = [agent("a", "working")];
  const { view, cx, tree } = await open();
  assert.ok(tree().find("sheep-a"));
  world.agents = [agent("a", "idle")];
  view.tick(cx);
  assert.equal(saved().turns, 1);
  assert.ok(saved().wool >= 1);
  assert.ok(tree().find("tuft-0"));
});

test("a finished sheep goes up and comes down", async () => {
  world.agents = [agent("a", "working")];
  const { view, cx } = await open();
  world.agents = [agent("a", "idle")];
  view.tick(cx);
  assert.equal(view.flock.sheep.get("a").hopping, true);
  cx.later[0].handler(cx);
  assert.equal(view.flock.sheep.get("a").hopping, false);
});

test("a press on a wolf goes to its agent", async () => {
  world.agents = [agent("a", "blocked")];
  const { view, cx, tree } = await open();
  view.tick(cx);
  await press(tree, "wolf-a", cx);
  assert.deepEqual(world.ran.at(-1), { name: "pane.focus", args: { pane: "p-a" } });
});

test("a press on a sheep goes to its agent too", async () => {
  world.agents = [agent("a", "working")];
  const { cx, tree } = await open();
  await press(tree, "sheep-a", cx);
  assert.equal(world.ran.at(-1).name, "pane.focus");
});

test("a sub-agent with no pane is reached by its terminal", async () => {
  world.agents = [agent("a", "blocked", { pane: null })];
  const { cx, tree } = await open();
  await press(tree, "wolf-a", cx);
  assert.deepEqual(world.ran.at(-1), { name: "agent.focus", args: { terminal: "a" } });
});

test("a hover on a sheep or wolf names its tab", async () => {
  world.agents = [agent("a", "blocked")];
  const { tree } = await open();
  assert.equal(tree().find("sheep-a").tip, "tab a");
  assert.equal(tree().find("wolf-a").tip, "tab a");
});

test("the sign shows the wool and opens the overlay", async () => {
  world.shared[STATE_KEY] = { ...fresh(), wool: 1234 };
  const { cx, tree } = await open();
  assert.match(tree().find("sign").text(), /1,234/);
  await press(tree, "sign", cx);
  assert.deepEqual(world.ran.at(-1), { name: "mod.open", args: { name: "woolhill" } });
});

test("the tick slows when nothing moves, and draws nothing", async () => {
  world.agents = [agent("a", "idle")];
  const { view, cx } = await open();
  assert.deepEqual(cx.live().map((task) => task.ms), [REST_MS]);
  const before = cx.notified;
  view.tick(cx);
  view.tick(cx);
  assert.equal(cx.notified, before);
});

test("the tick speeds up while an agent works, and slows again", async () => {
  world.agents = [agent("a", "idle")];
  const { view, cx } = await open();
  world.agents = [agent("a", "working")];
  view.tick(cx);
  assert.deepEqual(cx.live().map((task) => task.ms), [TICK_MS]);
  world.agents = [agent("a", "idle")];
  view.tick(cx);
  cx.later.forEach((task) => task.handler(cx));
  for (const tuft of view.flock.tufts) tuft.born = 0;
  view.tick(cx);
  assert.deepEqual(cx.live().map((task) => task.ms), [REST_MS]);
});

test("the timer stops when the strip closes", async () => {
  const { view, cx } = await open();
  await view.close();
  assert.equal(cx.live().length, 0);
});

test("a run open before a restart doesn't pay for an agent that stopped", async () => {
  world.shared[STATE_KEY] = { ...fresh(), runs: { a: { since: 1, waited: 0, blockedAt: null } } };
  world.agents = [agent("a", "idle")];
  await open();
  assert.equal(saved().wool, 0);
  assert.deepEqual(saved().runs, {});
});

test("demo mode shows every state at once", async () => {
  const { view, tree } = await open({ demo: true });
  const modes = [...view.flock.sheep.values()].map((sheep) => sheep.mode);
  for (const mode of ["walk", "graze", "alert", "sleep", "rest", "stand"]) assert.ok(modes.includes(mode), mode);
  assert.deepEqual([...view.flock.wolves.values()].map((wolf) => wolf.mode).sort(), ["stand", "walk"]);
  assert.equal(view.flock.tufts.length, 1);
  assert.ok(view.flock.dog);
  const paths = tree().paths();
  for (const name of ["barn", "pond-summer", "fence", "tree-summer", "pine-summer"]) assert.ok(paths.some((p) => p.includes(name)), name);
});

test("demo mode needs no agents, saves nothing and jumps nowhere", async () => {
  const { view, cx, tree } = await open({ demo: true });
  assert.equal(world.shared[STATE_KEY], undefined);
  await press(tree, "sheep-d1", cx);
  assert.equal(world.ran.length, 0);
  assert.equal(cx.live().length, 0);
  assert.equal(view.state().wool, demoState().wool);
});

test("demo data is all made up, with no real paths or names", () => {
  const text = JSON.stringify([demoAgents(), demoState()]);
  assert.doesNotMatch(text, /[A-Z]:\\|\/home|\/Users|@/);
});

test("the overlay in demo mode follows the strip", async () => {
  world.shared[DEMO_KEY] = true;
  const { tree } = await open({ overlay: "o1" });
  assert.match(tree().text(), /Demo data/);
  assert.match(tree().text(), /1,284/);
});

test("a real strip clears a demo left behind", async () => {
  world.shared[DEMO_KEY] = true;
  await open();
  assert.equal(world.shared[DEMO_KEY], false);
});

test("the shop lists what can be bought, and buying takes wool", async () => {
  world.shared[STATE_KEY] = { ...fresh(), wool: 200 };
  const { cx, tree } = await open({ overlay: "o1" });
  assert.match(tree().text(), /Short fence/);
  assert.doesNotMatch(tree().text(), /Long fence/);
  await press(tree, "buy-fence-1", cx);
  assert.equal(saved().wool, 185);
  assert.deepEqual(saved().owned, ["fence-1"]);
  assert.match(tree().text(), /Long fence/);
  assert.match(tree().text(), /Owned/);
});

test("what can't be paid for can't be pressed", async () => {
  world.shared[STATE_KEY] = { ...fresh(), wool: 1 };
  const { tree } = await open({ overlay: "o1" });
  assert.equal(tree().find("buy-barn").press, null);
});

test("summer is in use from the start, and an owned season can be put on", async () => {
  world.shared[STATE_KEY] = { ...fresh(), owned: ["season-autumn"] };
  const { cx, tree } = await open({ overlay: "o1" });
  assert.match(tree().find("card-season-summer").text(), /In use/);
  await press(tree, "use-autumn", cx);
  assert.equal(saved().season, "autumn");
});

test("the Flock page shows the stats the brief names", async () => {
  world.shared[STATE_KEY] = { ...fresh(), lifetime: 4218, wolves: 37, longestMs: 134 * 60000 };
  const { cx, tree } = await open({ overlay: "o1" });
  await press(tree, "tab-flock", cx);
  const text = tree().text();
  for (const words of ["4,218", "Lifetime wool", "37", "Wolves driven off", "2h 14m", "Longest run"]) assert.match(text, new RegExp(words));
});

test("the Share page draws a card, and Save writes it to Downloads", async () => {
  world.shared[STATE_KEY] = { ...fresh(), lifetime: 10 };
  const { view, cx, tree } = await open({ overlay: "o1" });
  await press(tree, "tab-share", cx);
  await cx.settled();
  assert.match(view.cardPath, /^data\/woolhill\/card-\d+\.png$/);
  assert.match(Object.entries(world.files).find(([path]) => path.endsWith(".b64"))[1], /^iVBOR/);
  assert.equal(world.execs[0].command, "certutil");
  await press(tree, "save-card", cx);
  await cx.settled();
  assert.match(world.execs.at(-1).args.at(-1), /^\/h\/Downloads\/woolhill-card-\d+\.png$/);
  assert.match(view.note.text, /^Saved to ~\/Downloads\//);
});

test("a tool that fails says so, and no card is claimed", async () => {
  world.exec = async () => ({ code: 1, stdout: "", stderr: "no such tool" });
  const { view, cx, tree } = await open({ overlay: "o1" });
  await press(tree, "tab-share", cx);
  await cx.settled();
  assert.equal(view.cardPath, null);
  assert.equal(view.cardFailed, true);
  assert.equal(view.note.bad, true);
  assert.match(view.note.text, /no such tool/);
});

test("Copy line puts the brag on the clipboard", async () => {
  world.shared[STATE_KEY] = { ...fresh(), lifetime: 10 };
  const { cx, tree } = await open({ overlay: "o1" });
  await press(tree, "tab-share", cx);
  await press(tree, "copy-line", cx);
  assert.match(cx.copied[0], /^My Woolhill flock: 10 wool/);
});

test("the Board page doesn't exist until a URL is set", async () => {
  assert.equal(LEADERBOARD_URL, "");
  world.commands = ["board"];
  const { view, tree } = await open({ overlay: "o1" });
  assert.equal(tree().find("tab-board"), null);
  assert.notEqual(view.page, "board");
});

test("demo mode shows a made-up board and sends nothing", async () => {
  world.shared[DEMO_KEY] = true;
  const { view, cx, tree } = await open({ overlay: "o1" });
  await press(tree, "tab-board", cx);
  assert.match(tree().text(), /barley/);
  await press(tree, "board-toggle", cx);
  await press(tree, "board-send", cx);
  assert.match(view.note.text, /isn't sent/);
});

test("the client stays silent until it has a URL, is on and has a nickname", async () => {
  let asked = 0;
  const request = async () => { asked += 1; return { ok: true, status: 200, json: async () => ({ rows: [] }) }; };
  const on = { ...fresh(), boardOn: true, nick: "tarn" };
  assert.equal((await sendScore("", on, request)).ok, false);
  assert.equal((await sendScore("https://b.test", { ...on, boardOn: false }, request)).ok, false);
  assert.equal((await sendScore("https://b.test", { ...on, nick: "" }, request)).ok, false);
  assert.equal((await topScores("", fresh(), request)).error, "Off");
  assert.equal(asked, 0);
  assert.equal((await sendScore("https://b.test/", on, request)).ok, true);
  assert.equal(asked, 1);
});

test("only a nickname and game numbers are sent", async () => {
  let sent = null;
  const state = { ...fresh(), boardOn: true, nick: "tarn", lifetime: 10, wolves: 2, longestMs: 180000, peak: 3, owned: ["barn"], runs: { t4: { since: 1 } } };
  await sendScore("https://b.test", state, async (url, options) => { sent = { url, body: JSON.parse(options.body) }; return { ok: true }; });
  assert.equal(sent.url, "https://b.test/score");
  assert.deepEqual(sent.body, { nick: "tarn", wool: 10, wolves: 2, longestMin: 3, peak: 3 });
  assert.deepEqual(boardBody(state), sent.body);
});

test("a board that can't be reached is named, not thrown", async () => {
  const down = async () => { throw new Error("offline"); };
  assert.match((await sendScore("https://b.test", { ...fresh(), boardOn: true, nick: "a" }, down)).error, /offline/);
  assert.match((await topScores("https://b.test", { boardOn: true }, down)).error, /offline/);
  assert.equal(boardReady("http://b.test"), false);
});

test("a bad reply from the board is named", async () => {
  const refused = async () => ({ ok: false, status: 503 });
  assert.match((await topScores("https://b.test", { boardOn: true }, refused)).error, /503/);
});

test("the card is a real PNG of the right size", () => {
  const card = makeCard({ state: demoState(), demo: true });
  for (const run of card.steps) run();
  const bytes = Buffer.from(card.made.bytes);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(bytes.readUInt32BE(16), CARD_W);
  assert.equal(bytes.readUInt32BE(20), CARD_H);
  const start = bytes.indexOf("IDAT") + 4, length = bytes.readUInt32BE(start - 8);
  assert.equal(inflateSync(bytes.subarray(start, start + length)).length, (CARD_W + 1) * CARD_H);
  assert.equal(Buffer.from(card.made.base64, "base64").length, bytes.length);
});

test("a card step stopped and run again gives the same file", () => {
  const once = makeCard({ state: demoState() }), twice = makeCard({ state: demoState() });
  for (const run of once.steps) run();
  for (const run of twice.steps) { run(); run(); }
  assert.deepEqual(Buffer.from(twice.made.bytes), Buffer.from(once.made.bytes));
});

test("the card is many small steps", () => {
  const card = makeCard({ state: demoState() });
  assert.ok(card.steps.length > 30);
});

test("the card holds no project: agents and names never reach it", () => {
  const state = { ...demoState(), nick: "secretnick", runs: { "secret-terminal": { since: 1 } } };
  const a = makeCard({ state }), b = makeCard({ state: { ...state, nick: "", runs: {} } });
  for (const run of a.steps) run();
  for (const run of b.steps) run();
  assert.deepEqual(Buffer.from(a.made.bytes), Buffer.from(b.made.bytes));
  assert.equal(Buffer.from(a.made.bytes).includes("secret"), false);
});

test("base64 pieces join into one text", () => {
  const bytes = new Uint8Array(200000).map((_, i) => (i * 31) & 255);
  assert.deepEqual(Buffer.from(toBase64(bytes), "base64"), Buffer.from(bytes));
});

test("each system decodes with what it ships with", () => {
  assert.deepEqual(decodeCommand("windows", "a", "b"), ["certutil", ["-f", "-decode", "a", "b"]]);
  assert.deepEqual(decodeCommand("macos", "a", "b"), ["base64", ["-D", "-i", "a", "-o", "b"]]);
  assert.equal(decodeCommand("linux", "a", "b")[0], "sh");
  assert.deepEqual(decodeCommand("linux", "a b", "c d")[1].slice(-2), ["a b", "c d"]);
});

test("the strip goes under the terminals, in their column", () => {
  const tree = { type: "row", children: [{ id: "side", type: "column", children: [] }, { id: "work", type: "column", children: [{ id: "tabs", type: "block" }, { id: "body", type: "row", children: [{ id: "main", type: "block", content: { tab: "active" } }] }, { id: "status", type: "block" }] }] };
  const placed = withStrip(tree);
  assert.deepEqual(placed.children[1].children.map((node) => node.id), ["tabs", "body", "woolhill", "status"]);
  assert.equal(hasStrip(tree), false);
  assert.equal(hasStrip(placed), true);
  assert.equal(tree.children[1].children.length, 3);
});

test("a layout with no terminal column can't take the strip", () => {
  assert.equal(withStrip({ type: "row", children: [{ type: "block", content: { tab: "active" } }] }), null);
});

const withHill = (hidden) => ({ type: "column", children: [{ id: "top", type: "block", content: { tab: "active" } }, { id: "w1", type: "block", content: { mod: "woolhill" }, ...(hidden ? { hidden: true } : {}) }] });

test("a shown strip is hidden by Unpin, and shown again by Pin", async () => {
  world.layoutName = "main";
  world.tree = withHill(false);
  const { cx, tree } = await open({ overlay: "o1" });
  assert.equal(tree().find("pin").text(), "Unpin from bottom strip");
  await press(tree, "pin", cx);
  assert.deepEqual(world.ran, [{ name: "layout.hide", args: { id: "w1" } }]);
  world.tree = withHill(true);
  assert.equal(tree().find("pin").text(), "Pin to bottom strip");
  await press(tree, "pin", cx);
  assert.deepEqual(world.ran[1], { name: "layout.show", args: { id: "w1" } });
  assert.deepEqual(world.closed, []);
});

test("a person's own layout with no strip gets one under the terminals, 144px tall", async () => {
  world.layoutName = "mine";
  world.tree = { type: "column", children: [{ id: "top", type: "block", content: { tab: "active" } }] };
  const { cx, tree } = await open({ overlay: "o1" });
  assert.equal(tree().find("pin").text(), "Pin to bottom strip");
  await press(tree, "pin", cx);
  assert.equal(world.ran[0].name, "layout.set");
  const strip = world.ran[0].args.layout.children[1];
  assert.deepEqual([strip.id, strip.size.px, strip.content.mod], ["woolhill", 144, "woolhill"]);
  assert.equal(world.tree.children.length, 1);
});

test("a shipped layout with no strip shows no pin button", async () => {
  world.layoutName = "main";
  world.tree = { type: "column", children: [{ type: "block", content: { tab: "active" } }] };
  const { tree } = await open({ overlay: "o1" });
  assert.equal(tree().find("pin"), null);
});

test("a new strip's id doesn't take one in use, and a hidden column around it is shown too", () => {
  const tree = { type: "column", children: [{ id: "woolhill", type: "block", content: { tab: "active" } }] };
  assert.equal(withStrip(tree).children[1].id, "woolhill-2");
  const wrapped = { type: "row", children: [{ id: "wrap", type: "column", hidden: true, children: [{ id: "w1", type: "block", content: { mod: "woolhill" } }] }] };
  assert.deepEqual(pinPlan(wrapped, "main").commands, [["layout.show", { id: "wrap" }]]);
});

test("woolhill.pin presses it from a key", async () => {
  world.layoutName = "main";
  world.tree = withHill(true);
  world.commands = ["pin"];
  await open({ overlay: "o1" });
  assert.deepEqual(world.ran, [{ name: "layout.show", args: { id: "w1" } }]);
});

test("the day follows the clock", () => {
  assert.deepEqual([3, 6, 12, 18, 22].map(phaseAt), ["night", "dawn", "day", "dusk", "night"]);
  assert.equal(bodyAt(12, 0).art, "sun");
  assert.equal(bodyAt(23, 0).art, "moon");
  for (const hour of [0, 4, 5, 12, 19, 20, 23]) {
    const { across } = bodyAt(hour, 30);
    assert.ok(across >= 0 && across <= 1, `${hour}`);
  }
});

test("the loft lights up from dusk, with a barn", async () => {
  const { lampOn } = await import("../mods/woolhill/world.js");
  const barn = { ...fresh(), owned: ["barn"] };
  assert.equal(lampOn(barn, 1000, "day"), null);
  assert.equal(lampOn(fresh(), 1000, "night"), null);
  assert.ok(lampOn(barn, 1000, "dusk"));
  assert.ok(lampOn(barn, 1000, "night"));
});

test("demo mode can show any season", async () => {
  const { tree } = await open({ demo: true, season: "winter" });
  assert.ok(tree().paths().some((p) => p.includes("hill-dark-winter")));
});

test("keys can save the card and copy the line", async () => {
  const { view, cx, tree } = await open({ overlay: "o1" });
  await press(tree, "tab-share", cx);
  await cx.settled();
  world.execs.length = 0;
  view.saveCard(cx);
  await cx.settled();
  assert.equal(world.execs.length, 1);
});

test("every look and hour has a sky", () => {
  for (const look of ["light", "dark"]) for (const phase of ["dawn", "day", "dusk", "night"]) assert.equal(skyFor(look, phase).bands.length, 6);
});

test("the strip uses the time and look it's given", async () => {
  world.dark = false;
  const { tree } = await open({ demo: true, hour: 22 });
  const paths = tree().paths();
  assert.ok(paths.includes("mods/woolhill/art/stars.png"));
  assert.ok(paths.includes("mods/woolhill/art/moon.png"));
  assert.ok(paths.some((p) => p.includes("hill-light-summer")));
});

test("everything the strip and shop draw exists as a file", async () => {
  const everything = { ...fresh(), owned: CATALOG.map((item) => item.id) };
  for (const season of ["spring", "summer", "autumn", "winter"]) {
    for (const look of [true, false]) {
      world.shared[STATE_KEY] = { ...everything, season };
      world.dark = look;
      world.agents = [agent("a", "working"), agent("b", "blocked"), agent("c", "idle")];
      const { view, cx, tree } = await open();
      view.tick(cx);
      for (const mode of ["walk", "graze", "rest", "sleep", "alert", "stand"]) {
        view.flock.sheep.get("a").mode = mode;
        for (const path of tree().paths()) assert.ok(existsSync(assetOf(path)), path);
      }
    }
  }
  for (const item of CATALOG) assert.ok(existsSync(new URL(`art/${item.art}.png`, MODS)), item.art);
  for (const mode of ["walk", "run"]) for (const way of ["l", "r"]) assert.ok(existsSync(new URL(`art/wolf-${mode}-${way}.gif`, MODS)));
  for (const way of ["l", "r"]) assert.ok(existsSync(new URL(`art/dog-trot-${way}.gif`, MODS)));
});

test("mod.json docks at the bottom and the key is free of the other mods'", () => {
  const manifest = JSON.parse(readFileSync(new URL("mod.json", MODS), "utf8"));
  assert.equal(manifest.place, "bottom");
  const keys = JSON.parse(readFileSync(new URL("../../keys.json", MODS), "utf8")).global;
  assert.deepEqual(Object.values(keys), ["mod.open:woolhill"]);
  for (const taken of ["g", "d", "r", "j", "l"]) assert.notEqual(Object.keys(keys)[0], `ctrl-shift-${taken}`);
});

test("the mod runs no helper: it holds no python and no other program", () => {
  const names = readdirSync(MODS);
  assert.equal(names.filter((name) => /\.(py|sh|exe|ps1)$/.test(name)).length, 0);
  assert.ok(existsSync(new URL("fonts/WoolhillPixel.ttf", MODS)));
});
