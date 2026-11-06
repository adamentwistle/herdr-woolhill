// The hill's moves: one sheep per agent, what each status does, and how a wolf comes and goes.
import assert from "node:assert/strict";
import test from "node:test";
import { REST_MS, SHEEP_W, SLEEP_AFTER_MS, TICK_MS, WOLF_W, land, moving, newFlock, placeNow, step, wolfGap } from "../mods/woolhill/flock.js";

const W = 1000, T0 = 5000000, NONE = { finished: [], driven: [] };
const half = () => 0.5;
const agent = (address, status) => ({ address, status });
const go = (flock, list, at, events = NONE, rand = half, dog = false) => step(flock, list, events, at, rand, W, dog);

test("one sheep per agent, and a closed agent's sheep goes", () => {
  const flock = newFlock();
  go(flock, [agent("a", "idle"), agent("b", "working"), agent("c", "blocked")], T0);
  assert.equal(flock.sheep.size, 3);
  go(flock, [agent("a", "idle")], T0 + TICK_MS);
  assert.deepEqual([...flock.sheep.keys()], ["a"]);
});

test("a working sheep walks and grazes in turn, and stays on the hill", () => {
  const flock = newFlock(), seen = new Set();
  let n = 0;
  const rand = () => [0.9, 0.1, 0.7, 0.3, 0.5][n++ % 5];
  for (let t = 0; t < 400; t++) {
    go(flock, [agent("a", "working")], T0 + t * TICK_MS, NONE, rand);
    const sheep = flock.sheep.get("a");
    seen.add(sheep.mode);
    assert.ok(sheep.x >= 0 && sheep.x <= W - SHEEP_W, `x ${sheep.x}`);
  }
  assert.ok(seen.has("walk") && seen.has("graze"));
});

test("a walk lasts whole ticks, so the feet stop with the sheep", () => {
  const flock = newFlock();
  go(flock, [agent("a", "working")], T0, NONE, () => 0.9);
  const sheep = flock.sheep.get("a");
  assert.equal(sheep.mode, "walk");
  assert.equal(sheep.moveMs % TICK_MS, 0);
  assert.ok(sheep.moveMs > 0);
});

test("an idle sheep rests, then sleeps", () => {
  const flock = newFlock();
  go(flock, [agent("a", "idle")], T0);
  assert.equal(flock.sheep.get("a").mode, "rest");
  go(flock, [agent("a", "idle")], T0 + SLEEP_AFTER_MS);
  assert.equal(flock.sheep.get("a").mode, "sleep");
});

test("stopping mid-walk keeps the sheep where it got to", () => {
  const flock = newFlock();
  go(flock, [agent("a", "working")], T0, NONE, () => 0.9);
  const sheep = flock.sheep.get("a"), half = T0 + sheep.moveMs / 2, there = placeNow(sheep, half);
  go(flock, [agent("a", "idle")], half);
  assert.ok(Math.abs(sheep.x - there) < 0.001);
  assert.equal(sheep.moveMs, 0);
});

test("a finished sheep hops once and drops wool that shows what it earned", () => {
  const flock = newFlock();
  go(flock, [agent("a", "working")], T0);
  go(flock, [agent("a", "idle")], T0 + TICK_MS, { finished: [{ address: "a", wool: 7, ms: 1 }], driven: [] });
  const sheep = flock.sheep.get("a");
  assert.equal(sheep.hopping, true);
  assert.equal(flock.tufts.length, 1);
  assert.equal(flock.tufts[0].wool, 7);
  assert.equal(flock.tufts[0].labelled, true);
  land(flock);
  assert.equal(sheep.hopping, false);
  go(flock, [agent("a", "idle")], T0 + 2 * TICK_MS);
  assert.equal(sheep.mode, "rest");
});

test("wool fades, and the hill goes back to still", () => {
  const flock = newFlock(), list = [agent("a", "idle")];
  go(flock, list, T0, { finished: [{ address: "a", wool: 1, ms: 1 }], driven: [] });
  land(flock);
  assert.equal(moving(flock, list), true);
  go(flock, list, T0 + 4000);
  assert.equal(flock.tufts[0].labelled, false);
  go(flock, list, T0 + 15000);
  assert.equal(flock.tufts.length, 0);
  assert.equal(moving(flock, list), false);
});

test("a wolf shows at the edge first, so it can walk in", () => {
  const flock = newFlock();
  go(flock, [agent("a", "blocked")], T0);
  const wolf = flock.wolves.get("a");
  assert.ok(wolf.x >= W || wolf.x <= -WOLF_W, `x ${wolf.x}`);
  assert.equal(wolf.moveMs, 0);
  go(flock, [agent("a", "blocked")], T0 + TICK_MS);
  assert.ok(wolf.moveMs > 0);
  assert.equal(wolf.mode, "walk");
});

test("the wolf comes from the side with more room", () => {
  for (const [rand, side] of [[() => 0.05, 1], [() => 0.95, -1]]) {
    const flock = newFlock();
    go(flock, [agent("a", "blocked")], T0, NONE, rand);
    assert.equal(flock.wolves.get("a").side, side);
  }
});

test("the sheep turns to face its wolf and stands still", () => {
  const flock = newFlock();
  go(flock, [agent("a", "blocked")], T0, NONE, () => 0.05);
  const sheep = flock.sheep.get("a");
  assert.equal(sheep.mode, "alert");
  assert.equal(sheep.facing, "r");
});

test("the longer it waits, the closer the wolf, and it never touches", () => {
  const gaps = [0, 30000, 60000, 180000, 360000, 600000, 3600000, 86400000].map(wolfGap);
  for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i] <= gaps[i - 1]);
  assert.ok(gaps[0] > gaps.at(-1));
  assert.ok(gaps.at(-1) > 0);
});

test("over a whole day the wolf stops short of the sheep and the sheep stays", () => {
  const flock = newFlock(), list = [agent("a", "blocked")];
  go(flock, list, T0);
  const wolf = flock.wolves.get("a"), sheep = flock.sheep.get("a");
  for (let t = 1; t < 1440; t++) go(flock, list, T0 + t * 60000);
  assert.equal(flock.sheep.size, 1);
  assert.equal(wolf.mode, "stand");
  assert.ok(wolf.side > 0 ? wolf.x > sheep.x + SHEEP_W : wolf.x + WOLF_W < sheep.x);
  assert.equal(Math.abs(wolf.side > 0 ? wolf.x - (sheep.x + SHEEP_W) : sheep.x - (wolf.x + WOLF_W)), wolfGap(86400000));
});

test("the wolf only moves when its distance changes", () => {
  const flock = newFlock(), list = [agent("a", "blocked")];
  go(flock, list, T0);
  go(flock, list, T0 + TICK_MS);
  go(flock, list, T0 + 40000);
  assert.equal(go(flock, list, T0 + 42000), false);
  assert.equal(go(flock, list, T0 + 44000), false);
});

test("answering sends the wolf off the edge at a run, and then it's gone", () => {
  const flock = newFlock();
  go(flock, [agent("a", "blocked")], T0);
  go(flock, [agent("a", "blocked")], T0 + TICK_MS);
  go(flock, [agent("a", "working")], T0 + 60000);
  const wolf = flock.wolves.get("a");
  assert.equal(wolf.mode, "run");
  assert.ok(wolf.leaving);
  assert.ok(wolf.x >= W || wolf.x <= -WOLF_W);
  go(flock, [agent("a", "working")], wolf.doneAt);
  assert.equal(flock.wolves.size, 0);
});

test("a wolf whose agent closed leaves too", () => {
  const flock = newFlock();
  go(flock, [agent("a", "blocked")], T0);
  go(flock, [], T0 + TICK_MS);
  assert.ok(flock.wolves.get("a").leaving);
  assert.equal(flock.sheep.size, 0);
  go(flock, [], flock.wolves.get("a").doneAt);
  assert.equal(flock.wolves.size, 0);
});

test("each blocked agent has its own wolf", () => {
  const flock = newFlock();
  go(flock, [agent("a", "blocked"), agent("b", "blocked"), agent("c", "working")], T0);
  assert.equal(flock.wolves.size, 2);
});

test("a bought dog sits, and goes to stand by a sheep with a wolf", () => {
  const flock = newFlock();
  go(flock, [agent("a", "idle")], T0, NONE, half, true);
  assert.equal(flock.dog.mode, "sit");
  const home = flock.dog.x;
  go(flock, [agent("a", "blocked")], T0 + TICK_MS, NONE, half, true);
  go(flock, [agent("a", "blocked")], T0 + 2 * TICK_MS, NONE, half, true);
  assert.equal(flock.dog.mode, "trot");
  assert.notEqual(flock.dog.x, home);
  go(flock, [agent("a", "blocked")], T0 + 30000, NONE, half, true);
  assert.equal(flock.dog.mode, "sit");
});

test("nothing moves when every agent is idle, so nothing draws", () => {
  const flock = newFlock(), list = [agent("a", "idle"), agent("b", "idle")];
  go(flock, list, T0);
  assert.equal(moving(flock, list), false);
  assert.equal(go(flock, list, T0 + REST_MS), false);
  assert.equal(go(flock, list, T0 + 2 * REST_MS), false);
});

test("the hill is busy while an agent works or waits", () => {
  const flock = newFlock();
  assert.equal(moving(flock, [agent("a", "working")]), true);
  assert.equal(moving(flock, [agent("a", "blocked")]), true);
});
