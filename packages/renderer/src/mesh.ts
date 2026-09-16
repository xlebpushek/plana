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
   * `corners` (default, passive): only room-corner verticals.
   * `full` (selected): all edges; junction top/bottom seams still honor hide*.
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
      // Passive walls: only room-corner verticals (inner/outer intersections).
      if (kind !== "corner") continue;
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
type SolidRegion = {
  s0: number;
  s1: number;
  z0: number;
  z1: number;
  cutoutStart?: boolean;
  cutoutEnd?: boolean;
  /** Bottom longitudinal edges bound an opening (lintel soffit). */
  cutoutBottom?: boolean;
  /** Top longitudinal edges bound an opening (window sill top). */
  cutoutTop?: boolean;
};

function composeWallSolids(
  totalLen: number,
  wallHeight: number,
  baseZ: number,
  cutouts: WallCutout[] | undefined,
): SolidRegion[] {
  const regions: SolidRegion[] = [];
  if (totalLen < 1e-6) return regions;

  if (!cutouts?.length) {
    regions.push({ s0: 0, s1: totalLen, z0: baseZ, z1: baseZ + wallHeight });
    return regions;
  }

  const cuts = [...cutouts]
    .map((c) => ({
      offset: c.offset,
      width: c.width,
      height: c.height,
      sill: c.sill ?? 0,
    }))
    .filter((c) => c.width > 1e-6)
    .sort((a, b) => a.offset - b.offset);

  let cursor = 0;

  for (const cut of cuts) {
    const c0 = Math.max(0, Math.min(totalLen, cut.offset));
    const c1 = Math.max(c0, Math.min(totalLen, cut.offset + cut.width));
    if (c1 - c0 < 1e-6) continue;

    if (c0 > cursor + 1e-6) {
      regions.push({
        s0: cursor,
        s1: c0,
        z0: baseZ,
        z1: baseZ + wallHeight,
        // End face is the opening jamb.
        cutoutEnd: true,
      });
    }

    const sill = Math.max(0, Math.min(wallHeight, cut.sill));
    const openTop = Math.max(sill, Math.min(wallHeight, sill + cut.height));

    if (sill > 1e-6) {
      regions.push({
        s0: c0,
        s1: c1,
        z0: baseZ,
        z1: baseZ + sill,
        cutoutStart: true,
        cutoutEnd: true,
        cutoutTop: true,
      });
    }

    if (openTop < wallHeight - 1e-6) {
      regions.push({
        s0: c0,
        s1: c1,
        z0: baseZ + openTop,
        z1: baseZ + wallHeight,
        cutoutStart: true,
        cutoutEnd: true,
        cutoutBottom: true,
      });
    }

    cursor = Math.max(cursor, c1);
  }

  if (cursor < totalLen - 1e-6) {
    regions.push({
      s0: cursor,
      s1: totalLen,
      z0: baseZ,
      z1: baseZ + wallHeight,
      // Start face is the opening jamb when following a cutout.
      cutoutStart: cursor > 1e-6,
    });
  }
  return regions;
}

function pushWallPrismAlong(
  buf: MeshBuffers,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  segS0: number,
  segLen: number,
  totalLen: number,
  thickness: number,
  region: SolidRegion,
) {
  const s0 = Math.max(region.s0, segS0);
  const s1 = Math.min(region.s1, segS0 + segLen);
  if (s1 - s0 < 1e-6 || region.z1 - region.z0 < 1e-6) return;

  const t0 = (s0 - segS0) / segLen;
  const t1 = (s1 - segS0) / segLen;
  const x0 = ax + (bx - ax) * t0;
  const y0 = ay + (by - ay) * t0;
  const x1 = ax + (bx - ax) * t1;
  const y1 = ay + (by - ay) * t1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return;

  const angle = Math.atan2(dy, dx);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const hx = (len * MM) / 2;
  const hy = (thickness * MM) / 2;
  const zBot = region.z0 * MM;
  const zTop = region.z1 * MM;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const local: Vec3[] = [
    [-hx, -hy, zBot],
    [hx, -hy, zBot],
    [hx, hy, zBot],
    [-hx, hy, zBot],
    [-hx, -hy, zTop],
    [hx, -hy, zTop],
    [hx, hy, zTop],
    [-hx, hy, zTop],
  ];

  const world = local.map(([x, y, z]) => {
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    return [rx + cx * MM, ry + cy * MM, z] as Vec3;
  });

  const base = buf.positions.length / 3;
  for (const p of world) {
    buf.positions.push(p[0], p[1], p[2]);
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

  // Face at this prism's s0/s1 coincides with the solid region's ends (not a
  // mid-segment clip of a longer region).
  const atRegionStart = Math.abs(region.s0 - s0) < 1e-6;
  const atRegionEnd = Math.abs(region.s1 - s1) < 1e-6;
  const isWallStartFace = atRegionStart && Math.abs(s0) < 1e-6;
  const isWallEndFace = atRegionEnd && Math.abs(s1 - totalLen) < 1e-6;
  const startIsCutout = atRegionStart && !!region.cutoutStart;
  const endIsCutout = atRegionEnd && !!region.cutoutEnd;

  const botKind: InternalEdgeKind = region.cutoutBottom ? "cutout" : "long";
  const topKind: InternalEdgeKind = region.cutoutTop ? "cutout" : "long";
  pushEdge(buf, world[0], world[1], botKind);
  pushEdge(buf, world[3], world[2], botKind);
  pushEdge(buf, world[4], world[5], topKind);
  pushEdge(buf, world[7], world[6], topKind);

  // Start-cap edges.
  if (isWallStartFace) {
    pushEdge(buf, world[0], world[3], "start-seam");
    pushEdge(buf, world[7], world[4], "start-seam");
    pushEdge(buf, world[3], world[7], "corner");
    pushEdge(buf, world[4], world[0], "corner");
  } else if (startIsCutout) {
    pushEdge(buf, world[0], world[3], "cutout");
    pushEdge(buf, world[7], world[4], "cutout");
    pushEdge(buf, world[3], world[7], "cutout");
    pushEdge(buf, world[4], world[0], "cutout");
  } else if (atRegionStart) {
    // Multi-segment / arc joints (non-cutout): keep as longitudinal.
    pushEdge(buf, world[0], world[3], "long");
    pushEdge(buf, world[7], world[4], "long");
    pushEdge(buf, world[3], world[7], "long");
    pushEdge(buf, world[4], world[0], "long");
  }

  // End-cap edges.
  if (isWallEndFace) {
    pushEdge(buf, world[1], world[2], "end-seam");
    pushEdge(buf, world[6], world[5], "end-seam");
    pushEdge(buf, world[2], world[6], "corner");
    pushEdge(buf, world[5], world[1], "corner");
  } else if (endIsCutout) {
    pushEdge(buf, world[1], world[2], "cutout");
    pushEdge(buf, world[6], world[5], "cutout");
    pushEdge(buf, world[2], world[6], "cutout");
    pushEdge(buf, world[5], world[1], "cutout");
  } else if (atRegionEnd) {
    pushEdge(buf, world[1], world[2], "long");
    pushEdge(buf, world[6], world[5], "long");
    pushEdge(buf, world[2], world[6], "long");
    pushEdge(buf, world[5], world[1], "long");
  }
}

/**
 * Wall solid + edges as ONE mesh. Cutouts become sill / lintel / full-height
 * runs composed into the same buffers (not separate PlanaObjects).
 */
export function buildWallMesh(wall: WallGeometry, options: WallMeshOptions = {}): RenderMesh {
  const opts: WallMeshOptions = { mode: "corners", ...options };
  const buf = emptyBuffers();
  const pathPoints = pathPointsOf(wall);
  if (pathPoints.length < 2) return toMesh(buf, opts);

  const segLens: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < pathPoints.length - 1; i += 1) {
    const a = pathPoints[i];
    const b = pathPoints[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segLens.push(len);
    totalLen += len;
  }
  if (totalLen < 1e-6) return toMesh(buf, opts);

  // With cutouts: one height (max of start/end). Without: per-segment lerp.
  const solids: SolidRegion[] = wall.cutouts?.length
    ? composeWallSolids(
        totalLen,
        Math.max(wall.height.start, wall.height.end),
        wall.baseZ,
        wall.cutouts,
      )
    : (() => {
        const out: SolidRegion[] = [];
        let acc = 0;
        for (let i = 0; i < pathPoints.length - 1; i += 1) {
          const len = segLens[i];
          if (len < 1e-6) {
            acc += len;
            continue;
          }
          const t = i / Math.max(1, pathPoints.length - 2);
          const height = wall.height.start + (wall.height.end - wall.height.start) * t;
          out.push({
            s0: acc,
            s1: acc + len,
            z0: wall.baseZ,
            z1: wall.baseZ + height,
          });
          acc += len;
        }
        return out;
      })();

  let segStart = 0;
  for (let i = 0; i < pathPoints.length - 1; i += 1) {
    const a = pathPoints[i];
    const b = pathPoints[i + 1];
    const len = segLens[i];
    if (len < 1e-6) {
      segStart += len;
      continue;
    }
    for (const region of solids) {
      if (region.s1 <= segStart + 1e-9 || region.s0 >= segStart + len - 1e-9) continue;
      pushWallPrismAlong(
        buf,
        a[0],
        a[1],
        b[0],
        b[1],
        segStart,
        len,
        totalLen,
        wall.thickness,
        region,
      );
    }
    segStart += len;
  }

  return toMesh(buf, opts);
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

  // One rectangular hole in a rectangular outline → four slabs.
  if (holes.length === 1 && isAxisAlignedRect(outline) && isAxisAlignedRect(holes[0])) {
    const ox = outline.map((p) => p[0]);
    const oy = outline.map((p) => p[1]);
    const hx = holes[0].map((p) => p[0]);
    const hy = holes[0].map((p) => p[1]);
    const oMinX = Math.min(...ox);
    const oMaxX = Math.max(...ox);
    const oMinY = Math.min(...oy);
    const oMaxY = Math.max(...oy);
    const hMinX = Math.min(...hx);
    const hMaxX = Math.max(...hx);
    const hMinY = Math.min(...hy);
    const hMaxY = Math.max(...hy);
    const slabs: Array<[number, number, number, number]> = [
      [oMinX, oMaxX, oMinY, hMinY],
      [oMinX, oMaxX, hMaxY, oMaxY],
      [oMinX, hMinX, hMinY, hMaxY],
      [hMaxX, oMaxX, hMinY, hMaxY],
    ];
    for (const [x0, x1, y0, y1] of slabs) {
      const sx = x1 - x0;
      const sy = y1 - y0;
      if (sx < 1e-6 || sy < 1e-6) continue;
      pushBox(buf, sx, sy, floor.thickness, (x0 + x1) / 2, (y0 + y1) / 2, baseZMm);
    }
    buf.edges.length = 0;
    buf.kinds.length = 0;
    pushFloorEdges(buf, outline, baseZ, zTop);
    pushFloorEdges(buf, holes[0], baseZ, zTop);
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

  return null;
}
