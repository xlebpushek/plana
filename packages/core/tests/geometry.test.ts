import { describe, expect, it } from "vitest";

import { GeometrySchema, geometryBounds } from "../src/index.js";

describe("organic geometry", () => {
  it("parses lathe, tube and leaf", () => {
    const lathe = GeometrySchema.parse({
      type: "lathe",
      profile: [
        [0, 0],
        [40, 20],
        [30, 80],
      ],
    });
    expect(lathe.type).toBe("lathe");
    const tube = GeometrySchema.parse({
      type: "tube",
      points: [
        [0, 0, 0],
        [0, 0, 100],
      ],
      radius: [10, 4],
    });
    expect(tube.type).toBe("tube");
    const leaf = GeometrySchema.parse({
      type: "leaf",
      length: 30,
      width: 12,
      thickness: 1,
    });
    expect(leaf.type).toBe("leaf");
  });

  it("bounds a lathe from profile radius and height", () => {
    const bounds = geometryBounds({
      type: "lathe",
      profile: [
        [10, 0],
        [50, 40],
        [20, 90],
      ],
      segments: 16,
    });
    expect(bounds.min[0]).toBe(-50);
    expect(bounds.max[0]).toBe(50);
    expect(bounds.min[2]).toBe(0);
    expect(bounds.max[2]).toBe(90);
  });
});
