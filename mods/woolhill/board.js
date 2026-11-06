// The leaderboard client. It does nothing, reading included, until `LEADERBOARD_URL` in config.js is set and the person has
// turned it on. It sends a nickname and game numbers, never a path, a project or an agent's name.
import { cleanNick } from "./game.js";

export const boardReady = (url) => /^https:\/\/\S+$/.test(url ?? "");

export const boardBody = (state) => ({ nick: cleanNick(state.nick), wool: state.lifetime, wolves: state.wolves, longestMin: Math.floor(state.longestMs / 60000), peak: state.peak });

const trimmed = (url) => url.replace(/\/+$/, "");
const SHOWN = 50;
const goodRow = (row) => typeof row?.nick === "string" && ["wool", "wolves", "longestMin"].every((field) => Number.isFinite(row[field]));

export async function sendScore(url, state, request) {
  if (!boardReady(url) || !state.boardOn || !cleanNick(state.nick)) return { ok: false, error: "Off" };
  try {
    const reply = await request(`${trimmed(url)}/score`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(boardBody(state)) });
    return reply.ok ? { ok: true } : { ok: false, error: `The board said ${reply.status}` };
  } catch (e) {
    return { ok: false, error: `Couldn't reach the board: ${e?.message ?? e}` };
  }
}

export async function topScores(url, state, request) {
  if (!boardReady(url)) return { rows: [], error: "Off" };
  if (!state.boardOn) return { rows: [], error: null };
  try {
    const reply = await request(`${trimmed(url)}/top`, {});
    if (!reply.ok) return { rows: [], error: `The board said ${reply.status}` };
    const value = await reply.json();
    return { rows: Array.isArray(value?.rows) ? value.rows.filter(goodRow).slice(0, SHOWN) : [], error: null };
  } catch (e) {
    return { rows: [], error: `Couldn't reach the board: ${e?.message ?? e}` };
  }
}
