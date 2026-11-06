// Faults found in review, each pinned by the input that showed it.
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { fakeCx, resetWorld, world } from "./stubs.mjs";

const { default: Woolhill } = await import("../mods/woolhill/main.js");
const { STATE_KEY, fresh, observe, readState } = await import("../mods/woolhill/game.js");
const { SHEEP_H, SHEEP_W, WOLF_W, fit, newFlock, step } = await import("../mods/woolhill/flock.js");
const { topScores } = await import("../mods/woolhill/board.js");
const { handle } = await import("../leaderboard/worker.js");

const agent = (address, status) => ({ address, status, pane: `p-${address}`, tab_name: address, space_name: "s" });
const arg = (el, name) => el.called(name)[0]?.[0];
const quiet = { finished: [], driven: [] };

beforeEach(() => resetWorld());

function open(props = {}) {
  world.props = props;
  const view = new Woolhill(), cx = fakeCx();
  view.init(props, cx);
  return { view, cx };
}

test("a turn that starts and ends between two looks still pays", () => {
  world.agents = [agent("a", "idle")];
  const { view, cx } = open();
  view.render(cx);
  cx.later.length = 0;
  world.agents = [agent("a", "working")];
  view.render(cx);
  assert.equal(cx.later.length, 1, "a change the app shows is looked at straight away");
  cx.later.shift().handler(cx);
  world.agents = [agent("a", "idle")];
  view.render(cx);
  cx.later.shift().handler(cx);
  assert.equal(world.shared[STATE_KEY].turns, 1);
});

test("nothing is looked at again when no status changed", () => {
  world.agents = [agent("a", "idle")];
  const { view, cx } = open();
  view.render(cx);
  cx.later.length = 0;
  view.render(cx);
  assert.equal(cx.later.length, 0);
});

test("a broken saved run can't wipe the wool", () => {
  const state = readState({ wool: 100, lifetime: 100, runs: { a: { since: 1000000 }, b: { waited: 5 }, c: null, d: "x" } });
  assert.deepEqual(Object.keys(state.runs), ["a"]);
  const next = observe(state, [agent("a", "idle")], 1060000).state;
  assert.equal(next.wool, 103);
  assert.equal(readState(next).wool, 103);
});

test("the Board page stays off the network until it's turned on", async () => {
  const calls = [], request = async (url) => { calls.push(url); return { ok: true, json: async () => ({ rows: [] }) }; };
  assert.deepEqual(await topScores("https://b.example", fresh(), request), { rows: [], error: null });
  assert.deepEqual(calls, []);
  await topScores("https://b.example", { ...fresh(), boardOn: true }, request);
  assert.equal(calls.length, 1);
});

test("a board's rows are checked and capped", async () => {
  const good = { nick: "tarn", wool: 1, wolves: 1, longestMin: 1, peak: 1 };
  const rows = [null, { nick: 3 }, { nick: "x", wool: "1" }, ...Array(60).fill(good)];
  const { rows: kept } = await topScores("https://b.example", { boardOn: true }, async () => ({ ok: true, json: async () => ({ rows }) }));
  assert.equal(kept.length, 50);
  assert.ok(kept.every((row) => row.nick === "tarn"));
});

test("the Worker stops reading a body at its limit", async () => {
  let pulled = 0;
  const body = new ReadableStream({ pull(c) { pulled += 1; if (pulled > 100) c.close(); else c.enqueue(new Uint8Array(1024)); } });
  const request = new Request("https://b.example/score", { method: "POST", body, duplex: "half" });
  const reply = await handle(request, { get: async () => null, put: async () => {} });
  assert.equal(reply.status, 413);
  assert.ok(pulled < 10, `read ${pulled} chunks`);
});

test("each card keeps its own text, so Save card saves what's shown", async () => {
  const { view, cx } = open({ overlay: "o", page: "share" });
  await cx.settled();
  const first = view.cardText;
  assert.match(first, /card-.*\.b64$/);
  view.saveCard(cx);
  await cx.settled();
  assert.ok(world.execs.at(-1).args.some((a) => String(a).includes(first)));
});

test("closing the overlay takes its card with it", async () => {
  const { view, cx } = open({ overlay: "o", page: "share" });
  await cx.settled();
  const text = Object.keys(world.files).find((path) => path.endsWith(".b64"));
  assert.ok(text);
  await view.close();
  assert.deepEqual(world.gone.filter((path) => path.endsWith(".b64") || path.endsWith(".png")).length, 2);
});

test("a shrunk hill leaves a wolf short of its sheep", () => {
  const flock = newFlock(), now = 1000000, rand = () => 0.5;
  const list = [agent("a", "blocked")];
  step(flock, list, quiet, now, rand, 1000, false);
  const sheep = flock.sheep.get("a");
  sheep.x = sheep.from = 419;
  step(flock, list, quiet, now + 2000, rand, 1000, false);
  flock.wolves.get("a").x = 660;
  flock.wolves.get("a").from = 660;
  flock.wolves.get("a").moveMs = 0;
  fit(flock, 400, now + 4000);
  step(flock, list, quiet, now + 6000, rand, 400, false);
  const wolf = flock.wolves.get("a");
  assert.ok(wolf.x + WOLF_W <= sheep.x || wolf.x >= sheep.x + SHEEP_W, `wolf ${wolf.x}, sheep ${sheep.x}`);
});

test("a wolf that hasn't set off is left past the edge", () => {
  world.agents = [agent("a", "blocked")];
  const { view, cx } = open();
  view.flock.sheep.get("a").x = 100;
  const wolf = view.flock.wolves.get("a");
  const start = wolf.x;
  view.render(cx);
  assert.equal(wolf.x, start);
});

test("a wolf that hasn't set off still picks the side with room when its sheep moves", () => {
  const flock = newFlock(), now = 1000000, rand = () => 0.5, list = [agent("a", "blocked")];
  step(flock, list, quiet, now, rand, 1000, false);
  const sheep = flock.sheep.get("a"), wolf = flock.wolves.get("a");
  sheep.x = sheep.from = 464;
  wolf.side = 1;
  fit(flock, 400, now + 1000);
  step(flock, list, quiet, now + 2000, rand, 400, false);
  assert.ok(wolf.x + WOLF_W <= sheep.x || wolf.x >= sheep.x + SHEEP_W, `wolf ${wolf.x}, sheep ${sheep.x}`);
});

test("a card that fails leaves nothing behind", async () => {
  world.exec = async () => ({ code: 1, stdout: "", stderr: "no" });
  const { view, cx } = open({ overlay: "o", page: "share" });
  await cx.settled();
  assert.equal(view.cardFailed, true);
  assert.deepEqual(Object.keys(world.files).filter((path) => path.endsWith(".b64")), []);
});

test("closing while a new card replaces the old one leaves neither", async () => {
  const { view, cx } = open({ overlay: "o", page: "share" });
  await cx.settled();
  view.drawCard(cx);
  await cx.settled();
  await view.close();
  await cx.settled();
  assert.deepEqual(Object.keys(world.files).filter((path) => path.endsWith(".b64")), []);
});

test("no new card is drawn while one is being saved", async () => {
  const { view, cx } = open({ overlay: "o", page: "share" });
  await cx.settled();
  const shown = view.cardText;
  view.saving = true;
  view.drawCard(cx);
  await cx.settled();
  assert.equal(view.cardText, shown);
});

test("a short strip crops the sky, not the flock", () => {
  world.agents = [agent("a", "idle")];
  const { view, cx } = open();
  view.render(cx).sized({ width: 1000, height: 96 }, cx);
  const tree = view.render(cx), hill = tree.all().find((el) => el.path?.includes("/hill-"));
  assert.equal(arg(hill, "top"), -48);
  const sheep = tree.find("sheep-a");
  assert.ok(arg(sheep, "top") + SHEEP_H <= 96);
});
