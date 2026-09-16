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
