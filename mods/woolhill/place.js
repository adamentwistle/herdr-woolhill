// Pin to bottom strip, from the overlay. It reads the shown layout as it is now, so the button says what the window shows.
// A layout that already has a woolhill block shows or hides it. One without gets the strip under the terminals, in the
// column that holds them, if the layout is the person's own. Herdr's shipped layouts can't take new blocks, so there the
// button isn't offered.
const STRIP = { type: "block", size: { px: 144 }, min: 96, max: 320, content: { mod: "woolhill" } };

export const SHIPPED = ["main", "terminals", "win98"];

const kids = (node) => (Array.isArray(node?.children) ? node.children : []);
const holdsTerminals = (node) => node?.content?.tab !== undefined || kids(node).some(holdsTerminals);

// The nodes from the root down to the woolhill block, or null.
function pathToStrip(node, trail = []) {
  if (!node || typeof node !== "object") return null;
  const here = [...trail, node];
  if (node.content?.mod === "woolhill") return here;
  for (const child of kids(node)) {
    const found = pathToStrip(child, here);
    if (found) return found;
  }
  return null;
}

export const hasStrip = (node) => pathToStrip(node) !== null;

function freeId(tree, base) {
  const taken = new Set();
  const visit = (node) => { if (node?.id) taken.add(node.id); kids(node).forEach(visit); };
  visit(tree);
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

// A copy of the layout with the strip in it, or null if there's nowhere to put it.
export function withStrip(tree) {
  const copy = JSON.parse(JSON.stringify(tree));
  const id = freeId(copy, "woolhill");
  const visit = (node) => {
    const list = kids(node);
    if (node.type === "column") {
      const at = list.findIndex(holdsTerminals);
      if (at >= 0) {
        list.splice(at + 1, 0, { id, ...STRIP });
        return true;
      }
    }
    return list.some(visit);
  };
  return visit(copy) ? copy : null;
}

// What the button would do: null when there's nothing it can do, else whether it's pinned and the commands that flip it.
export function pinPlan(tree, layoutName) {
  if (!tree || typeof tree !== "object") return null;
  const mine = !SHIPPED.includes(String(layoutName ?? ""));
  const path = pathToStrip(tree);
  if (!path) {
    const placed = mine ? withStrip(tree) : null;
    return placed ? { pinned: false, commands: [["layout.set", { layout: placed }]] } : null;
  }
  const strip = path.at(-1), pinned = path.every((node) => !node.hidden);
  if (!strip.id) return null;
  if (pinned) return { pinned, commands: [["layout.hide", { id: strip.id }]] };
  const hidden = path.filter((node) => node.hidden);
  if (hidden.some((node) => !node.id)) return null;
  return { pinned, commands: hidden.map((node) => ["layout.show", { id: node.id }]) };
}
