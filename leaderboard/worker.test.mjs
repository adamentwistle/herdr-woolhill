// Runs the Worker's handler with a stand-in for KV, so nothing is deployed or reached.
import assert from "node:assert/strict";
import test from "node:test";
import { handle, merge, readScore } from "./worker.js";

const store = (rows) => {
  const box = { writes: 0, value: rows ? JSON.stringify(rows) : null };
  return { box, get: async () => box.value, put: async (_key, text) => { box.value = text; box.writes += 1; } };
};
const score = (more = {}) => ({ nick: "barley", wool: 100, wolves: 3, longestMin: 40, peak: 5, ...more });
const post = (body, kv) => handle(new Request("https://board.test/score", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }), kv);
const top = async (kv) => (await (await handle(new Request("https://board.test/top"), kv)).json()).rows;

test("a score is kept and comes back in the top list", async () => {
  const kv = store();
  assert.equal((await post(score(), kv)).status, 200);
  assert.deepEqual(await top(kv), [score()]);
});

test("only the nickname and the four numbers are stored", async () => {
  const kv = store();
  await post({ ...score(), project: "secret", path: "/home/someone", email: "a@b.test" }, kv);
  assert.deepEqual(Object.keys(JSON.parse(kv.box.value)[0]).sort(), ["longestMin", "nick", "peak", "wolves", "wool"]);
  assert.doesNotMatch(kv.box.value, /secret|home|a@b/);
});

test("a nickname keeps its best of each number, whatever the case", async () => {
  const kv = store();
  await post(score({ wool: 500, wolves: 1 }), kv);
  await post(score({ nick: "BARLEY", wool: 200, wolves: 9 }), kv);
  const rows = await top(kv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].nick, "barley");
  assert.equal(rows[0].wool, 500);
  assert.equal(rows[0].wolves, 9);
});

test("the list runs highest wool first", async () => {
  const kv = store();
  await post(score({ nick: "a", wool: 1 }), kv);
  await post(score({ nick: "b", wool: 3 }), kv);
  await post(score({ nick: "c", wool: 2 }), kv);
  assert.deepEqual((await top(kv)).map((row) => row.nick), ["b", "c", "a"]);
});

test("the store keeps a hundred rows and the list shows fifty", () => {
  let rows = [];
  for (let n = 0; n < 130; n++) rows = merge(rows, score({ nick: `n${n}`, wool: n }));
  assert.equal(rows.length, 100);
  assert.equal(rows[0].wool, 129);
});

test("the top list shows at most fifty", async () => {
  let rows = [];
  for (let n = 0; n < 80; n++) rows = merge(rows, score({ nick: `n${n}`, wool: n }));
  assert.equal((await top(store(rows))).length, 50);
});

test("a score that changes nothing writes nothing", async () => {
  const kv = store([score()]);
  await post(score(), kv);
  assert.equal(kv.box.writes, 0);
});

test("bad scores are refused", async () => {
  const kv = store();
  for (const bad of [{}, score({ nick: "" }), score({ nick: "!!!" }), score({ wool: -1 }), score({ wool: 1.5 }), score({ wool: "9" }), score({ wool: 1e12 }), score({ peak: undefined })]) assert.equal((await post(bad, kv)).status, 400);
  assert.equal((await post("not json", kv)).status, 400);
  assert.equal((await post("x".repeat(600), kv)).status, 413);
  assert.equal(kv.box.writes, 0);
});

test("a nickname is cleaned before it is kept", () => {
  assert.equal(readScore(score({ nick: "  <b>north-fell</b> and a very long tail" })).nick, "bnorth-fellb and");
});

test("wrong methods and paths are refused", async () => {
  const kv = store();
  assert.equal((await handle(new Request("https://board.test/score"), kv)).status, 405);
  assert.equal((await handle(new Request("https://board.test/top", { method: "POST" }), kv)).status, 405);
  assert.equal((await handle(new Request("https://board.test/"), kv)).status, 404);
});

test("a damaged store reads as empty", async () => {
  const kv = store();
  kv.box.value = "{broken";
  assert.deepEqual(await top(kv), []);
});
