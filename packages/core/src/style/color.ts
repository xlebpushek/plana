import { z } from "zod";

export const ColorSchema = z.object({
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
  a: z.number().min(0).max(1),
});

export type Color = z.infer<typeof ColorSchema>;

export function rgba(r: number, g: number, b: number, a = 1): Color {
  return {
    r: clampByte(r),
    g: clampByte(g),
    b: clampByte(b),
    a: Math.min(1, Math.max(0, a)),
  };
}

function clampByte(n: number) {
  return Math.min(255, Math.max(0, Math.round(n)));
}

export type Hsl = { h: number; s: number; l: number };

/** RGB 0–255 → HSL with h in [0,360), s/l in [0,1]. */
export function rgbToHsl(color: Color): Hsl {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s, l };
}

export function hslToRgb(h: number, s: number, l: number, a = 1): Color {
  const hh = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hh < 60) [rp, gp, bp] = [c, x, 0];
  else if (hh < 120) [rp, gp, bp] = [x, c, 0];
  else if (hh < 180) [rp, gp, bp] = [0, c, x];
  else if (hh < 240) [rp, gp, bp] = [0, x, c];
  else if (hh < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return rgba((rp + m) * 255, (gp + m) * 255, (bp + m) * 255, a);
}

/** Perceptual-ish distance in RGB cube (0–≈441). */
export function colorDistance(a: Color, b: Color): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.hypot(dr, dg, db);
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/**
 * Smart selection edge color from the object's passive edge color.
 * Prefers a soft coral/red that stays readable on dark CAD backgrounds,
 * but shifts hue when the passive (or nearby) colors are already warm/red
 * so the selection never blends into neighbors.
 */
export function selectionEdgeColor(passive: Color, nearby: Color[] = []): Color {
  const base = rgbToHsl(passive);
  const neighbors = nearby.map(rgbToHsl);

  // Candidate accents: soft coral → amber → violet-red → teal (fallback).
  const candidates = [
    { h: 8, s: 0.72, l: 0.58 }, // soft coral / muted red
    { h: 18, s: 0.7, l: 0.55 }, // warm terracotta
    { h: 32, s: 0.75, l: 0.52 }, // amber
    { h: 340, s: 0.65, l: 0.62 }, // rose (not pink neon)
    { h: 285, s: 0.55, l: 0.62 }, // soft violet
    { h: 195, s: 0.7, l: 0.55 }, // cool cyan (last resort vs warm scenes)
  ];

  const score = (h: number, s: number, l: number) => {
    const sample = hslToRgb(h, s, l);
    let value = 0;
    // Strong separation from the passive edge.
    value += Math.min(220, colorDistance(sample, passive));
    value += hueDistance(h, base.h) * 1.4;
    // Prefer mid lightness for dark UI readability.
    value += (1 - Math.abs(l - 0.56)) * 40;
    // Soft, not neon.
    value += (1 - Math.abs(s - 0.68)) * 20;
    // Avoid looking like neighbors.
    for (const n of neighbors) {
      value += Math.min(160, colorDistance(sample, hslToRgb(n.h, n.s, n.l))) * 0.55;
      value += hueDistance(h, n.h) * 0.35;
    }
    // Penalty if passive itself is already in this hue family.
    if (base.s > 0.25 && hueDistance(h, base.h) < 28) value -= 80;
    return value;
  };

  let best = candidates[0];
  let bestScore = -Infinity;
  for (const c of candidates) {
    const s = score(c.h, c.s, c.l);
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }

  // Nudge lightness away from passive if still too close.
  let { h, s, l } = best;
  const draft = hslToRgb(h, s, l);
  if (colorDistance(draft, passive) < 70) {
    l = base.l > 0.5 ? Math.max(0.38, l - 0.14) : Math.min(0.72, l + 0.12);
  }

  return hslToRgb(h, s, l, passive.a);
}
