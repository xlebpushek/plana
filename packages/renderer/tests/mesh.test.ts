import { describe, expect, it } from "vitest";

import {
  buildFloorMesh,
  buildRenderMesh,
  buildWallMesh,
  WORLD_FROM_MM,
} from "../src/mesh.js";
import type { FloorGeometry, WallGeometry } from "@plana/core";

const wallBase = (over: Partial<WallGeometry> = {}): WallGeometry => ({
  type: "wall",
  path: {
    type: "polyline",
    points: [
      [0, 0, 0],
      [4000, 0, 0],
    ],
  },
  thickness: 200,
  height: { start: 2700, end: 2700 },
  baseZ: 100,
  ...over,
});

describe("buildWallMesh", () => {
  it("builds a single solid wall without cutouts", () => {
    const mesh = buildWallMesh(wallBase());
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.indices!.length).toBe(36); // one box, 12 tris
    expect(mesh.edges!.length).toBeGreaterThan(0);
    // Z spans baseZ..baseZ+height in meters
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 2; i < mesh.positions.length; i += 3) {
      minZ = Math.min(minZ, mesh.positions[i]);
      maxZ = Math.max(maxZ, mesh.positions[i]);
    }
    expect(minZ).toBeCloseTo(100 * WORLD_FROM_MM, 6);
    expect(maxZ).toBeCloseTo(2800 * WORLD_FROM_MM, 6);
  });

  it("composes door cutout as lintel + full runs in one mesh", () => {
    const mesh = buildWallMesh(
      wallBase({
        cutouts: [{ offset: 1000, width: 900, height: 2100, sill: 0 }],
      }),
    );
    // Full left + lintel + full right = 3 boxes → 3*36 indices
    expect(mesh.indices!.length).toBe(3 * 36);
    expect(mesh.positions.length).toBe(3 * 8 * 3);
  });

  it("composes window cutout as sill + lintel + full runs", () => {
    const mesh = buildWallMesh(
      wallBase({
        cutouts: [{ offset: 1200, width: 1400, height: 1400, sill: 900 }],
      }),
    );
    // Full left + sill + lintel + full right = 4 boxes
    expect(mesh.indices!.length).toBe(4 * 36);
  });

  it("passive corners mode keeps only room-corner verticals", () => {
    const plain = buildWallMesh(wallBase(), { mode: "corners" });
    const full = buildWallMesh(wallBase(), { mode: "full" });
    // Plain wall: 4 corner verticals × 6 floats
    expect(plain.edges!.length).toBe(4 * 6);
    expect(full.edges!.length).toBeGreaterThan(plain.edges!.length);
  });

  it("full mode can hide junction top/bottom seams", () => {
    const full = buildWallMesh(wallBase(), {
      mode: "full",
      hideStartSeam: false,
      hideEndSeam: false,
    });
    const fullHidden = buildWallMesh(wallBase(), {
      mode: "full",
      hideStartSeam: true,
      hideEndSeam: true,
    });
    expect(fullHidden.edges!.length).toBeLessThan(full.edges!.length);
  });

  it("selected full mode has more edges than passive corners", () => {
    const full = buildWallMesh(wallBase(), {
      mode: "full",
      hideStartSeam: true,
      hideEndSeam: true,
    });
    const corners = buildWallMesh(wallBase(), {
      mode: "corners",
      hideStartSeam: true,
      hideEndSeam: true,
    });
    expect(full.edges!.length).toBeGreaterThan(corners.edges!.length);
  });
});

describe("buildFloorMesh", () => {
  it("extrudes a rectangular floor as a slab", () => {
    const floor: FloorGeometry = {
      type: "floor",
      outline: [
        [0, 0],
        [5000, 0],
        [5000, 4000],
        [0, 4000],
      ],
      thickness: 150,
      baseZ: 0,
    };
    const mesh = buildFloorMesh(floor);
    expect(mesh.indices!.length).toBe(36);
    let maxZ = -Infinity;
    for (let i = 2; i < mesh.positions.length; i += 3) {
      maxZ = Math.max(maxZ, mesh.positions[i]);
    }
    expect(maxZ).toBeCloseTo(150 * WORLD_FROM_MM, 6);
    // 4 verts × (top + bottom + vertical) = 12 edges × 6 floats
    expect(mesh.edges!.length).toBe(12 * 6);
  });

  it("fan/earcuts an L-shaped floor without holes", () => {
    const floor: FloorGeometry = {
      type: "floor",
      outline: [
        [0, 0],
        [4000, 0],
        [4000, 2000],
        [2000, 2000],
        [2000, 4000],
        [0, 4000],
      ],
      thickness: 100,
      baseZ: 0,
    };
    const mesh = buildFloorMesh(floor);
    expect(mesh.indices!.length).toBeGreaterThanOrEqual(4 * 3 * 2); // ≥4 tris × 2 caps
    expect(mesh.edges!.length).toBe(6 * 3 * 6); // 6 outline verts × 3 edges
  });

  it("builds a rectangular floor with one rectangular hole via slabs", () => {
    const floor: FloorGeometry = {
      type: "floor",
      outline: [
        [0, 0],
        [6000, 0],
        [6000, 5000],
        [0, 5000],
      ],
      holes: [
        [
          [2000, 1500],
          [4000, 1500],
          [4000, 3500],
          [2000, 3500],
        ],
      ],
      thickness: 120,
      baseZ: 50,
    };
    const mesh = buildFloorMesh(floor);
    expect(mesh.indices!.length).toBe(4 * 36);
    // outer 12 + hole 12 edges
    expect(mesh.edges!.length).toBe(24 * 6);
  });
});

describe("buildRenderMesh", () => {
  it("routes floor and wall geometries", () => {
    expect(buildRenderMesh(wallBase())).not.toBeNull();
    expect(
      buildRenderMesh({
        type: "floor",
        outline: [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
        thickness: 10,
        baseZ: 0,
      }),
    ).not.toBeNull();
    expect(buildRenderMesh({ type: "box", size: [1, 1, 1] })).not.toBeNull();
  });
});
