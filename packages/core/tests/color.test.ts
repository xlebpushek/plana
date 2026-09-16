import { describe, expect, it } from "vitest";

import { colorDistance, rgba, selectionEdgeColor } from "../src/style/color.js";

describe("selectionEdgeColor", () => {
  it("returns a soft warm accent distinct from blue wall edges", () => {
    const passive = rgba(96, 165, 250);
    const selected = selectionEdgeColor(passive);
    expect(colorDistance(selected, passive)).toBeGreaterThan(60);
    // Prefer reddish/coral family for typical CAD blues.
    expect(selected.r).toBeGreaterThan(selected.b);
  });

  it("avoids blending into a red passive edge", () => {
    const passive = rgba(220, 80, 70);
    const selected = selectionEdgeColor(passive);
    expect(colorDistance(selected, passive)).toBeGreaterThan(50);
  });

  it("keeps distance from nearby similar colors", () => {
    const passive = rgba(96, 165, 250);
    const nearby = [rgba(248, 113, 113), rgba(252, 211, 77)];
    const selected = selectionEdgeColor(passive, nearby);
    for (const n of nearby) {
      expect(colorDistance(selected, n)).toBeGreaterThan(35);
    }
  });
});
