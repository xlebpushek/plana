import { z } from "zod";

export const ColorSchema = z.object({
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
  a: z.number().min(0).max(1),
});

export type Color = z.infer<typeof ColorSchema>;

export function rgba(r: number, g: number, b: number, a = 1): Color {
  return { r, g, b, a };
}

export function hexToColor(hex: string, a = 1): Color {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const value = Number.parseInt(full, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
    a,
  };
}

export function colorToHex(color: Color): string {
  const to = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to(color.r)}${to(color.g)}${to(color.b)}`;
}
