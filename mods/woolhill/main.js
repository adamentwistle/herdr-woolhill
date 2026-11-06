// Woolhill: a hillside strip where your agents are a flock, and the overlay where the wool is spent. One mod, two roles: an
// overlay copy has `props().overlay`, and only the strip earns. Rules are in game.js, the flock's moves in flock.js.
import { View } from "gpui-kit";
import { InputState } from "gpui-base";
import * as fs from "fs/promises";
import { agents, appHome, closeOverlay, exec, home, layout, nextCommand, props, run, setShared, settings, shared, theme, window as appWindow } from "herdr";
import { boardReady, sendScore, topScores } from "./board.js";
import { decodeCommand, makeCard } from "./card.js";
import { LEADERBOARD_URL } from "./config.js";
import { DEMO_KEY, STATE_KEY, breedOf, breedsOwned, brag, buy, cleanNick, fresh, observe, owns, readState, settle, useSeason } from "./game.js";
import { DEMO_SPOTS, demoAgents, demoBoard, demoState } from "./demo.js";
import { REST_MS, SHEEP_W, TICK_MS, fit, land, moving, newFlock, step } from "./flock.js";
import { SHIPPED, hasStrip, withStrip } from "./place.js";
import { stripView } from "./scene.js";
import { overlayView } from "./shop.js";
import { appSize } from "./world.js";

const HOP_MS = 190;
const PAGES = ["shop", "flock", "share", "board"];
// Herdr can stop a task. After this long, going back to Share starts the card again.
const DRAW_LIMIT_MS = 8000;
const CARD_FOLDER = "data/woolhill";
// Until the app reports a size, in its own units.
const FIRST_BOX = { width: 1000, height: 144 };

const statuses = (list) => list.map((agent) => `${agent.address}=${agent.status}`).join();

export default class Woolhill extends View {
  init(_initial, cx) {
    const given = props() ?? {};
    this.overlay = given.overlay ?? null;
    this.demo = Boolean(given.demo) || (this.overlay != null && shared(DEMO_KEY) === true);
    this.hourOverride = Number.isFinite(given.hour) ? given.hour : null;
    this.demoSeason = typeof given.season === "string" ? given.season : null;
    this.pixels = null;
    this.note = null;
    if (this.overlay != null) this.openOverlay(given, cx);
    else this.openStrip(cx);
  }

  // The box in the app's own units. The size is kept as reported, so a zoom change needs no new report.
  box() {
    return this.pixels ? appSize(this.pixels, settings().zoom) : FIRST_BOX;
  }

  get width() {
    return this.box().width;
  }

  async close() {
    this.closed = true;
    this.ticker?.cancel();
    if (this.demo && this.overlay == null) setShared(DEMO_KEY, false);
    await this.dropCard(this.lastCard);
  }

  state() {
    if (this.demo) return this.demoSave ?? (this.demoSave = { ...demoState(), season: this.demoSeason ?? "summer" });
    return readState(shared(STATE_KEY));
  }

  save(state) {
    if (this.demo) this.demoSave = state;
    else setShared(STATE_KEY, state);
  }

  // The strip.

  openStrip(cx) {
    setShared(DEMO_KEY, this.demo);
    this.flock = newFlock();
    this.fast = null;
    this.clock = this.now();
    if (this.demo) {
      this.stageDemo();
      return;
    }
    this.save(settle(this.state(), agents()));
    this.tick(cx);
  }

  now() {
    const date = new Date();
    return { hour: this.hourOverride ?? date.getHours(), minute: this.hourOverride == null ? date.getMinutes() : 0 };
  }

  // Two speeds. Fast while anything on the hill is going to change. Otherwise it only looks at the agents now and then, and
  // draws nothing unless one has changed or the sky has.
  pace(cx, fast) {
    if (this.fast === fast) return;
    this.fast = fast;
    this.ticker?.cancel();
    this.ticker = cx.timer.every(fast ? TICK_MS : REST_MS, (cx) => this.tick(cx));
  }

  tick(cx) {
    if (this.closed) return;
    const list = agents(), now = Date.now();
    this.looked = statuses(list);
    const seen = observe(this.state(), list, now);
    if (seen.changed) this.save(seen.state);
    const changed = step(this.flock, list, seen, now, Math.random, this.width, owns(seen.state, "dog"));
    if (seen.finished.length) {
      cx.timer.after(HOP_MS, (cx) => {
        land(this.flock);
        cx.notify();
      });
    }
    const clock = this.now(), skyMoved = clock.hour !== this.clock.hour || Math.floor(clock.minute / 5) !== Math.floor(this.clock.minute / 5);
    this.clock = clock;
    if (changed || skyMoved) cx.notify();
    this.pace(cx, moving(this.flock, list));
  }

  jump(address) {
    if (this.demo) return;
    const agent = agents().find((a) => a.address === address);
    if (!agent) return;
    if (agent.pane) run("pane.focus", { pane: agent.pane });
    else run("agent.focus", { terminal: address });
  }

  label(address) {
    const list = this.demo ? demoAgents() : agents();
    const agent = list.find((a) => a.address === address);
    if (!agent) return "";
    // A tab nobody named goes by its position, which says nothing here.
    return !agent.tab_name || /^[0-9]+$/.test(agent.tab_name) ? agent.space_name : agent.tab_name;
  }

  stageDemo() {
    const list = demoAgents(), span = () => Math.max(0, this.width - SHEEP_W - 24);
    const now = Date.now(), flock = newFlock();
    for (const agent of list) {
      const spot = DEMO_SPOTS[agent.address], x = 12 + spot.spread * span();
      flock.sheep.set(agent.address, { address: agent.address, x, from: x, startedAt: now, moveMs: 0, facing: spot.facing, lane: spot.lane, mode: spot.mode, until: 0, restingSince: now, hopping: false });
    }
    const blocked = flock.sheep.get("d3"), done = flock.sheep.get("d6");
    const wolf = (address, x, side, mode, lane) => ({ address, side, x, from: x, startedAt: now, moveMs: 0, facing: side > 0 ? "l" : "r", since: now, gap: 96, mode, lane, leaving: false, doneAt: 0 });
    flock.wolves.set("d3", wolf("d3", blocked.x + SHEEP_W + 64, 1, "stand", 2));
    flock.wolves.set("far", wolf("far", 12 + 0.2 * span(), -1, "walk", 0));
    flock.tufts.push({ id: 0, x: done.x + 60, lane: 2, wool: 12, born: now, labelled: true });
    flock.dog = { x: blocked.x + SHEEP_W + 10, from: 0, startedAt: now, moveMs: 0, facing: "r", mode: "sit", lane: 2 };
    this.flock = flock;
  }

  breedFor(address) {
    return breedOf(address, breedsOwned(this.state()));
  }

  // The overlay.

  openOverlay(given, cx) {
    this.page = given.page ?? "shop";
    this.cardPath = null; this.cardFailed = false; this.saving = false; this.boardRows = null;
    this.nickInput = InputState.new({ placeholder: "Nickname", value: this.state().nick });
    this.nickInput.on("change", (_e, cx) => {
      this.save({ ...this.state(), nick: cleanNick(this.nickInput.value()) });
      cx.notify();
    });
    if (this.page !== "shop") this.goTo(this.page, cx);
    // Keys can name a page: "woolhill.flock".
    cx.spawn(async (cx) => {
      while (!this.closed) {
        const command = await nextCommand();
        if (command === "place") this.placeStrip(cx);
        else if (command === "save") this.saveCard(cx);
        else if (command === "copy") this.copyLine(cx);
        else if (PAGES.includes(command) && (command !== "board" || this.boardShown())) this.goTo(command, cx);
      }
    });
  }

  look() {
    return settings().dark ? "dark" : "light";
  }

  boardShown() {
    return this.demo || boardReady(LEADERBOARD_URL);
  }

  nickOk() {
    return Boolean(cleanNick(this.state().nick));
  }

  needsStrip() {
    return !this.demo && !hasStrip(layout());
  }

  goTo(page, cx) {
    this.page = page;
    this.note = null;
    if (page === "share") this.drawCard(cx);
    if (page === "board") this.loadBoard(cx);
    cx.notify();
  }

  purchase(id, cx) {
    this.save(buy(this.state(), id));
    this.note = null;
    cx.notify();
  }

  pickSeason(season, cx) {
    this.save(useSeason(this.state(), season));
    cx.notify();
  }

  bragLine() {
    return brag(this.state());
  }

  copyLine(cx) {
    cx.write_to_clipboard(this.bragLine());
    this.note = { text: "Copied." };
    cx.notify();
  }

  // Turns the base64 text into a PNG. A mod can only write inside its app folder, but the system's own tool can write anywhere.
  async decode(text, to) {
    const [command, args] = decodeCommand(appWindow().platform, `${appHome()}/${text}`, to);
    const result = await exec(command, args);
    if (result.code !== 0) throw new Error(result.stderr || result.stdout || `${command} stopped with ${result.code}`);
  }

  async dropCard(card) {
    if (!card) return;
    for (const file of [card.png, card.text]) await fs.unlink(`${appHome()}/${file}`).catch(() => {});
  }

  // Runs the card's steps with a pause between, so each gets a task's limit of its own. New file names each time, because the
  // app keeps an image it has already loaded, and each card has its own text, so Save card saves the one on show.
  drawCard(cx) {
    if (this.saving || (this.drawing && Date.now() - this.drawing < DRAW_LIMIT_MS)) return;
    this.drawing = Date.now();
    this.cardPath = null; this.cardFailed = false;
    const card = makeCard({ state: this.state(), demo: this.demo }), stamp = Date.now();
    const made = { png: `${CARD_FOLDER}/card-${stamp}.png`, text: `${CARD_FOLDER}/card-${stamp}.b64` };
    cx.spawn(async (cx) => {
      try {
        for (let at = 0; at < card.steps.length && !this.closed; at++) {
          card.steps[at]();
          await cx.sleep(1);
        }
        if (this.closed) return;
        await fs.mkdir(`${appHome()}/${CARD_FOLDER}`, { recursive: true });
        await fs.writeFile(`${appHome()}/${made.text}`, card.made.base64);
        await this.decode(made.text, `${appHome()}/${made.png}`);
        if (this.closed) return this.dropCard(made);
        const old = this.lastCard;
        this.lastCard = made;
        this.cardText = made.text;
        this.cardPath = made.png;
        await this.dropCard(old);
      } catch (e) {
        await this.dropCard(made);
        this.cardFailed = true;
        this.note = { text: `The card failed: ${e?.message ?? e}`, bad: true };
      }
      this.drawing = 0;
      cx.notify();
    });
  }

  saveCard(cx) {
    if (!this.cardPath || this.saving) return;
    this.saving = true;
    cx.notify();
    const to = `${home()}/Downloads/woolhill-card-${Date.now()}.png`;
    cx.spawn(async (cx) => {
      try {
        await this.decode(this.cardText, to);
        this.note = { text: `Saved to ${to.replace(home(), "~")}` };
      } catch (e) {
        this.note = { text: `Couldn't save: ${e?.message ?? e}`, bad: true };
      }
      this.saving = false;
      cx.notify();
    });
  }

  loadBoard(cx) {
    if (this.demo) {
      this.boardRows = demoBoard();
      return;
    }
    cx.spawn(async (cx) => {
      const { rows, error } = await topScores(LEADERBOARD_URL, this.state(), fetch);
      this.boardRows = rows;
      if (error) this.note = { text: error, bad: true };
      cx.notify();
    });
  }

  toggleBoard(cx) {
    this.save({ ...this.state(), boardOn: !this.state().boardOn });
    this.loadBoard(cx);
    cx.notify();
  }

  sendBoard(cx) {
    if (this.demo) {
      this.note = { text: "Demo data isn't sent." };
      cx.notify();
      return;
    }
    cx.spawn(async (cx) => {
      const { ok, error } = await sendScore(LEADERBOARD_URL, this.state(), fetch);
      this.note = ok ? { text: "Sent." } : { text: error, bad: true };
      if (ok) this.loadBoard(cx);
      cx.notify();
    });
  }

  // A shipped layout can't change, so this clones it first, as Herdr's own Duplicate does.
  placeStrip(cx) {
    const name = String(shared("layout") ?? "main");
    if (SHIPPED.includes(name)) run("layout.clone", { name, as: `${name}-woolhill` });
    const tree = withStrip(layout());
    if (tree) {
      run("layout.set", { layout: tree });
      closeOverlay(this.overlay);
    } else {
      this.note = { text: "This layout has no terminals to put the hill under.", bad: true };
      cx.notify();
    }
  }

  render(cx) {
    if (this.overlay != null) return overlayView(this, theme());
    // The app renders when an agent changes, which is sooner than the next tick. A short turn would slip between two ticks.
    if (!this.demo && statuses(agents()) !== this.looked) {
      this.looked = statuses(agents());
      cx.timer.after(1, (cx) => this.tick(cx));
    }
    const clock = this.now(), self = this, { width, height } = this.box();
    if (width !== this.laidOut) {
      this.laidOut = width;
      if (this.demo) this.stageDemo();
      else fit(this.flock, width, Date.now());
    }
    const model = {
      flock: this.flock, state: this.state(), width, height, hour: clock.hour, minute: clock.minute,
      look: this.look(),
      breedOf: (address) => self.breedFor(address),
      label: (address) => self.label(address),
      jump: (address) => self.jump(address),
      openShop: () => run("mod.open", { name: "woolhill" }),
    };
    return stripView(model, (size, cx) => {
      if (size.width === this.pixels?.width && size.height === this.pixels?.height) return;
      this.pixels = { width: size.width, height: size.height };
      cx.notify();
    });
  }
}
