import type { Color } from "@plana/core";

type Rect = { minX: number; maxX: number; minY: number; maxY: number; z: number };

function clip(x0: number, y0: number, x1: number, y1: number, rect: Rect): [number, number, number, number] | null {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;
  const tests: Array<[number, number]> = [
    [-dx, x0 - rect.minX],
    [dx, rect.maxX - x0],
    [-dy, y0 - rect.minY],
    [dy, rect.maxY - y0],
  ];
  for (const [p, q] of tests) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
}

export function hatchSegments(
  rect: Rect,
  spacing: number,
  angleDeg: number,
  pattern: "lines" | "cross" | "dots",
): number[] {
  const out: number[] = [];
  const angles = pattern === "cross" ? [angleDeg, angleDeg + 90] : [angleDeg];
  for (const angle of angles) {
    const rad = (angle * Math.PI) / 180;
    const ca = Math.cos(rad);
    const sa = Math.sin(rad);
    const cx = (rect.minX + rect.maxX) / 2;
    const cy = (rect.minY + rect.maxY) / 2;
    const diag =
      Math.hypot(rect.maxX - rect.minX, rect.maxY - rect.minY) + spacing * 2;
    if (pattern === "dots") {
      const step = spacing;
      const n = Math.ceil(diag / step);
      for (let i = -n; i <= n; i += 1) {
        for (let j = -n; j <= n; j += 1) {
          const x = cx + (i * ca - j * sa) * step;
          const y = cy + (i * sa + j * ca) * step;
          if (x < rect.minX || x > rect.maxX || y < rect.minY || y > rect.maxY) continue;
          const m = step * 0.12;
          out.push(x - m, y, rect.z, x + m, y, rect.z, x, y - m, rect.z, x, y + m, rect.z);
        }
      }
      continue;
    }
    const n = Math.ceil(diag / spacing);
    for (let i = -n; i <= n; i += 1) {
      const ox = -sa * i * spacing;
      const oy = ca * i * spacing;
      const x0 = cx + ox - ca * diag;
      const y0 = cy + oy - sa * diag;
      const x1 = cx + ox + ca * diag;
      const y1 = cy + oy + sa * diag;
      const hit = clip(x0, y0, x1, y1, rect);
      if (!hit) continue;
      out.push(hit[0], hit[1], rect.z, hit[2], hit[3], rect.z);
    }
  }
  return out;
}

export function colorToRgb(color: Color) {
  return { r: color.r / 255, g: color.g / 255, b: color.b / 255, a: color.a };
}
