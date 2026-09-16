import { describe, expect, it } from "vitest";

import {
  collectWallSegments,
  computeWallEndCapHiding,
  pointInWallFootprint,
} from "../src/walls.js";
import type { PlanaDocument } from "@plana/core";
import { createDocument, addObject, identityTransform } from "@plana/core";

function wallDoc(): PlanaDocument {
  let doc = createDocument();
  doc = addObject(doc, {
    id: "h",
    type: "wall",
    transform: identityTransform(),
    geometry: {
      type: "wall",
      path: {
        type: "polyline",
        points: [
          [0, 0, 0],
          [4000, 0, 0],
        ],
        closed: false,
      },
      thickness: 200,
      height: { start: 2700, end: 2700 },
      baseZ: 0,
    },
  });
  // T-junction into the middle of h
  doc = addObject(doc, {
    id: "v",
    type: "wall",
    transform: identityTransform(),
    geometry: {
      type: "wall",
      path: {
        type: "polyline",
        points: [
          [2000, 0, 0],
          [2000, 3000, 0],
        ],
        closed: false,
      },
      thickness: 200,
      height: { start: 2700, end: 2700 },
      baseZ: 0,
    },
  });
  return doc;
}

describe("wall junctions", () => {
  it("detects stem end inside through-wall footprint", () => {
    const segs = collectWallSegments(wallDoc());
    const h = segs.find((s) => s.id === "h")!;
    const v = segs.find((s) => s.id === "v")!;
    expect(pointInWallFootprint(v.a[0], v.a[1], h)).toBe(true);
    expect(pointInWallFootprint(v.b[0], v.b[1], h)).toBe(false);
  });

  it("hides only the junction end cap on the stem wall", () => {
    const hiding = computeWallEndCapHiding(collectWallSegments(wallDoc()));
    expect(hiding.get("v")).toEqual({ hideStart: true, hideEnd: false });
  });
});
