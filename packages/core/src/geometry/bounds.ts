import type { Vec3 } from "../transform.js";
import type { Geometry } from "./index.js";

export type AABB = {
  min: Vec3;
  max: Vec3;
};

export function emptyAABB(): AABB {
  return {
    min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
    max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
  };
}

export function expandAABB(bounds: AABB, point: Vec3): AABB {
  return {
    min: [
      Math.min(bounds.min[0], point[0]),
      Math.min(bounds.min[1], point[1]),
      Math.min(bounds.min[2], point[2]),
    ],
    max: [
      Math.max(bounds.max[0], point[0]),
      Math.max(bounds.max[1], point[1]),
      Math.max(bounds.max[2], point[2]),
    ],
  };
}

export function geometryBounds(geometry: Geometry): AABB {
  let bounds = emptyAABB();

  if (geometry.type === "box") {
    const [x, y, z] = geometry.size;
    bounds = expandAABB(bounds, [-x / 2, -y / 2, 0]);
    bounds = expandAABB(bounds, [x / 2, y / 2, z]);
    return bounds;
  }

  if (geometry.type === "cylinder") {
    const r = geometry.radius;
    bounds = expandAABB(bounds, [-r, -r, 0]);
    bounds = expandAABB(bounds, [r, r, geometry.height]);
    return bounds;
  }

  if (geometry.type === "wall") {
    if (geometry.path.type === "polyline") {
      for (const point of geometry.path.points) {
        bounds = expandAABB(bounds, [point[0], point[1], geometry.baseZ]);
        bounds = expandAABB(bounds, [
          point[0],
          point[1],
          geometry.baseZ + Math.max(geometry.height.start, geometry.height.end),
        ]);
      }
    } else {
      const c = geometry.path.center;
      const r = geometry.path.radius;
      bounds = expandAABB(bounds, [c[0] - r, c[1] - r, geometry.baseZ]);
      bounds = expandAABB(bounds, [
        c[0] + r,
        c[1] + r,
        geometry.baseZ + Math.max(geometry.height.start, geometry.height.end),
      ]);
    }
    return bounds;
  }

  if (geometry.type === "polyline") {
    for (const point of geometry.points) bounds = expandAABB(bounds, point);
    return bounds;
  }

  if (geometry.type === "polygon") {
    for (const point of geometry.outer) bounds = expandAABB(bounds, point);
    return bounds;
  }

  if (geometry.type === "point") return expandAABB(bounds, geometry.position);
  if (geometry.type === "segment") {
    bounds = expandAABB(bounds, geometry.start);
    return expandAABB(bounds, geometry.end);
  }

  if (geometry.type === "floor") {
    for (const [x, y] of geometry.outline) {
      bounds = expandAABB(bounds, [x, y, geometry.baseZ]);
      bounds = expandAABB(bounds, [x, y, geometry.baseZ + geometry.thickness]);
    }
    return bounds;
  }

  if (geometry.type === "extrusion") {
    const [dx, dy, dz] = geometry.direction;
    const len = Math.hypot(dx, dy, dz) || 1;
    const h = geometry.height;
    for (const p of geometry.profile.outer) {
      bounds = expandAABB(bounds, p);
      bounds = expandAABB(bounds, [
        p[0] + (dx / len) * h,
        p[1] + (dy / len) * h,
        p[2] + (dz / len) * h,
      ]);
    }
    return bounds;
  }

  if (geometry.type === "lathe") {
    let maxR = 0;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (const [r, z] of geometry.profile) {
      maxR = Math.max(maxR, r);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    bounds = expandAABB(bounds, [-maxR, -maxR, minZ]);
    return expandAABB(bounds, [maxR, maxR, maxZ]);
  }

  if (geometry.type === "tube") {
    const radii = Array.isArray(geometry.radius) ? geometry.radius : [geometry.radius];
    const r = Math.max(...radii);
    for (const p of geometry.points) {
      bounds = expandAABB(bounds, [p[0] - r, p[1] - r, p[2] - r]);
      bounds = expandAABB(bounds, [p[0] + r, p[1] + r, p[2] + r]);
    }
    return bounds;
  }

  if (geometry.type === "leaf") {
    const hx = geometry.width / 2;
    const hy = geometry.thickness / 2 + Math.abs(geometry.cup) * geometry.width;
    bounds = expandAABB(bounds, [-hx, -hy, 0]);
    return expandAABB(bounds, [hx, hy, geometry.length]);
  }

  return bounds;
}
