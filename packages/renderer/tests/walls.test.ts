import { describe, expect, it } from "vitest";

import {
  clipEdgesInsideWalls,
  collectWallSegments,
  computeRoomCornerVerticals,
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

  it("hides only the junction end seam on the stem wall", () => {
    const hiding = computeWallEndCapHiding(collectWallSegments(wallDoc()));
    expect(hiding.get("v")).toEqual({ hideStartSeam: true, hideEndSeam: false });
  });

  it("detects L-corner seams on both walls", () => {
    let doc = createDocument();
    doc = addObject(doc, {
      id: "north",
      type: "wall",
      transform: identityTransform(),
      geometry: {
        type: "wall",
        path: {
          type: "polyline",
          points: [
            [0, 75, 0],
            [6420, 75, 0],
          ],
          closed: false,
        },
        thickness: 150,
        height: { start: 2700, end: 2700 },
        baseZ: 0,
      },
    });
    doc = addObject(doc, {
      id: "east",
      type: "wall",
      transform: identityTransform(),
      geometry: {
        type: "wall",
        path: {
          type: "polyline",
          points: [
            [6345, 0, 0],
            [6345, 3000, 0],
          ],
          closed: false,
        },
        thickness: 150,
        height: { start: 2700, end: 2700 },
        baseZ: 0,
      },
    });
    const hiding = computeWallEndCapHiding(collectWallSegments(doc));
    expect(hiding.get("north")?.hideEndSeam).toBe(true);
    expect(hiding.get("east")?.hideStartSeam).toBe(true);
    const corners = computeRoomCornerVerticals(collectWallSegments(doc));
    expect(corners).toHaveLength(2);
    const pts = corners.map((c) => [c.x, c.y] as const);
    const near = (x: number, y: number) =>
      pts.some((p) => Math.hypot(p[0] - x, p[1] - y) < 2);
    expect(near(6420, 0)).toBe(true);
    expect(near(6270, 150)).toBe(true);
  });

  it("places NW L-corner at outer (0,0) and inner (150,150)", () => {
    let doc = createDocument();
    doc = addObject(doc, {
      id: "north",
      type: "wall",
      transform: identityTransform(),
      geometry: {
        type: "wall",
        path: {
          type: "polyline",
          points: [
            [0, 75, 0],
            [4000, 75, 0],
          ],
          closed: false,
        },
        thickness: 150,
        height: { start: 2700, end: 2700 },
        baseZ: 0,
      },
    });
    doc = addObject(doc, {
      id: "west",
      type: "wall",
      transform: identityTransform(),
      geometry: {
        type: "wall",
        path: {
          type: "polyline",
          points: [
            [75, 0, 0],
            [75, 3000, 0],
          ],
          closed: false,
        },
        thickness: 150,
        height: { start: 2700, end: 2700 },
        baseZ: 0,
      },
    });
    const corners = computeRoomCornerVerticals(collectWallSegments(doc));
    expect(corners).toHaveLength(2);
    const pts = corners.map((c) => [c.x, c.y] as const);
    const near = (x: number, y: number) =>
      pts.some((p) => Math.hypot(p[0] - x, p[1] - y) < 2);
    expect(near(0, 0)).toBe(true);
    expect(near(150, 150)).toBe(true);
  });
});

describe("plan outline", () => {
  const segments = () => {
    let doc = createDocument();
    doc = addObject(doc, {
      id: "north",
      type: "wall",
      transform: identityTransform(),
      geometry: {
        type: "wall",
        path: {
          type: "polyline",
          points: [
            [0, 75, 0],
            [4000, 75, 0],
          ],
          closed: false,
        },
        thickness: 150,
        height: { start: 2700, end: 2700 },
        baseZ: 0,
      },
    });
    doc = addObject(doc, {
      id: "west",
      type: "wall",
      transform: identityTransform(),
      geometry: {
        type: "wall",
        path: {
          type: "polyline",
          points: [
            [75, 0, 0],
            [75, 3000, 0],
          ],
          closed: false,
        },
        thickness: 150,
        height: { start: 2700, end: 2700 },
        baseZ: 0,
      },
    });
    return collectWallSegments(doc);
  };

  it("drops the part of an inner face buried in the neighbouring wall", () => {
    const inner = new Float32Array([0, 150, 100, 4000, 150, 100]);
    const out = clipEdgesInsideWalls(inner, "north", segments());
    expect(out.length).toBe(6);
    expect(out[0]).toBeGreaterThan(140);
    expect(out[3]).toBeCloseTo(4000, 3);
  });

  it("keeps the apartment outline running to the outer corner", () => {
    const outer = new Float32Array([0, 0, 100, 4000, 0, 100]);
    const out = clipEdgesInsideWalls(outer, "north", segments());
    expect(out.length).toBe(6);
    expect(out[0]).toBeCloseTo(0, 3);
  });
});
