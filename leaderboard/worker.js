// The Woolhill leaderboard: a small Cloudflare Worker with one KV key. It takes a nickname and game numbers and keeps each
// nickname's best. There are no accounts and nothing proves a score, so anyone can post anything. See README.md.
const KEY = "rows";
const KEEP = 100;
const SHOWN = 50;
const MAX_BODY = 512;
const LIMITS = { wool: 100000000, wolves: 1000000, longestMin: 100000, peak: 1000 };

const reply = (status, value) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

export const cleanNick = (text) => (typeof text === "string" ? text.replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 16) : "");

// Only these fields are ever kept. Anything else in the request is dropped here.
export function readScore(body) {
  const nick = cleanNick(body?.nick);
  if (!nick) return null;
  const score = { nick };
  for (const [field, most] of Object.entries(LIMITS)) {
    const value = body?.[field];
    if (!Number.isInteger(value) || value < 0 || value > most) return null;
    score[field] = value;
  }
  return score;
}

// Each nickname keeps its best of each number. The same nickname in another case is the same person.
export function merge(rows, score) {
  const at = rows.findIndex((row) => row.nick.toLowerCase() === score.nick.toLowerCase());
  const next = [...rows];
  if (at < 0) next.push(score);
  else {
    const old = rows[at];
    next[at] = { nick: old.nick, wool: Math.max(old.wool, score.wool), wolves: Math.max(old.wolves, score.wolves), longestMin: Math.max(old.longestMin, score.longestMin), peak: Math.max(old.peak, score.peak) };
  }
  return next.sort((a, b) => b.wool - a.wool || a.nick.localeCompare(b.nick)).slice(0, KEEP);
}

// Counts as it reads, so a long body is dropped at the limit and never held whole. Null means too long.
async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const bytes = new Uint8Array(MAX_BODY);
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return new TextDecoder().decode(bytes.subarray(0, size));
    if (size + value.byteLength > MAX_BODY) {
      await reader.cancel();
      return null;
    }
    bytes.set(value, size);
    size += value.byteLength;
  }
}

async function load(store) {
  const text = await store.get(KEY);
  if (!text) return [];
  try {
    const rows = JSON.parse(text);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function handle(request, store) {
  const { pathname } = new URL(request.url);
  if (pathname === "/top") {
    if (request.method !== "GET") return reply(405, { error: "GET only" });
    return reply(200, { rows: (await load(store)).slice(0, SHOWN) });
  }
  if (pathname === "/score") {
    if (request.method !== "POST") return reply(405, { error: "POST only" });
    const text = await readBody(request);
    if (text === null) return reply(413, { error: "Too long" });
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return reply(400, { error: "Not JSON" });
    }
    const score = readScore(body);
    if (!score) return reply(400, { error: "Bad score" });
    const rows = await load(store), next = merge(rows, score);
    if (JSON.stringify(next) !== JSON.stringify(rows)) await store.put(KEY, JSON.stringify(next));
    return reply(200, { ok: true });
  }
  return reply(404, { error: "Not found" });
}

export default {
  fetch: (request, env) => handle(request, env.BOARD),
};
