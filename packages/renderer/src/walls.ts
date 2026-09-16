import type { PlanaDocument, PlanaObject, WallGeometry } from "@plana/core";

export type WallWorldSegment = {
  id: string;
  /** Centerline start in mm (XY). */
  a: [number, number];
  /** Centerline end in mm (XY). */
  b: [number, number];
  thickness: number;
  baseZ: number;
  height: number;
};

function pathPoints(wall: WallGeometry): Array<[number, number, number]> {
  if (wall.path.type === "polyline") return wall.path.points;
  const points: Array<[number, number, number]> = [];
  const { center, radius, startAngle, endAngle } = wall.path;
  const segments = 24;
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const angle = startAngle + (endAngle - startAngle) * t;
    points.push([
      center[0] + Math.cos(angle) * radius,
      center[1] + Math.sin(angle) * radius,
      center[2],
    ]);
  }
  return points;
}

/** Collect wall centerline endpoints in document XY mm (ignores parent transform for identity walls). */
export function collectWallSegments(document: PlanaDocument): WallWorldSegment[] {
  const out: WallWorldSegment[] = [];
  for (const object of Object.values(document.objects)) {
    if (object.type !== "wall" || object.geometry?.type !== "wall") continue;
    const geo = object.geometry;
    const pts = pathPoints(geo);
    if (pts.length < 2) continue;
    const start = pts[0];
    const end = pts[pts.length - 1];
    const [ox, oy] = object.transform.position;
    out.push({
      id: object.id,
      a: [start[0] + ox, start[1] + oy],
      b: [end[0] + ox, end[1] + oy],
      thickness: geo.thickness,
      baseZ: geo.baseZ + object.transform.position[2],
      height: Math.max(geo.height.start, geo.height.end),
    });
  }
  return out;
}

function distPointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { dist: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return { dist: Math.hypot(px - ax, py - ay), t: 0 };
  const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2));
  const qx = ax + dx * t;
  const qy = ay + dy * t;
  return { dist: Math.hypot(px - qx, py - qy), t };
}

export type WallEndCaps = { hideStartSeam: boolean; hideEndSeam: boolean };

/**
 * True when a plan point lies inside (or on the face of) another wall's
 * thickened footprint — used for L/T junctions.
 */
export function pointInWallFootprint(
  px: number,
  py: number,
  wall: WallWorldSegment,
  marginMm = 8,
): boolean {
  const { dist, t } = distPointToSegment(px, py, wall.a[0], wall.a[1], wall.b[0], wall.b[1]);
  const half = wall.thickness / 2 + marginMm;
  if (dist > half) return false;
  // Allow slight overrun past endpoints so outer-corner centerlines still match.
  return t >= -0.05 && t <= 1.05;
}

export type RoomCornerVertical = {
  x: number;
  y: number;
  z0: number;
  z1: number;
};

function unitDir(a: [number, number], b: [number, number]): [number, number] | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  return [dx / len, dy / len];
}

function endpointOf(seg: WallWorldSegment, which: "a" | "b"): [number, number] {
  return which === "a" ? seg.a : seg.b;
}

function awayDir(seg: WallWorldSegment, from: "a" | "b"): [number, number] | null {
  return from === "a" ? unitDir(seg.a, seg.b) : unitDir(seg.b, seg.a);
}

function perpendicular(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] * b[0] + a[1] * b[1]) < 0.35;
}

/** Infinite centerline intersection (not a wall endpoint). */
function lineIntersect(
  a1: [number, number],
  a2: [number, number],
  b1: [number, number],
  b2: [number, number],
): [number, number] | null {
  const dax = a2[0] - a1[0];
  const day = a2[1] - a1[1];
  const dbx = b2[0] - b1[0];
  const dby = b2[1] - b1[1];
  const den = dax * dby - day * dbx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((b1[0] - a1[0]) * dby - (b1[1] - a1[1]) * dbx) / den;
  return [a1[0] + t * dax, a1[1] + t * day];
}

type EndHit = { wall: WallWorldSegment; end: "a" | "b"; other: WallWorldSegment };

function endHits(wall: WallWorldSegment, other: WallWorldSegment): EndHit[] {
  const hits: EndHit[] = [];
  if (pointInWallFootprint(wall.a[0], wall.a[1], other)) hits.push({ wall, end: "a", other });
  if (pointInWallFootprint(wall.b[0], wall.b[1], other)) hits.push({ wall, end: "b", other });
  return hits;
}

/**
 * Inner + outer verticals at each L (2) and the two inner verticals at each T.
 * One pair per wall intersection — not four end-cap edges per wall.
 */
export function computeRoomCornerVerticals(segments: WallWorldSegment[]): RoomCornerVertical[] {
  const seen = new Set<string>();
  const out: RoomCornerVertical[] = [];
  const add = (x: number, y: number, z0: number, z1: number) => {
    const key = `${Math.round(x / 4)}:${Math.round(y / 4)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x, y, z0, z1 });
  };

  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const a = segments[i];
      const b = segments[j];
      const z0 = Math.max(a.baseZ, b.baseZ);
      const z1 = Math.min(a.baseZ + a.height, b.baseZ + b.height);
      if (z1 - z0 < 1) continue;

      const aHits = endHits(a, b);
      const bHits = endHits(b, a);
      const da = unitDir(a.a, a.b);
      const db = unitDir(b.a, b.b);
      if (!da || !db || !perpendicular(da, db)) continue;

      if (aHits.length && bHits.length) {
        const hitA = aHits[0];
        const hitB = bHits[0];
        const dA = awayDir(a, hitA.end);
        const dB = awayDir(b, hitB.end);
        if (!dA || !dB) continue;
        const p = lineIntersect(a.a, a.b, b.a, b.b);
        if (!p) continue;
        add(
          p[0] - dA[0] * (b.thickness / 2) - dB[0] * (a.thickness / 2),
          p[1] - dA[1] * (b.thickness / 2) - dB[1] * (a.thickness / 2),
          z0,
          z1,
        );
        add(
          p[0] + dA[0] * (b.thickness / 2) + dB[0] * (a.thickness / 2),
          p[1] + dA[1] * (b.thickness / 2) + dB[1] * (a.thickness / 2),
          z0,
          z1,
        );
        continue;
      }

      const stemHit = aHits[0] ?? bHits[0];
      if (!stemHit) continue;
      const dS = awayDir(stemHit.wall, stemHit.end);
      if (!dS) continue;
      const p =
        lineIntersect(stemHit.wall.a, stemHit.wall.b, stemHit.other.a, stemHit.other.b) ??
        endpointOf(stemHit.wall, stemHit.end);
      const tThrough = stemHit.other.thickness / 2;
      const tStem = stemHit.wall.thickness / 2;
      const fx = p[0] + dS[0] * tThrough;
      const fy = p[1] + dS[1] * tThrough;
      const nx = -dS[1];
      const ny = dS[0];
      add(fx + nx * tStem, fy + ny * tStem, z0, z1);
      add(fx - nx * tStem, fy - ny * tStem, z0, z1);
    }
  }
  return out;
}

/** Which wall ends need top/bottom seam edges hidden (corners stay). */
export function computeWallEndCapHiding(segments: WallWorldSegment[]): Map<string, WallEndCaps> {
  const result = new Map<string, WallEndCaps>();
  for (const wall of segments) {
    let hideStartSeam = false;
    let hideEndSeam = false;
    for (const other of segments) {
      if (other.id === wall.id) continue;
      if (pointInWallFootprint(wall.a[0], wall.a[1], other)) hideStartSeam = true;
      if (pointInWallFootprint(wall.b[0], wall.b[1], other)) hideEndSeam = true;
    }
    result.set(wall.id, { hideStartSeam, hideEndSeam });
  }
  return result;
}

export function isWallObject(object: PlanaObject): object is PlanaObject & { geometry: WallGeometry } {
  return object.type === "wall" && object.geometry?.type === "wall";
}
