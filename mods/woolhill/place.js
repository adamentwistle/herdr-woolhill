// Herdr doesn't dock a new mod into a shipped layout, so the overlay offers to add the strip. It goes under the terminals, in
// the column that holds them.
const STRIP = { id: "woolhill", type: "block", size: { px: 144 }, min: 96, max: 320, content: { mod: "woolhill" } };

const holdsTerminals = (node) => node?.content?.tab !== undefined || (node?.children ?? []).some(holdsTerminals);

export function hasStrip(node) {
  if (node?.content?.mod === "woolhill") return true;
  return (node?.children ?? []).some(hasStrip);
}

// A copy of the layout with the strip in it, or null if there's nowhere to put it.
export function withStrip(tree) {
  const copy = JSON.parse(JSON.stringify(tree));
  const visit = (node) => {
    const kids = node.children ?? [];
    if (node.type === "column") {
      const at = kids.findIndex(holdsTerminals);
      if (at >= 0) {
        kids.splice(at + 1, 0, { ...STRIP });
        return true;
      }
    }
    return kids.some(visit);
  };
  return visit(copy) ? copy : null;
}

export const SHIPPED = ["main", "terminals", "win98"];
