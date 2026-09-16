import type { Geometry, WallGeometry } from "@plana/core";

export type RenderMesh = {
  positions: Float32Array;
  normals?: Float32Array;
  indices?: Uint32Array;
  edges?: Float32Array;
};

export type WallMeshOptions = {
  /** Hide top/bottom end-cap seams at path start (keep vertical corner edges). */
  hideStartSeam?: boolean;
  /** Hide top/bottom end-cap seams at path end. */
  hideEndSeam?: boolean;
};

const MM = 0.001;

function pushBox(
  positions: number[],
  normals: number[],
  indices: number[],
  edges: number[],
  sx: number,
  sy: number,
  sz: number,
  ox = 0,
  oy = 0,
  oz = 0,
) {
  const hx = (sx * MM) / 2;
  const hy = (sy * MM) / 2;
  const hz = sz * MM;
  const base = positions.length / 3;

  const corners: Array<[number, number, number]> = [
    [-hx + ox * MM, -hy + oy * MM, oz * MM],
    [hx + ox * MM, -hy + oy * MM, oz * MM],
    [hx + ox * MM, hy + oy * MM, oz * MM],
    [-hx + ox * MM, hy + oy * MM, oz * MM],
    [-hx + ox * MM, -hy + oy * MM, hz + oz * MM],
    [hx + ox * MM, -hy + oy * MM, hz + oz * MM],
    [hx + ox * MM, hy + oy * MM, hz + oz * MM],
    [-hx + ox * MM, hy + oy * MM, hz + oz * MM],
  ];

  for (const c of corners) positions.push(c[0], c[1], c[2]);
  for (let i = 0; i < 8; i += 1) normals.push(0, 0, 1);

  const faces = [
    [0, 1, 2, 3],
    [4, 7, 6, 5],
    [0, 4, 5, 1],
    [1, 5, 6, 2],
    [2, 6, 7, 3],
    [3, 7, 4, 0],
  ];
  for (const f of faces) {
    indices.push(base + f[0], base + f[1], base + f[2], base + f[0], base + f[2], base + f[3]);
  }

  const edgePairs = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  for (const [a, b] of edgePairs) {
    const ca = corners[a];
    const cb = corners[b];
    edges.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2]);
  }
}

function sampleArc(wall: Extract<WallGeometry["path"], { type: "arc" }>, segments = 24) {
  const points: Array<[number, number, number]> = [];
  const start = wall.startAngle;
  const end = wall.endAngle;
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const angle = start + (end - start) * t;
    points.push([
      wall.center[0] + Math.cos(angle) * wall.radius,
      wall.center[1] + Math.sin(angle) * wall.radius,
      wall.center[2],
    ]);
  }
  return points;
}

type CapKind = "long" | "start-seam" | "end-seam" | "corner";

function pushEdge(
  edges: number[],
  kinds: CapKind[],
  pa: [number, number, number],
  pb: [number, number, number],
  kind: CapKind,
) {
  edges.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2]);
  kinds.push(kind);
}

/**
 * Wall solid + edges. At junctions only the top/bottom end-cap seams are
 * omitted (viewed from above/below). Vertical edges that form inner/outer
 * corners are always kept.
 */
export function buildWallMesh(wall: WallGeometry, options: WallMeshOptions = {}): RenderMesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const edges: number[] = [];
  const kinds: CapKind[] = [];

  const pathPoints =
    wall.path.type === "polyline" ? wall.path.points : sampleArc(wall.path);
  const lastSeg = Math.max(0, pathPoints.length - 2);

  for (let i = 0; i < pathPoints.length - 1; i += 1) {
    const a = pathPoints[i];
    const b = pathPoints[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const t = i / Math.max(1, pathPoints.length - 2);
    const height = wall.height.start + (wall.height.end - wall.height.start) * t;
    const angle = Math.atan2(dy, dx);
    const cx = (a[0] + b[0]) / 2;
    const cy = (a[1] + b[1]) / 2;

    const hx = (len * MM) / 2;
    const hy = (wall.thickness * MM) / 2;
    const hz = height * MM;
    const baseZ = wall.baseZ * MM;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const local: Array<[number, number, number]> = [
      [-hx, -hy, baseZ],
      [hx, -hy, baseZ],
      [hx, hy, baseZ],
      [-hx, hy, baseZ],
      [-hx, -hy, baseZ + hz],
      [hx, -hy, baseZ + hz],
      [hx, hy, baseZ + hz],
      [-hx, hy, baseZ + hz],
    ];

    const world = local.map(([x, y, z]) => {
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      return [rx + cx * MM, ry + cy * MM, z] as [number, number, number];
    });

    const base = positions.length / 3;
    for (const p of world) {
      positions.push(p[0], p[1], p[2]);
      normals.push(0, 0, 1);
    }
    const faces = [
      [0, 1, 2, 3],
      [4, 7, 6, 5],
      [0, 4, 5, 1],
      [1, 5, 6, 2],
      [2, 6, 7, 3],
      [3, 7, 4, 0],
    ];
    for (const f of faces) {
      indices.push(base + f[0], base + f[1], base + f[2], base + f[0], base + f[2], base + f[3]);
    }

    const isFirst = i === 0;
    const isLast = i === lastSeg;

    // Longitudinal face edges (always keep).
    pushEdge(edges, kinds, world[0], world[1], "long");
    pushEdge(edges, kinds, world[3], world[2], "long");
    pushEdge(edges, kinds, world[4], world[5], "long");
    pushEdge(edges, kinds, world[7], world[6], "long");

    // Start-cap: horizontal seams (top/bottom across thickness) vs vertical corners.
    pushEdge(edges, kinds, world[0], world[3], isFirst ? "start-seam" : "long"); // bottom
    pushEdge(edges, kinds, world[7], world[4], isFirst ? "start-seam" : "long"); // top
    pushEdge(edges, kinds, world[3], world[7], isFirst ? "corner" : "long"); // +thick vertical
    pushEdge(edges, kinds, world[4], world[0], isFirst ? "corner" : "long"); // -thick vertical

    // End-cap.
    pushEdge(edges, kinds, world[1], world[2], isLast ? "end-seam" : "long"); // bottom
    pushEdge(edges, kinds, world[6], world[5], isLast ? "end-seam" : "long"); // top
    pushEdge(edges, kinds, world[2], world[6], isLast ? "corner" : "long"); // +thick vertical
    pushEdge(edges, kinds, world[5], world[1], isLast ? "corner" : "long"); // -thick vertical
  }

  const filtered: number[] = [];
  for (let i = 0; i < kinds.length; i += 1) {
    const kind = kinds[i];
    if (kind === "start-seam" && options.hideStartSeam) continue;
    if (kind === "end-seam" && options.hideEndSeam) continue;
    const o = i * 6;
    filtered.push(
      edges[o],
      edges[o + 1],
      edges[o + 2],
      edges[o + 3],
      edges[o + 4],
      edges[o + 5],
    );
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
    edges: new Float32Array(filtered),
  };
}

export function buildRenderMesh(
  geometry: Geometry,
  options?: WallMeshOptions,
): RenderMesh | null {
  if (geometry.type === "box") {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const edges: number[] = [];
    pushBox(positions, normals, indices, edges, geometry.size[0], geometry.size[1], geometry.size[2]);
    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      indices: new Uint32Array(indices),
      edges: new Float32Array(edges),
    };
  }

  if (geometry.type === "cylinder") {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const edges: number[] = [];
    const segments = geometry.radialSegments ?? 16;
    const r = geometry.radius * MM;
    const h = geometry.height * MM;
    for (let i = 0; i < segments; i += 1) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const x0 = Math.cos(a0) * r;
      const y0 = Math.sin(a0) * r;
      const x1 = Math.cos(a1) * r;
      const y1 = Math.sin(a1) * r;
      const bi = positions.length / 3;
      positions.push(x0, y0, 0, x1, y1, 0, x1, y1, h, x0, y0, h);
      normals.push(x0, y0, 0, x1, y1, 0, x1, y1, 0, x0, y0, 0);
      indices.push(bi, bi + 1, bi + 2, bi, bi + 2, bi + 3);
      edges.push(x0, y0, 0, x1, y1, 0, x0, y0, h, x1, y1, h, x0, y0, 0, x0, y0, h);
    }
    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      indices: new Uint32Array(indices),
      edges: new Float32Array(edges),
    };
  }

  if (geometry.type === "wall") return buildWallMesh(geometry, options);

  return null;
}

export const WORLD_FROM_MM = MM;
