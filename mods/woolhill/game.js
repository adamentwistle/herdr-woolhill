// The rules: what a turn earns, what the shop sells, and what the save holds. Nothing here draws or touches Herdr.
export const STATE_KEY = "woolhill.state";
export const DEMO_KEY = "woolhill.demo";

// Under this, a blocked agent never drew a wolf worth counting: it was a permission that answered itself.
const MIN_WOLF_MS = 3000;
const MAX_WOOL = 40;
const MINUTE = 60000;

export const fresh = () => ({ v: 1, wool: 0, lifetime: 0, wolves: 0, longestMs: 0, turns: 0, peak: 0, owned: [], season: "summer", nick: "", boardOn: false, runs: {} });

const number = (value) => (Number.isFinite(value) && value >= 0 ? value : 0);

// A save from an older build, or one edited by hand, comes back whole.
export function readState(raw) {
  const saved = raw && typeof raw === "object" ? raw : {};
  const state = fresh();
  for (const key of ["wool", "lifetime", "wolves", "longestMs", "turns", "peak"]) state[key] = number(saved[key]);
  if (Array.isArray(saved.owned)) state.owned = saved.owned.filter((id) => CATALOG.some((item) => item.id === id));
  if (seasonsOwned(state).includes(saved.season)) state.season = saved.season;
  if (typeof saved.nick === "string") state.nick = cleanNick(saved.nick);
  state.boardOn = saved.boardOn === true;
  for (const [address, run] of Object.entries(saved.runs && typeof saved.runs === "object" ? saved.runs : {})) {
    if (Number.isFinite(run?.since)) state.runs[address] = { since: run.since, waited: number(run.waited), blockedAt: Number.isFinite(run.blockedAt) ? run.blockedAt : null };
  }
  return state;
}

// More for a longer run, with each extra minute worth less, so one long run can't buy the hill.
export const woolFor = (ms) => Math.min(MAX_WOOL, 1 + Math.floor(2 * Math.sqrt(Math.max(0, ms) / MINUTE)));

export const CATALOG = [
  { id: "fence-1", kind: "fence", name: "Short fence", price: 15, art: "fence" },
  { id: "fence-2", kind: "fence", name: "Long fence", price: 40, art: "fence", after: "fence-1" },
  { id: "fence-3", kind: "fence", name: "Whole fence", price: 90, art: "fence", after: "fence-2" },
  { id: "tree-1", kind: "tree", name: "Tree", price: 30, art: "tree-summer" },
  { id: "tree-2", kind: "tree", name: "Pine", price: 60, art: "pine-summer", after: "tree-1" },
  { id: "tree-3", kind: "tree", name: "Copse", price: 140, art: "tree-summer", after: "tree-2" },
  { id: "pond", kind: "place", name: "Pond", price: 150, art: "pond-summer" },
  { id: "dog", kind: "place", name: "Dog", price: 250, art: "dog-sit-r" },
  { id: "barn", kind: "place", name: "Barn", price: 500, art: "barn" },
  { id: "breed-soot", kind: "breed", breed: "soot", name: "Soot sheep", price: 100, art: "sheep-soot-stand-r" },
  { id: "breed-russet", kind: "breed", breed: "russet", name: "Russet sheep", price: 150, art: "sheep-russet-stand-r" },
  { id: "breed-slate", kind: "breed", breed: "slate", name: "Slate sheep", price: 200, art: "sheep-slate-stand-r" },
  { id: "breed-ridge", kind: "breed", breed: "ridge", name: "Ridge sheep", price: 300, art: "sheep-ridge-stand-r" },
  { id: "breed-gilt", kind: "breed", breed: "gilt", name: "Gilt sheep", price: 1000, art: "sheep-gilt-stand-r" },
  { id: "season-spring", kind: "season", season: "spring", name: "Spring", price: 200, art: "tree-spring" },
  { id: "season-autumn", kind: "season", season: "autumn", name: "Autumn", price: 200, art: "tree-autumn" },
  { id: "season-winter", kind: "season", season: "winter", name: "Winter", price: 300, art: "tree-winter" },
];

export const owns = (state, id) => state.owned.includes(id);

// Locked until the one before it is bought.
export const isLocked = (state, item) => Boolean(item.after) && !owns(state, item.after);

export const canBuy = (state, item) => !owns(state, item.id) && !isLocked(state, item) && state.wool >= item.price;

export function buy(state, id) {
  const item = CATALOG.find((one) => one.id === id);
  if (!item || !canBuy(state, item)) return state;
  const next = { ...state, wool: state.wool - item.price, owned: [...state.owned, id] };
  if (item.kind === "season") next.season = item.season;
  return next;
}

export const seasonsOwned = (state) => ["summer", ...CATALOG.filter((item) => item.kind === "season" && owns(state, item.id)).map((item) => item.season)];

export const useSeason = (state, season) => (seasonsOwned(state).includes(season) ? { ...state, season } : state);

export const breedsOwned = (state) => ["cream", ...CATALOG.filter((item) => item.kind === "breed" && owns(state, item.id)).map((item) => item.breed)];

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// A sheep keeps its breed for as long as the breeds owned stay the same. Buying one lets some of the flock turn into it.
export const breedOf = (address, breeds) => breeds[hash(address) % breeds.length];

// What changed since the last look, from the agents' status alone. A run starts at working and ends at done or idle. Time
// spent blocked isn't run time. An agent that goes away earns nothing and drives nothing off.
export function observe(state, agents, now) {
  const runs = { ...state.runs }, seen = new Set(), finished = [], driven = [];
  let { wool, lifetime, wolves, longestMs, turns, peak } = state;
  for (const agent of agents) {
    seen.add(agent.address);
    const run = runs[agent.address];
    if (agent.status === "working" || agent.status === "blocked") {
      const live = run ?? { since: now, waited: 0, blockedAt: null };
      if (agent.status === "blocked") {
        runs[agent.address] = live.blockedAt == null ? { ...live, blockedAt: now } : live;
        continue;
      }
      runs[agent.address] = release(live, now, agent.address, driven);
    } else if (run) {
      const ended = release(run, now, agent.address, driven);
      const ms = Math.max(0, now - ended.since - ended.waited), earned = woolFor(ms);
      finished.push({ address: agent.address, ms, wool: earned });
      wool += earned;
      lifetime += earned;
      turns += 1;
      longestMs = Math.max(longestMs, ms);
      delete runs[agent.address];
    }
  }
  for (const address of Object.keys(runs)) if (!seen.has(address)) delete runs[address];
  wolves += driven.length;
  peak = Math.max(peak, agents.length);
  const changed = finished.length > 0 || driven.length > 0 || peak !== state.peak || JSON.stringify(runs) !== JSON.stringify(state.runs);
  return { state: changed ? { ...state, wool, lifetime, wolves, longestMs, turns, peak, runs } : state, finished, driven, changed };
}

function release(run, now, address, driven) {
  if (run.blockedAt == null) return run;
  const waited = now - run.blockedAt;
  if (waited >= MIN_WOLF_MS) driven.push({ address, waited });
  return { ...run, blockedAt: null, waited: run.waited + waited };
}

// A run still open from before a restart only counts if its agent is still at it, because nobody saw when it stopped.
export function settle(state, agents) {
  const busy = new Set(agents.filter((a) => a.status === "working" || a.status === "blocked").map((a) => a.address));
  const runs = Object.fromEntries(Object.entries(state.runs).filter(([address]) => busy.has(address)));
  return { ...state, runs };
}

export const count = (n) => Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function span(ms) {
  const minutes = Math.floor(ms / MINUTE);
  if (minutes < 1) return `${Math.floor(ms / 1000)}s`;
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export const brag = (state) => `My Woolhill flock: ${count(state.lifetime)} wool, ${count(state.wolves)} ${state.wolves === 1 ? "wolf" : "wolves"} driven off, longest run ${span(state.longestMs)}.`;

// A nickname is the only words that ever leave the machine, so it stays short and plain.
export const cleanNick = (text) => String(text).replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 16);
