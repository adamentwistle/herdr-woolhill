// Herdr's zoom scales everything a mod draws, and `on_size_change` reports window pixels. So a strip measured at zoom 1.2 has
// to be drawn in the app's own units, or it runs off the right of the window and its hill falls off the bottom.
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { fakeCx, resetWorld, world } from "./stubs.mjs";

const { default: Woolhill } = await import("../mods/woolhill/main.js");
const { CATALOG, STATE_KEY, fresh } = await import("../mods/woolhill/game.js");
const { SHEEP_W, WOLF_W } = await import("../mods/woolhill/flock.js");

const ZOOMS = [1, 1.1, 1.2, 1.5];
const BOX = { width: 1100, height: 144 };
const agent = (address, status) => ({ address, status, pane: `p-${address}`, tab_name: address, space_name: "s" });

beforeEach(() => resetWorld());

function open(zoom, props = {}) {
  world.zoom = zoom;
  world.props = props;
  const view = new Woolhill(), cx = fakeCx();
  view.init(props, cx);
  const scale = zoom || 1, report = (box) => view.render(cx).sized({ width: box.width * scale, height: box.height * scale }, cx);
  report(BOX);
  return { view, cx, report, tree: () => view.render(cx) };
}

const arg = (el, name) => el.called(name)[0]?.[0];
const hillsOf = (tree) => tree.all().filter((el) => el.path?.includes("/hill-"));

test("the strip is drawn in the app's own units at every zoom", () => {
  for (const zoom of ZOOMS) {
    const { tree } = open(zoom), hills = hillsOf(tree());
    assert.equal(hills.length, 2, `two tiles cover 1100 at ${zoom}`);
    for (const hill of hills) assert.equal(arg(hill, "top"), 0, `the hill sits on the floor at ${zoom}`);
  }
});

test("a rounded report keeps the hill on a whole unit", () => {
  for (const zoom of ZOOMS) {
    const { report, tree } = open(zoom);
    report({ width: 1100, height: 144 + 0.4 / zoom });
    for (const hill of hillsOf(tree())) assert.equal(arg(hill, "top"), 0, `at ${zoom}`);
  }
});

test("a taller block shows more sky at every zoom", () => {
  for (const zoom of ZOOMS) {
    const { report, tree } = open(zoom);
    report({ width: 1100, height: 240 });
    for (const hill of hillsOf(tree())) assert.equal(arg(hill, "top"), 96, `at ${zoom}`);
  }
});

test("every sheep stands inside the window at every zoom", () => {
  for (const zoom of ZOOMS) {
    const { tree } = open(zoom, { demo: true });
    const sheep = tree().all().filter((el) => el.elementId?.startsWith("sheep-"));
    assert.equal(sheep.length, 8);
    for (const one of sheep) {
      const left = arg(one, "left");
      assert.ok(left >= 0 && left + SHEEP_W <= BOX.width, `${one.elementId} at ${left}, zoom ${zoom}`);
    }
  }
});

test("a wolf sets off from just past the edge at every zoom", () => {
  for (const zoom of ZOOMS) {
    world.agents = [agent("a", "working")];
    const { view, cx } = open(zoom);
    view.tick(cx);
    view.flock.sheep.get("a").x = view.flock.sheep.get("a").from = 100;
    world.agents = [agent("a", "blocked")];
    view.tick(cx);
    assert.equal(view.flock.wolves.get("a").x, BOX.width + 8, `at ${zoom}`);
  }
});

test("what's bought is placed by the app's width at every zoom", () => {
  for (const zoom of ZOOMS) {
    world.shared[STATE_KEY] = { ...fresh(), owned: CATALOG.map((item) => item.id) };
    const { tree } = open(zoom), barn = tree().all().find((el) => el.path?.includes("/barn."));
    assert.equal(arg(barn, "left"), BOX.width - 62 * 3, `at ${zoom}`);
  }
});

test("the same box draws the same strip at every zoom", () => {
  const shape = (tree) => tree.all().filter((el) => el.path).map((el) => [el.path, arg(el, "left"), arg(el, "top"), arg(el, "w"), arg(el, "h")]);
  world.shared[STATE_KEY] = { ...fresh(), owned: CATALOG.map((item) => item.id) };
  const base = shape(open(1, { demo: true, hour: 12 }).tree());
  for (const zoom of ZOOMS.slice(1)) assert.deepEqual(shape(open(zoom, { demo: true, hour: 12 }).tree()), base, `at ${zoom}`);
});

test("zooming in with no new report from the app still draws to the window", () => {
  const { tree } = open(1);
  world.zoom = 1.5;
  const hills = hillsOf(tree());
  assert.equal(hills.length, 1, "733 units needs one tile");
});

test("a sheep left past the edge by a smaller window comes back", () => {
  world.agents = [agent("a", "idle")];
  const { view, cx, report, tree } = open(1);
  view.tick(cx);
  const sheep = view.flock.sheep.get("a");
  sheep.x = sheep.from = 1000;
  report({ width: 600, height: 144 });
  const left = arg(tree().find("sheep-a"), "left");
  assert.ok(left + SHEEP_W <= 600, `at ${left}`);
});

test("a wolf left past the edge by a smaller window still stands on the hill", () => {
  world.agents = [agent("a", "blocked")];
  const { view, cx, report, tree } = open(1);
  view.tick(cx);
  view.tick(cx);
  const wolf = view.flock.wolves.get("a");
  wolf.x = wolf.from = 1000; wolf.moveMs = 0;
  report({ width: 600, height: 144 });
  assert.ok(arg(tree().find("wolf-a"), "left") <= 600 - WOLF_W / 2);
});

test("a bad zoom reads as 1", () => {
  for (const zoom of [0, undefined]) {
    const { tree } = open(zoom);
    assert.equal(hillsOf(tree()).length, 1 + 1);
  }
});

test("a sheep is named by its tab, or its space when the tab only has a number", () => {
  world.agents = [{ ...agent("a", "idle"), tab_name: "2", space_name: "meadow" }, { ...agent("b", "idle"), tab_name: "lantern", space_name: "meadow" }];
  const { view, cx, tree } = open(1);
  view.tick(cx);
  assert.equal(tree().find("sheep-a").tip, "meadow");
  assert.equal(tree().find("sheep-b").tip, "lantern");
});
