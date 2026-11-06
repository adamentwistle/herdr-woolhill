// Who is where on the hill and what they're doing. It holds no pictures: scene.js draws what's here. Every move is a start, a
// target and a length, because the walk itself is the app's own `.transition("left")`. So this only runs when something
// starts or stops. `rand` is passed in so a test can fix it.
export const TICK_MS = 2000;
export const REST_MS = 10000;
export const SLEEP_AFTER_MS = 300000;
export const SHEEP_W = 72, SHEEP_H = 45, WOLF_W = 84, WOLF_H = 42, DOG_W = 48, DOG_H = 39;
const EDGE = 12;
const WALK_SPEED = 20, WOLF_SPEED = 24, FLEE_SPEED = 240, DOG_SPEED = 70;
const LANES = 3;
const TUFT_MS = 14000, LABEL_MS = 3000, TUFT_W = 27;

// How far off the wolf stands, in pixels, by how long the agent has waited. It comes closer in steps and then stays.
const WOLF_STEPS = [[0, 190], [60000, 150], [180000, 118], [360000, 92], [600000, 72]];
export const wolfGap = (waited) => WOLF_STEPS.reduce((gap, [after, px]) => (waited >= after ? px : gap), WOLF_STEPS[0][1]);

export const newFlock = () => ({ sheep: new Map(), wolves: new Map(), tufts: [], dog: null, nextTuft: 0 });

// Whole ticks, so a walk ends on a tick and the feet stop when the sheep does.
const walkLength = (px, speed) => Math.max(1, Math.round(px / speed / (TICK_MS / 1000))) * TICK_MS;

export function placeNow(thing, now) {
  if (!thing.moveMs || now >= thing.startedAt + thing.moveMs) return thing.x;
  return thing.from + (thing.x - thing.from) * ((now - thing.startedAt) / thing.moveMs);
}

function moveTo(thing, x, now, ms) {
  thing.from = placeNow(thing, now);
  thing.x = x;
  thing.startedAt = now;
  thing.moveMs = ms;
  if (x !== thing.from) thing.facing = x > thing.from ? "r" : "l";
}

function stopAt(thing, now) {
  thing.x = placeNow(thing, now);
  thing.from = thing.x;
  thing.moveMs = 0;
}

const span = (width) => Math.max(EDGE, width - SHEEP_W - EDGE);

function newSheep(agent, index, width, now, rand) {
  const x = EDGE + rand() * (span(width) - EDGE);
  return { address: agent.address, x, from: x, startedAt: now, moveMs: 0, facing: rand() < 0.5 ? "l" : "r", lane: index % LANES, mode: "stand", until: 0, restingSince: now, hopping: false };
}

const sideWithRoom = (sheep, width, now) => (placeNow(sheep, now) < width / 2 ? 1 : -1);

// A smaller window or a bigger zoom leaves less hill. Whatever is past the new edge comes back to it.
export function fit(flock, width, now) {
  const room = span(width), moved = new Set();
  for (const sheep of flock.sheep.values()) {
    if (Math.max(sheep.x, placeNow(sheep, now)) <= room) continue;
    sheep.x = sheep.from = room;
    sheep.moveMs = 0;
    sheep.until = 0;
    moved.add(sheep.address);
  }
  const edge = width - WOLF_W / 2;
  for (const wolf of flock.wolves.values()) {
    if (wolf.leaving) continue;
    // One that hasn't set off stays past the edge, so it still walks in.
    const past = wolf.gap !== null && wolf.x > edge;
    if (past) {
      wolf.x = wolf.from = edge;
      wolf.moveMs = 0;
    }
    if (past || moved.has(wolf.address)) {
      wolf.gap = null;
      const sheep = flock.sheep.get(wolf.address);
      if (sheep) wolf.side = sideWithRoom(sheep, width, now);
    }
  }
  for (const tuft of flock.tufts) tuft.x = Math.min(tuft.x, width - TUFT_W);
}

function tendWorking(sheep, width, now, rand) {
  if (now < sheep.until) return false;
  if (sheep.mode === "walk" || rand() < 0.35) {
    sheep.mode = "graze";
    stopAt(sheep, now);
    sheep.until = now + 8000 + Math.round(rand() * 14000);
    return true;
  }
  const reach = 40 + rand() * 130, way = rand() < 0.5 ? -1 : 1;
  let target = placeNow(sheep, now) + reach * way;
  if (target < EDGE || target > span(width)) target = placeNow(sheep, now) - reach * way;
  target = Math.max(EDGE, Math.min(span(width), target));
  const ms = walkLength(Math.abs(target - placeNow(sheep, now)), WALK_SPEED);
  moveTo(sheep, target, now, ms);
  sheep.mode = "walk";
  sheep.until = now + ms;
  return true;
}

function tendResting(sheep, now) {
  const mode = now - sheep.restingSince >= SLEEP_AFTER_MS ? "sleep" : "rest";
  if (sheep.mode === mode && !sheep.moveMs) return false;
  stopAt(sheep, now);
  sheep.mode = mode;
  return true;
}

function tendBlocked(sheep, wolf, now) {
  const facing = wolf ? (wolf.side > 0 ? "r" : "l") : sheep.facing;
  if (sheep.mode === "alert" && sheep.facing === facing) return false;
  stopAt(sheep, now);
  sheep.mode = "alert";
  sheep.facing = facing;
  return true;
}

// A wolf comes in from the side with more room, so it always has somewhere to walk to.
function newWolf(sheep, width, now) {
  const side = sideWithRoom(sheep, width, now);
  const x = side > 0 ? width + 8 : -WOLF_W - 8;
  return { address: sheep.address, side, x, from: x, startedAt: now, moveMs: 0, facing: side > 0 ? "l" : "r", since: now, gap: null, mode: "walk", lane: sheep.lane, leaving: false, doneAt: 0 };
}

function tendWolf(wolf, sheep, width, now) {
  const gap = wolfGap(now - wolf.since);
  if (gap !== wolf.gap) {
    wolf.gap = gap;
    const body = placeNow(sheep, now) + (wolf.side > 0 ? SHEEP_W : -WOLF_W);
    const target = Math.max(-WOLF_W / 2, Math.min(width - WOLF_W / 2, body + wolf.side * gap));
    moveTo(wolf, target, now, walkLength(Math.abs(target - placeNow(wolf, now)), WOLF_SPEED));
    wolf.mode = "walk";
    return true;
  }
  if (wolf.mode === "walk" && now >= wolf.startedAt + wolf.moveMs) {
    wolf.mode = "stand";
    wolf.facing = wolf.side > 0 ? "l" : "r";
    return true;
  }
  return false;
}

function chaseOff(wolf, width, now) {
  const here = placeNow(wolf, now);
  const away = wolf.side > 0 ? width + WOLF_W : -WOLF_W * 2;
  const ms = Math.max(600, Math.round((Math.abs(away - here) / FLEE_SPEED) * 1000));
  moveTo(wolf, away, now, ms);
  wolf.mode = "run";
  wolf.leaving = true;
  wolf.doneAt = now + ms;
}

function tendDog(flock, width, now) {
  const dog = flock.dog, wolf = [...flock.wolves.values()].find((w) => !w.leaving);
  const home = Math.max(EDGE, width - 72);
  let target = home;
  if (wolf) {
    const sheep = flock.sheep.get(wolf.address);
    if (sheep) target = Math.max(EDGE, Math.min(width - DOG_W - EDGE, placeNow(sheep, now) + (wolf.side > 0 ? SHEEP_W + 8 : -DOG_W - 8)));
  }
  if (Math.abs(target - dog.x) > 2) {
    moveTo(dog, target, now, walkLength(Math.abs(target - placeNow(dog, now)), DOG_SPEED));
    dog.mode = "trot";
    return true;
  }
  if (dog.mode === "trot" && now >= dog.startedAt + dog.moveMs) {
    dog.mode = "sit";
    return true;
  }
  return false;
}

// The whole hill, one step on. `events` is what game.js's `observe` returned this time. It says if there's anything new to draw.
export function step(flock, agents, events, now, rand, width, hasDog) {
  let changed = false;
  const seen = new Set();
  agents.forEach((agent, index) => {
    seen.add(agent.address);
    if (!flock.sheep.has(agent.address)) {
      flock.sheep.set(agent.address, newSheep(agent, index, width, now, rand));
      changed = true;
    }
  });
  for (const address of [...flock.sheep.keys()]) {
    if (!seen.has(address)) {
      flock.sheep.delete(address);
      changed = true;
    }
  }

  for (const done of events.finished) {
    const sheep = flock.sheep.get(done.address);
    if (!sheep) continue;
    stopAt(sheep, now);
    sheep.mode = "stand";
    sheep.hopping = true;
    flock.tufts.push({ id: flock.nextTuft++, x: sheep.x + (sheep.facing === "r" ? 6 : SHEEP_W - 33), lane: sheep.lane, wool: done.wool, born: now, labelled: true });
    changed = true;
  }

  for (const agent of agents) {
    const sheep = flock.sheep.get(agent.address);
    const wolf = flock.wolves.get(agent.address);
    if (agent.status === "blocked") {
      // A new wolf is drawn once at the edge before it sets off, or it would simply appear on the hill.
      if (!wolf) {
        flock.wolves.set(agent.address, newWolf(sheep, width, now));
        tendBlocked(sheep, flock.wolves.get(agent.address), now);
        changed = true;
        continue;
      }
      changed = tendBlocked(sheep, wolf, now) || changed;
      changed = tendWolf(wolf, sheep, width, now) || changed;
      continue;
    }
    if (wolf && !wolf.leaving) {
      chaseOff(wolf, width, now);
      changed = true;
    }
    if (agent.status === "working") {
      sheep.restingSince = now;
      if (sheep.mode === "alert" || sheep.mode === "rest" || sheep.mode === "sleep" || sheep.mode === "stand") sheep.until = 0;
      changed = tendWorking(sheep, width, now, rand) || changed;
    } else if (!sheep.hopping) {
      changed = tendResting(sheep, now) || changed;
    }
  }

  for (const [address, wolf] of flock.wolves) {
    if (wolf.leaving && now >= wolf.doneAt) {
      flock.wolves.delete(address);
      changed = true;
    } else if (!wolf.leaving && !seen.has(address)) {
      chaseOff(wolf, width, now);
      changed = true;
    }
  }

  for (const tuft of flock.tufts) {
    if (tuft.labelled && now - tuft.born >= LABEL_MS) {
      tuft.labelled = false;
      changed = true;
    }
  }
  const kept = flock.tufts.filter((tuft) => now - tuft.born < TUFT_MS);
  if (kept.length !== flock.tufts.length) changed = true;
  flock.tufts = kept;

  if (hasDog && !flock.dog) {
    const x = Math.max(EDGE, width - 72);
    flock.dog = { x, from: x, startedAt: now, moveMs: 0, facing: "l", mode: "sit", lane: 1 };
    changed = true;
  } else if (!hasDog && flock.dog) {
    flock.dog = null;
    changed = true;
  }
  if (flock.dog) changed = tendDog(flock, width, now) || changed;
  return changed;
}

// Ends a hop. `main.js` calls it a moment after the sheep went up.
export function land(flock) {
  for (const sheep of flock.sheep.values()) sheep.hopping = false;
}

// Is anything on the hill going to change by itself? When not, the fast tick stops and the app draws nothing.
export const moving = (flock, agents) => agents.some((a) => a.status === "working" || a.status === "blocked") || flock.wolves.size > 0 || flock.tufts.length > 0 || flock.dog?.mode === "trot" || [...flock.sheep.values()].some((s) => s.hopping || s.moveMs > 0);
