// Stand-ins for Herdr's modules, so the mod's own files can run under `node --test`. An element records every call, so a test
// can read its text, count it and press what's pressable. This proves the mod's logic, not that the real app accepts its
// calls: `herdr-app check` does that.
import { registerHooks } from "node:module";

export class El {
  constructor(tag) { this.tag = tag; this.kids = []; this.calls = []; this.press = null; this.elementId = null; this.path = null; this.tip = null; this.sized = null; }
  child(value) { if (value !== undefined && value !== null) this.kids.push(value); return this; }
  children(list) { for (const value of list) this.child(value); return this; }
  when(on, change) { return on ? change(this) : this; }
  on_click(press) { this.press = press; return this; }
  on_size_change(handler) { this.sized = handler; return this; }
  tooltip(text) { this.tip = text; return this; }
  id(value) { this.elementId = value; return this; }
  hover(style) { style(element("hover")); return this; }
  text() { return this.kids.map((k) => (k instanceof El ? k.text() : String(k))).join(" "); }
  all() { return [this, ...this.kids.flatMap((k) => (k instanceof El ? k.all() : []))]; }
  find(id) { return this.all().find((el) => el.elementId === id) ?? null; }
  paths() { return this.all().map((el) => el.path).filter(Boolean); }
  called(name) { return this.calls.filter(([method]) => method === name).map(([, args]) => args); }
}

export const element = (tag) => new Proxy(new El(tag), {
  get(target, name, self) {
    if (name in target || typeof name === "symbol") {
      const value = target[name];
      return typeof value === "function" ? value.bind(self) : value;
    }
    return (...args) => { target.calls.push([name, args]); return self; };
  },
});

export const image = (path) => {
  const el = element("image");
  el.path = path;
  return el;
};

// What the fake `herdr` module reads and records. A test sets these.
export const world = {
  agents: [], props: {}, shared: {}, ran: [], closed: [], dark: true, zoom: 1, platform: "windows", tree: { type: "row", children: [] }, layoutName: "main",
  exec: async () => ({ code: 0, stdout: "", stderr: "" }), execs: [], files: {}, gone: [], commands: [],
};

export const resetWorld = () => Object.assign(world, { agents: [], props: {}, shared: {}, ran: [], closed: [], dark: true, zoom: 1, platform: "windows", tree: { type: "row", children: [] }, layoutName: "main", exec: async () => ({ code: 0, stdout: "", stderr: "" }), execs: [], files: {}, gone: [], commands: [] });

export const theme = Object.fromEntries(["background", "canvas", "surface", "popover", "raised", "border", "input", "foreground", "muted", "dim", "accent", "solid", "solid_foreground", "blocked", "working", "done", "idle", "hover", "selected"]
  .map((name, i) => [name, `#${String(i + 10).repeat(3)}`]));

const stubs = {
  "gpui-kit": `import { element, image as picture } from ${JSON.stringify(import.meta.url)};
export class View {}
export const div = () => element("div");
export const image = picture;`,
  "gpui-base": `import { element } from ${JSON.stringify(import.meta.url)};
export const v_flex = () => element("v_flex");
export const h_flex = () => element("h_flex");
export const Input = { new: () => element("input") };
export const InputState = { new: ({ value }) => ({ text: value, value() { return this.text; }, on() { return true; } }) };`,
  herdr: `import { world, theme as colours } from ${JSON.stringify(import.meta.url)};
export const agents = () => world.agents;
export const appHome = () => "/h/.config/herdr-app";
export const closeOverlay = (id) => { world.closed.push(id); };
export const exec = (command, args) => { world.execs.push({ command, args }); return world.exec(command, args); };
export const home = () => "/h";
export const layout = () => world.tree;
export const nextCommand = () => (world.commands.length ? Promise.resolve(world.commands.shift()) : new Promise(() => {}));
export const props = () => world.props;
export const run = (name, args) => { world.ran.push({ name, args }); return null; };
export const setShared = (key, value) => { world.shared[key] = value; return null; };
export const settings = () => ({ zoom: world.zoom, dark: world.dark });
export const shared = (key) => (key === "layout" ? world.layoutName : world.shared[key]);
export const theme = () => colours;
export const window = () => ({ platform: world.platform });`,
  "fs/promises": `import { world } from ${JSON.stringify(import.meta.url)};
export const mkdir = async () => {};
export const writeFile = async (path, value) => { world.files[path] = value; };
export const unlink = async (path) => { world.gone.push(path); delete world.files[path]; };`,
};

registerHooks({
  resolve(specifier, context, next) {
    if (specifier in stubs) return { url: `stub:${specifier}`, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith("stub:")) return { format: "module", source: stubs[url.slice(5)], shortCircuit: true };
    return next(url, context);
  },
});

// A cx whose sleeps pass at once. Timers are held, so a test runs them by hand.
export function fakeCx() {
  const tasks = [];
  const cx = {
    notified: 0, repeating: [], later: [], copied: [],
    notify() { this.notified += 1; },
    write_to_clipboard(text) { this.copied.push(text); },
    sleep: () => Promise.resolve(),
    spawn(body) { tasks.push(body(cx)); },
    timer: {
      every(ms, handler) {
        const task = { ms, handler, cancelled: false, cancel() { this.cancelled = true; } };
        cx.repeating.push(task);
        return task;
      },
      after(ms, handler) { cx.later.push({ ms, handler }); },
    },
    live: () => cx.repeating.filter((task) => !task.cancelled),
    settled: async () => { while (tasks.length) await Promise.race([tasks.shift(), new Promise((done) => setImmediate(done))]); },
  };
  return cx;
}
