import type { FloorGeometry, Geometry, WallCutout, WallGeometry } from "@plana/core";

export type EdgeKind = "long" | "corner" | "seam" | "cutout" | "floor-outline";

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
  /**
   * `corners` (passive): floor/ceiling longs. Room inner/outer verticals
   * are overlaid by the renderer from junctions.
   * `full` (selected): all edges of this wall.
   */
  mode?: "corners" | "full";
};

const MM = 0.001;
export const WORLD_FROM_MM = MM;

type Vec2 = [number, number];
type Vec3 = [number, number, number];

/** Internal seam tags keep start/end distinct for hide* filtering. */
type InternalEdgeKind =
  | "long"
  | "corner"
  | "start-seam"
  | "end-seam"
  | "cutout"
  | "floor-outline";

type MeshBuffers = {
  positions: number[];
  normals: number[];
  indices: number[];
  edges: number[];
  kinds: InternalEdgeKind[];
};

function emptyBuffers(): MeshBuffers {
  return { positions: [], normals: [], indices: [], edges: [], kinds: [] };
}

function toMesh(buf: MeshBuffers, options: WallMeshOptions = {}): RenderMesh {
  const mode = options.mode ?? "full";
  const filtered: number[] = [];
  for (let i = 0; i < buf.kinds.length; i += 1) {
    const kind = buf.kinds[i];
    if (mode === "corners") {
      // Passive: floor/ceiling longs only. Inner/outer room corners are
      // drawn once by the renderer from wall junctions (not each wall's
      // four end-cap verticals).
      if (kind !== "long") continue;
    } else {
      // Full / non-wall meshes: drop only coplanar junction top/bottom seams.
      if (kind === "start-seam" && options.hideStartSeam) continue;
      if (kind === "end-seam" && options.hideEndSeam) continue;
    }
    const o = i * 6;
    filtered.push(
      buf.edges[o],
      buf.edges[o + 1],
      buf.edges[o + 2],
      buf.edges[o + 3],
      buf.edges[o + 4],
      buf.edges[o + 5],
    );
  }
  return {
    positions: new Float32Array(buf.positions),
    normals: new Float32Array(buf.normals),
    indices: new Uint32Array(buf.indices),
    edges: new Float32Array(filtered),
  };
}

function pushEdge(buf: MeshBuffers, pa: Vec3, pb: Vec3, kind: InternalEdgeKind) {
  buf.edges.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2]);
  buf.kinds.push(kind);
}

function pushBox(
  buf: MeshBuffers,
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
  const base = buf.positions.length / 3;

  const corners: Vec3[] = [
    [-hx + ox * MM, -hy + oy * MM, oz * MM],
    [hx + ox * MM, -hy + oy * MM, oz * MM],
    [hx + ox * MM, hy + oy * MM, oz * MM],
    [-hx + ox * MM, hy + oy * MM, oz * MM],
    [-hx + ox * MM, -hy + oy * MM, hz + oz * MM],
    [hx + ox * MM, -hy + oy * MM, hz + oz * MM],
    [hx + ox * MM, hy + oy * MM, hz + oz * MM],
    [-hx + ox * MM, hy + oy * MM, hz + oz * MM],
  ];

  for (const c of corners) {
    buf.positions.push(c[0], c[1], c[2]);
    buf.normals.push(0, 0, 1);
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
    buf.indices.push(
      base + f[0],
      base + f[1],
      base + f[2],
      base + f[0],
      base + f[2],
      base + f[3],
    );
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
    pushEdge(buf, corners[a], corners[b], "long");
  }
}

function sampleArc(
  wall: Extract<WallGeometry["path"], { type: "arc" }>,
  segments = 24,
): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const angle = wall.startAngle + (wall.endAngle - wall.startAngle) * t;
    points.push([
      wall.center[0] + Math.cos(angle) * wall.radius,
      wall.center[1] + Math.sin(angle) * wall.radius,
      wall.center[2],
    ]);
  }
  return points;
}

function pathPointsOf(wall: WallGeometry): Vec3[] {
  return wall.path.type === "polyline" ? wall.path.points : sampleArc(wall.path);
}

/**
 * Solid prism along the wall centerline.
 * Distances s0/s1 are mm from wall path start; z0/z1 are absolute Z mm.
 */
type UvToWorld = (u: number, v: number, w: number) => Vec3;

function classifyOuterWallEdge(
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  totalLen: number,
  zBot: number,
  zTop: number,
): { along: InternalEdgeKind; atA: InternalEdgeKind; atB: InternalEdgeKind } {
  const du = u1 - u0;
  const dv = v1 - v0;
  const alongU = Math.abs(du) > Math.abs(dv);
  if (alongU) {
    const atFloor = Math.abs(v0 - zBot) < 1e-3 && Math.abs(v1 - zBot) < 1e-3;
    const atCeil = Math.abs(v0 - zTop) < 1e-3 && Math.abs(v1 - zTop) < 1e-3;
    const along: InternalEdgeKind = atFloor || atCeil ? "long" : "cutout";
    const cap = (u: number): InternalEdgeKind =>
      Math.abs(u) < 1e-3 ? "start-seam" : Math.abs(u - totalLen) < 1e-3 ? "end-seam" : "cutout";
    return { along, atA: cap(u0), atB: cap(u1) };
  }
  const atStart = Math.abs(u0) < 1e-3 && Math.abs(u1) < 1e-3;
  const atEnd = Math.abs(u0 - totalLen) < 1e-3 && Math.abs(u1 - totalLen) < 1e-3;
  const along: InternalEdgeKind = atStart || atEnd ? "corner" : "cutout";
  const vSeam = (v: number): InternalEdgeKind => {
    if (atStart && (Math.abs(v - zBot) < 1e-3 || Math.abs(v - zTop) < 1e-3)) return "start-seam";
    if (atEnd && (Math.abs(v - zBot) < 1e-3 || Math.abs(v - zTop) < 1e-3)) return "end-seam";
    return along;
  };
  return { along, atA: vSeam(v0), atB: vSeam(v1) };
}

function pushExtrudedRing(
  buf: MeshBuffers,
  ring: Vec2[],
  w0: number,
  w1: number,
  uvToWorld: UvToWorld,
  hole: boolean,
  totalLen: number,
  zBot: number,
  zTop: number,
) {
  const pts = closeRing(ring);
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const a0 = uvToWorld(a[0], a[1], w0);
    const b0 = uvToWorld(b[0], b[1], w0);
    const b1 = uvToWorld(b[0], b[1], w1);
    const a1 = uvToWorld(a[0], a[1], w1);
    const bi = buf.positions.length / 3;
    buf.positions.push(...a0, ...b0, ...b1, ...a1);
    const ux = b0[0] - a0[0];
    const uy = b0[1] - a0[1];
    const uz = b0[2] - a0[2];
    const vx = a1[0] - a0[0];
    const vy = a1[1] - a0[1];
    const vz = a1[2] - a0[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    for (let k = 0; k < 4; k += 1) buf.normals.push(nx, ny, nz);
    buf.indices.push(bi, bi + 1, bi + 2, bi, bi + 2, bi + 3);

    if (hole) {
      pushEdge(buf, a0, b0, "cutout");
      pushEdge(buf, a1, b1, "cutout");
      pushEdge(buf, a0, a1, "cutout");
      pushEdge(buf, b0, b1, "cutout");
    } else {
      const kind = classifyOuterWallEdge(a[0], a[1], b[0], b[1], totalLen, zBot, zTop);
      pushEdge(buf, a0, b0, kind.along);
      pushEdge(buf, a1, b1, kind.along);
      pushEdge(buf, a0, a1, kind.atA);
      pushEdge(buf, b0, b1, kind.atB);
    }
  }
}

function pushUvCaps(
  buf: MeshBuffers,
  verts: Vec2[],
  tris: number[],
  w0: number,
  w1: number,
  uvToWorld: UvToWorld,
) {
  const base0 = buf.positions.length / 3;
  for (const v of verts) {
    const p = uvToWorld(v[0], v[1], w0);
    buf.positions.push(p[0], p[1], p[2]);
    buf.normals.push(0, 0, -1);
  }
  const base1 = buf.positions.length / 3;
  for (const v of verts) {
    const p = uvToWorld(v[0], v[1], w1);
    buf.positions.push(p[0], p[1], p[2]);
    buf.normals.push(0, 0, 1);
  }
  for (let i = 0; i < tris.length; i += 3) {
    const a = tris[i];
    const b = tris[i + 1];
    const c = tris[i + 2];
    buf.indices.push(base0 + a, base0 + c, base0 + b);
    buf.indices.push(base1 + a, base1 + b, base1 + c);
  }
}

function wallElevationRings(
  totalLen: number,
  wallHeight: number,
  baseZ: number,
  cutouts: WallCutout[] | undefined,
): { outline: Vec2[]; holes: Vec2[][] } {
  const zBot = baseZ;
  const zTop = baseZ + wallHeight;
  const doors: WallCutout[] = [];
  const holes: Vec2[][] = [];
  for (const c of cutouts ?? []) {
    const c0 = Math.max(0, Math.min(totalLen, c.offset));
    const c1 = Math.max(c0, Math.min(totalLen, c.offset + c.width));
    if (c1 - c0 < 1e-6) continue;
    const sillRel = Math.max(0, Math.min(wallHeight, c.sill ?? 0));
    const openTopRel = Math.max(sillRel, Math.min(wallHeight, sillRel + c.height));
    const sillAbs = zBot + sillRel;
    const openTopAbs = zBot + openTopRel;
    if (sillRel <= 1 && openTopRel < wallHeight - 1) {
      doors.push({ ...c, offset: c0, width: c1 - c0, height: openTopAbs, sill: 0 });
    } else if (openTopRel - sillRel > 1e-6) {
      holes.push([
        [c0, sillAbs],
        [c1, sillAbs],
        [c1, openTopAbs],
        [c0, openTopAbs],
      ]);
    }
  }
  doors.sort((a, b) => a.offset - b.offset);
  const outline: Vec2[] = [[0, zBot]];
  for (const d of doors) {
    const c0 = d.offset;
    const c1 = d.offset + d.width;
    outline.push([c0, zBot], [c0, d.height], [c1, d.height], [c1, zBot]);
  }
  outline.push([totalLen, zBot], [totalLen, zTop], [0, zTop]);
  return { outline, holes };
}

/**
 * One extruded wall solid: elevation polygon (door notches + window holes)
 * thickened by wall.thickness. Not a pile of boxes.
 */
export function buildWallMesh(wall: WallGeometry, options: WallMeshOptions = {}): RenderMesh {
  const opts: WallMeshOptions = { mode: "corners", ...options };
  const buf = emptyBuffers();
  const pathPoints = pathPointsOf(wall);
  if (pathPoints.length < 2) return toMesh(buf, opts);

  const a = pathPoints[0];
  const b = pathPoints[pathPoints.length - 1];
  const totalLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (totalLen < 1e-6) return toMesh(buf, opts);

  const ux = (b[0] - a[0]) / totalLen;
  const uy = (b[1] - a[1]) / totalLen;
  const nx = -uy;
  const ny = ux;
  const half = wall.thickness / 2;
  const wallHeight = Math.max(wall.height.start, wall.height.end);
  const zBot = wall.baseZ;
  const zTop = wall.baseZ + wallHeight;

  const uvToWorld: UvToWorld = (s, z, t) => [
    (a[0] + ux * s + nx * t) * MM,
    (a[1] + uy * s + ny * t) * MM,
    z * MM,
  ];

  const { outline, holes } = wallElevationRings(totalLen, wallHeight, wall.baseZ, wall.cutouts);
  const { verts, indices } = triangulatePolygonWithHoles(outline, holes);
  if (indices.length >= 3) {
    pushUvCaps(buf, verts, indices, -half, half, uvToWorld);
  }
  pushExtrudedRing(buf, outline, -half, half, uvToWorld, false, totalLen, zBot, zTop);
  for (const hole of holes) {
    pushExtrudedRing(buf, hole, -half, half, uvToWorld, true, totalLen, zBot, zTop);
  }

  return toMesh(buf, opts);
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize3(v: Vec3): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
}

function basisFromDir(dir: Vec3): { u: Vec3; v: Vec3; w: Vec3 } {
  const w = normalize3(dir);
  const helper: Vec3 = Math.abs(w[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = normalize3(cross(helper, w));
  const v = cross(w, u);
  return { u, v, w };
}

function projectToUv(p: Vec3, origin: Vec3, u: Vec3, v: Vec3): Vec2 {
  const d: Vec3 = [p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]];
  return [d[0] * u[0] + d[1] * u[1] + d[2] * u[2], d[0] * v[0] + d[1] * v[1] + d[2] * v[2]];
}

export function buildExtrusionMesh(geometry: {
  type: "extrusion";
  profile: { type: "polygon"; outer: Vec3[]; holes?: Vec3[][] };
  height: number;
  direction: Vec3;
}): RenderMesh {
  const buf = emptyBuffers();
  const outer3 = geometry.profile.outer;
  if (outer3.length < 3) return toMesh(buf);
  const { u, v, w } = basisFromDir(geometry.direction);
  const origin = outer3[0];
  const uvToWorld: UvToWorld = (uu, vv, ww) => [
    (origin[0] + u[0] * uu + v[0] * vv + w[0] * ww) * MM,
    (origin[1] + u[1] * uu + v[1] * vv + w[1] * ww) * MM,
    (origin[2] + u[2] * uu + v[2] * vv + w[2] * ww) * MM,
  ];
  const outline = outer3.map((p) => projectToUv(p, origin, u, v));
  const holes = (geometry.profile.holes ?? []).map((h) => h.map((p) => projectToUv(p, origin, u, v)));
  const { verts, indices } = triangulatePolygonWithHoles(outline, holes);
  if (indices.length >= 3) pushUvCaps(buf, verts, indices, 0, geometry.height, uvToWorld);
  const dummyLen = 1;
  const zMin = Math.min(...outline.map((p) => p[1]));
  const zMax = Math.max(...outline.map((p) => p[1]));
  pushExtrudedRing(buf, outline, 0, geometry.height, uvToWorld, false, dummyLen, zMin, zMax);
  for (const hole of holes) {
    pushExtrudedRing(buf, hole, 0, geometry.height, uvToWorld, true, dummyLen, zMin, zMax);
  }
  return toMesh(buf);
}

// —— Floor ——

function ringArea(ring: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const j = (i + 1) % ring.length;
    a += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
  }
  return a / 2;
}

function ensureOrientation(ring: Vec2[], ccw: boolean): Vec2[] {
  const isCcw = ringArea(ring) > 0;
  if (isCcw === ccw) return ring.slice();
  return ring.slice().reverse();
}

function closeRing(ring: Vec2[]): Vec2[] {
  if (ring.length < 2) return ring.slice();
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6) return ring.slice(0, -1);
  return ring.slice();
}

function isAxisAlignedRect(ring: Vec2[]): boolean {
  const pts = closeRing(ring);
  if (pts.length !== 4) return false;
  const xs = new Set(pts.map((p) => p[0]));
  const ys = new Set(pts.map((p) => p[1]));
  if (xs.size !== 2 || ys.size !== 2) return false;
  for (let i = 0; i < 4; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    if (Math.abs(a[0] - b[0]) > 1e-6 && Math.abs(a[1] - b[1]) > 1e-6) return false;
  }
  return true;
}

function pointInTri(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
  const sign = (p1: Vec2, p2: Vec2, p3: Vec2) =>
    (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function pointInRing(p: Vec2, ring: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Minimal ear clipping for a simple CCW polygon (no holes). */
function earcutSimple(ring: Vec2[]): number[] {
  const n = ring.length;
  if (n < 3) return [];
  if (n === 3) return [0, 1, 2];

  const idx: number[] = Array.from({ length: n }, (_, i) => i);
  const tris: number[] = [];
  let guard = 0;

  while (idx.length > 3 && guard++ < n * n) {
    let clipped = false;
    for (let i = 0; i < idx.length; i += 1) {
      const i0 = idx[(i + idx.length - 1) % idx.length];
      const i1 = idx[i];
      const i2 = idx[(i + 1) % idx.length];
      const a = ring[i0];
      const b = ring[i1];
      const c = ring[i2];
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (cross <= 1e-9) continue;
      let empty = true;
      for (const j of idx) {
        if (j === i0 || j === i1 || j === i2) continue;
        if (pointInTri(ring[j], a, b, c)) {
          empty = false;
          break;
        }
      }
      if (!empty) continue;
      tris.push(i0, i1, i2);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) tris.push(idx[0], idx[1], idx[2]);
  return tris;
}

/** Bridge holes into the outer ring (outer CCW, holes CW), then ear-clip. */
function triangulatePolygonWithHoles(
  outline: Vec2[],
  holes: Vec2[][],
): { verts: Vec2[]; indices: number[] } {
  let outer = ensureOrientation(closeRing(outline), true);
  const holeRings = holes.map((h) => ensureOrientation(closeRing(h), false));

  if (holeRings.length === 0) {
    return { verts: outer, indices: earcutSimple(outer) };
  }

  for (const hole of holeRings) {
    let hi = 0;
    for (let i = 1; i < hole.length; i += 1) {
      if (
        hole[i][0] < hole[hi][0] - 1e-9 ||
        (Math.abs(hole[i][0] - hole[hi][0]) < 1e-9 && hole[i][1] < hole[hi][1])
      ) {
        hi = i;
      }
    }
    const hp = hole[hi];

    let bestOi = -1;
    let bestDist = Infinity;
    for (let oi = 0; oi < outer.length; oi += 1) {
      const op = outer[oi];
      if (op[0] > hp[0] + 1e-6) continue;
      const d = Math.hypot(op[0] - hp[0], op[1] - hp[1]);
      if (d >= bestDist) continue;
      const mid: Vec2 = [(op[0] + hp[0]) / 2, (op[1] + hp[1]) / 2];
      if (!pointInRing(mid, outer)) continue;
      if (pointInRing(mid, hole)) continue;
      bestDist = d;
      bestOi = oi;
    }
    if (bestOi < 0) {
      bestDist = Infinity;
      for (let oi = 0; oi < outer.length; oi += 1) {
        const d = Math.hypot(outer[oi][0] - hp[0], outer[oi][1] - hp[1]);
        if (d < bestDist) {
          bestDist = d;
          bestOi = oi;
        }
      }
    }

    const merged: Vec2[] = [];
    for (let i = 0; i <= bestOi; i += 1) merged.push(outer[i]);
    for (let k = 0; k <= hole.length; k += 1) {
      merged.push(hole[(hi + k) % hole.length]);
    }
    for (let i = bestOi; i < outer.length; i += 1) merged.push(outer[i]);
    outer = merged;
  }

  return { verts: outer, indices: earcutSimple(outer) };
}

function pushFloorEdges(buf: MeshBuffers, ring: Vec2[], zBot: number, zTop: number) {
  const pts = closeRing(ring);
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const aBot: Vec3 = [a[0] * MM, a[1] * MM, zBot];
    const bBot: Vec3 = [b[0] * MM, b[1] * MM, zBot];
    const aTop: Vec3 = [a[0] * MM, a[1] * MM, zTop];
    const bTop: Vec3 = [b[0] * MM, b[1] * MM, zTop];
    pushEdge(buf, aBot, bBot, "floor-outline");
    pushEdge(buf, aTop, bTop, "floor-outline");
    pushEdge(buf, aBot, aTop, "floor-outline");
  }
}

function pushExtrudedCaps(
  buf: MeshBuffers,
  verts: Vec2[],
  tris: number[],
  zBot: number,
  zTop: number,
) {
  const base = buf.positions.length / 3;
  for (const v of verts) {
    buf.positions.push(v[0] * MM, v[1] * MM, zBot);
    buf.normals.push(0, 0, -1);
  }
  const topBase = buf.positions.length / 3;
  for (const v of verts) {
    buf.positions.push(v[0] * MM, v[1] * MM, zTop);
    buf.normals.push(0, 0, 1);
  }
  for (let i = 0; i < tris.length; i += 3) {
    const a = tris[i];
    const b = tris[i + 1];
    const c = tris[i + 2];
    buf.indices.push(base + a, base + c, base + b);
    buf.indices.push(topBase + a, topBase + b, topBase + c);
  }
}

function pushSideRing(buf: MeshBuffers, ring: Vec2[], zBot: number, zTop: number) {
  const pts = closeRing(ring);
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const bi = buf.positions.length / 3;
    const ax = a[0] * MM;
    const ay = a[1] * MM;
    const bx = b[0] * MM;
    const by = b[1] * MM;
    buf.positions.push(ax, ay, zBot, bx, by, zBot, bx, by, zTop, ax, ay, zTop);
    const nx = -(by - ay);
    const ny = bx - ax;
    const nl = Math.hypot(nx, ny) || 1;
    for (let k = 0; k < 4; k += 1) buf.normals.push(nx / nl, ny / nl, 0);
    buf.indices.push(bi, bi + 1, bi + 2, bi, bi + 2, bi + 3);
  }
}

export function buildFloorMesh(floor: FloorGeometry): RenderMesh {
  const buf = emptyBuffers();
  const baseZMm = floor.baseZ ?? 0;
  const baseZ = baseZMm * MM;
  const zTop = baseZ + floor.thickness * MM;
  const outline = closeRing(floor.outline);
  const holes = (floor.holes ?? []).map(closeRing);

  if (outline.length < 3) return toMesh(buf);

  // Fast path: axis-aligned rectangle, no holes → single box.
  if (holes.length === 0 && isAxisAlignedRect(outline)) {
    const xs = outline.map((p) => p[0]);
    const ys = outline.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    pushBox(
      buf,
      maxX - minX,
      maxY - minY,
      floor.thickness,
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      baseZMm,
    );
    buf.edges.length = 0;
    buf.kinds.length = 0;
    pushFloorEdges(buf, outline, baseZ, zTop);
    return toMesh(buf);
  }

  let verts: Vec2[];
  let indices: number[];
  if (holes.length === 0) {
    verts = ensureOrientation(outline, true);
    indices = earcutSimple(verts);
    if (indices.length < 3) {
      indices = [];
      for (let i = 1; i < verts.length - 1; i += 1) indices.push(0, i, i + 1);
    }
  } else {
    ({ verts, indices } = triangulatePolygonWithHoles(outline, holes));
  }

  pushExtrudedCaps(buf, verts, indices, baseZ, zTop);
  pushSideRing(buf, outline, baseZ, zTop);
  for (const h of holes) pushSideRing(buf, h, baseZ, zTop);

  pushFloorEdges(buf, outline, baseZ, zTop);
  for (const h of holes) pushFloorEdges(buf, h, baseZ, zTop);

  return toMesh(buf);
}

export function buildRenderMesh(
  geometry: Geometry,
  options?: WallMeshOptions,
): RenderMesh | null {
  if (geometry.type === "box") {
    const buf = emptyBuffers();
    pushBox(buf, geometry.size[0], geometry.size[1], geometry.size[2]);
    return toMesh(buf);
  }

  if (geometry.type === "cylinder") {
    const buf = emptyBuffers();
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
      const bi = buf.positions.length / 3;
      buf.positions.push(x0, y0, 0, x1, y1, 0, x1, y1, h, x0, y0, h);
      buf.normals.push(x0, y0, 0, x1, y1, 0, x1, y1, 0, x0, y0, 0);
      buf.indices.push(bi, bi + 1, bi + 2, bi, bi + 2, bi + 3);
      pushEdge(buf, [x0, y0, 0], [x1, y1, 0], "long");
      pushEdge(buf, [x0, y0, h], [x1, y1, h], "long");
      pushEdge(buf, [x0, y0, 0], [x0, y0, h], "long");
    }
    return toMesh(buf);
  }

  if (geometry.type === "wall") return buildWallMesh(geometry, options);
  if (geometry.type === "floor") return buildFloorMesh(geometry);
  if (geometry.type === "extrusion") return buildExtrusionMesh(geometry);

  return null;
}
