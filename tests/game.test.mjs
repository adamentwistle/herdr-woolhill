// The rules: what a turn earns, what a wolf counts for, what the shop allows, and what a save survives.
import assert from "node:assert/strict";
import test from "node:test";
import { CATALOG, brag, breedOf, breedsOwned, buy, canBuy, cleanNick, count, fresh, isLocked, observe, readState, seasonsOwned, settle, span, useSeason, woolFor } from "../mods/woolhill/game.js";

const MIN = 60000, T0 = 1000000;
const agent = (status, address = "t1") => ({ address, status });
const after = (state, status, at, address) => observe(state, [agent(status, address)], at);

test("longer runs earn more, each minute worth less, up to a limit", () => {
  assert.equal(woolFor(0), 1);
  assert.equal(woolFor(MIN), 3);
  assert.equal(woolFor(25 * MIN), 11);
  assert.ok(woolFor(100 * MIN) > woolFor(10 * MIN));
  assert.ok(woolFor(100 * MIN) - woolFor(90 * MIN) < woolFor(10 * MIN) - woolFor(0));
  assert.equal(woolFor(10000 * MIN), 40);
});

test("a finished turn pays once, from working to idle or done", () => {
  for (const end of ["idle", "done"]) {
    let { state } = after(fresh(), "working", T0);
    const seen = after(state, end, T0 + 25 * MIN);
    state = seen.state;
    assert.deepEqual(seen.finished, [{ address: "t1", ms: 25 * MIN, wool: 11 }]);
    assert.equal(state.wool, 11);
    assert.equal(state.lifetime, 11);
    assert.equal(state.turns, 1);
    assert.equal(state.longestMs, 25 * MIN);
    const again = after(state, end, T0 + 26 * MIN);
    assert.equal(again.finished.length, 0);
    assert.equal(again.state.wool, 11);
  }
});

test("an agent seen idle for the first time earns nothing", () => {
  const seen = after(fresh(), "idle", T0);
  assert.equal(seen.finished.length, 0);
  assert.equal(seen.state.wool, 0);
});

test("time spent blocked isn't run time", () => {
  let { state } = after(fresh(), "working", T0);
  ({ state } = after(state, "blocked", T0 + 10 * MIN));
  ({ state } = after(state, "working", T0 + 40 * MIN));
  const seen = after(state, "idle", T0 + 50 * MIN);
  assert.equal(seen.finished[0].ms, 20 * MIN);
  assert.equal(seen.state.longestMs, 20 * MIN);
});

test("answering a blocked agent drives one wolf off", () => {
  let { state } = after(fresh(), "working", T0);
  ({ state } = after(state, "blocked", T0 + MIN));
  ({ state } = after(state, "blocked", T0 + 2 * MIN));
  assert.equal(state.wolves, 0);
  const seen = after(state, "working", T0 + 3 * MIN);
  assert.equal(seen.driven.length, 1);
  assert.equal(seen.state.wolves, 1);
  assert.equal(after(seen.state, "working", T0 + 4 * MIN).state.wolves, 1);
});

test("a turn that ends while blocked still drives the wolf off", () => {
  let { state } = after(fresh(), "working", T0);
  ({ state } = after(state, "blocked", T0 + MIN));
  const seen = after(state, "idle", T0 + 3 * MIN);
  assert.equal(seen.state.wolves, 1);
  assert.equal(seen.finished.length, 1);
});

test("a block that answers itself isn't a wolf", () => {
  let { state } = after(fresh(), "working", T0);
  ({ state } = after(state, "blocked", T0 + MIN));
  assert.equal(after(state, "working", T0 + MIN + 1000).state.wolves, 0);
});

test("nothing is ever lost: waiting takes no wool", () => {
  let state = { ...fresh(), wool: 50, lifetime: 50 };
  ({ state } = after(state, "working", T0));
  ({ state } = after(state, "blocked", T0 + MIN));
  ({ state } = after(state, "blocked", T0 + 1000 * MIN));
  assert.equal(state.wool, 50);
  assert.equal(state.lifetime, 50);
});

test("an agent that goes away earns nothing and drives nothing off", () => {
  let { state } = after(fresh(), "working", T0);
  ({ state } = after(state, "blocked", T0 + MIN));
  const seen = observe(state, [], T0 + 2 * MIN);
  assert.equal(seen.state.wool, 0);
  assert.equal(seen.state.wolves, 0);
  assert.deepEqual(seen.state.runs, {});
});

test("two copies can't pay for one turn", () => {
  const { state } = after(fresh(), "working", T0);
  const first = after(state, "idle", T0 + MIN);
  assert.equal(first.state.wool, 3);
  assert.equal(after(first.state, "idle", T0 + MIN).state.wool, 3);
});

test("the most sheep at once is remembered", () => {
  const three = ["t1", "t2", "t3"].map((a) => agent("idle", a));
  const { state } = observe(fresh(), three, T0);
  assert.equal(state.peak, 3);
  assert.equal(observe(state, [agent("idle")], T0).state.peak, 3);
});

test("no change means the same state, so nothing is saved", () => {
  const { state } = after(fresh(), "working", T0);
  const seen = after(state, "working", T0 + MIN);
  assert.equal(seen.changed, false);
  assert.equal(seen.state, state);
});

test("after a restart a run only counts if its agent is still at it", () => {
  const { state } = observe(fresh(), [agent("working", "t1"), agent("working", "t2")], T0);
  const kept = settle(state, [agent("working", "t1"), agent("idle", "t2")]);
  assert.deepEqual(Object.keys(kept.runs), ["t1"]);
  assert.equal(after(kept, "idle", T0 + 600 * MIN, "t2").state.wool, 0);
});

test("the shop sells each thing once, for what it costs", () => {
  const state = { ...fresh(), wool: 20 };
  const bought = buy(state, "fence-1");
  assert.equal(bought.wool, 5);
  assert.deepEqual(bought.owned, ["fence-1"]);
  assert.equal(buy(bought, "fence-1"), bought);
});

test("the shop won't sell what can't be paid for", () => {
  const state = { ...fresh(), wool: 14 };
  assert.equal(canBuy(state, CATALOG[0]), false);
  assert.equal(buy(state, "fence-1"), state);
});

test("a later tier waits for the one before it", () => {
  const state = { ...fresh(), wool: 9999 };
  const long = CATALOG.find((item) => item.id === "fence-2");
  assert.equal(isLocked(state, long), true);
  assert.equal(buy(state, "fence-2"), state);
  assert.equal(isLocked(buy(state, "fence-1"), long), false);
});

test("an unknown item buys nothing", () => {
  const state = { ...fresh(), wool: 9999 };
  assert.equal(buy(state, "moon"), state);
});

test("a bought season goes on, and only owned seasons can", () => {
  const state = { ...fresh(), wool: 200 };
  assert.equal(useSeason(state, "autumn").season, "summer");
  const bought = buy(state, "season-autumn");
  assert.equal(bought.season, "autumn");
  assert.deepEqual(seasonsOwned(bought), ["summer", "autumn"]);
  assert.equal(useSeason(bought, "summer").season, "summer");
});

test("a sheep keeps its breed while the breeds owned stay the same", () => {
  const breeds = breedsOwned({ ...fresh(), owned: ["breed-soot", "breed-gilt"] });
  assert.deepEqual(breeds, ["cream", "soot", "gilt"]);
  assert.equal(breedOf("t7", breeds), breedOf("t7", breeds));
  assert.equal(breedOf("t7", ["cream"]), "cream");
});

test("everything in the shop has a name, a price and a unique id", () => {
  assert.equal(new Set(CATALOG.map((item) => item.id)).size, CATALOG.length);
  for (const item of CATALOG) assert.ok(item.name && item.price > 0 && item.art, item.id);
  for (const item of CATALOG) if (item.after) assert.ok(CATALOG.some((one) => one.id === item.after), item.id);
});

test("a damaged or old save comes back whole", () => {
  for (const raw of [null, undefined, 7, "x", {}, { wool: -5, lifetime: "many", owned: "all", season: "monsoon", runs: 4 }]) {
    const state = readState(raw);
    assert.equal(state.wool, 0);
    assert.deepEqual(state.owned, []);
    assert.equal(state.season, "summer");
    assert.equal(state.boardOn, false);
  }
  assert.deepEqual(readState({ owned: ["barn", "ghost"] }).owned, ["barn"]);
  assert.equal(readState({ season: "autumn" }).season, "summer");
  assert.equal(readState({ owned: ["season-autumn"], season: "autumn" }).season, "autumn");
});

test("the leaderboard is off in a new game", () => {
  assert.equal(fresh().boardOn, false);
  assert.equal(readState({ boardOn: "yes" }).boardOn, false);
});

test("numbers read as people write them", () => {
  assert.equal(count(1234567), "1,234,567");
  assert.equal(count(12), "12");
  assert.equal(span(45000), "45s");
  assert.equal(span(5 * MIN), "5m");
  assert.equal(span(134 * MIN), "2h 14m");
});

test("the brag is one line of game numbers", () => {
  const state = { ...fresh(), lifetime: 4218, wolves: 37, longestMs: 134 * MIN, runs: { t9: { since: 1 } }, nick: "someone" };
  assert.equal(brag(state), "My Woolhill flock: 4,218 wool, 37 wolves driven off, longest run 2h 14m.");
  assert.match(brag({ ...state, wolves: 1 }), /1 wolf driven off/);
  assert.doesNotMatch(brag(state), /\n|someone|t9/);
});

test("a nickname stays short and plain", () => {
  assert.equal(cleanNick("  tarn  "), "tarn");
  assert.equal(cleanNick("<script>"), "script");
  assert.equal(cleanNick("x".repeat(40)).length, 16);
});
