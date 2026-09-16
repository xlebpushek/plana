import { z } from "zod";

import { ColorSchema, rgba } from "./color.js";

export const FaceStyleSchema = z.object({
  color: ColorSchema,
  opacity: z.number().min(0).max(1),
  visible: z.boolean(),
});

export const EdgeStyleSchema = z.object({
  color: ColorSchema,
  width: z.number().min(0),
  opacity: z.number().min(0).max(1),
  visible: z.boolean(),
});

export const HatchStyleSchema = z.object({
  enabled: z.boolean(),
  color: ColorSchema.optional(),
  spacing: z.number().positive(),
  angle: z.number().finite(),
  width: z.number().min(0),
});

export const ObjectStyleSchema = z.object({
  face: FaceStyleSchema.optional(),
  edge: EdgeStyleSchema.optional(),
  hatch: HatchStyleSchema.optional(),
});

export type FaceStyle = z.infer<typeof FaceStyleSchema>;
export type EdgeStyle = z.infer<typeof EdgeStyleSchema>;
export type HatchStyle = z.infer<typeof HatchStyleSchema>;
export type ObjectStyle = z.infer<typeof ObjectStyleSchema>;

export const defaultFaceStyle = (): FaceStyle => ({
  color: rgba(161, 161, 170, 1),
  opacity: 0.08,
  visible: true,
});

export const defaultEdgeStyle = (): EdgeStyle => ({
  color: rgba(212, 212, 216, 1),
  width: 1,
  opacity: 1,
  visible: true,
});

/** CAD defaults: walls = edges only; furniture muted; openings cooler. */
export function defaultStyleForType(type: string): ObjectStyle {
  switch (type) {
    case "wall":
      return {
        face: { color: rgba(96, 165, 250, 1), opacity: 0, visible: true },
        edge: { color: rgba(96, 165, 250, 1), width: 1.4, opacity: 1, visible: true },
      };
    case "floor":
      return {
        face: { color: rgba(63, 63, 70, 1), opacity: 0.06, visible: true },
        edge: { color: rgba(82, 82, 91, 1), width: 1, opacity: 0.55, visible: true },
      };
    case "furniture":
    case "table":
    case "sofa":
    case "bed":
    case "chair":
      return {
        face: { color: rgba(212, 212, 216, 1), opacity: 0.1, visible: true },
        edge: { color: rgba(228, 228, 231, 1), width: 1.15, opacity: 0.95, visible: true },
      };
    case "door":
      return {
        face: { color: rgba(251, 191, 36, 1), opacity: 0.08, visible: true },
        edge: { color: rgba(252, 211, 77, 1), width: 1.2, opacity: 1, visible: true },
      };
    case "window":
      return {
        face: { color: rgba(125, 211, 252, 1), opacity: 0.06, visible: true },
        edge: { color: rgba(56, 189, 248, 1), width: 1.15, opacity: 1, visible: true },
      };
    case "smart-switch":
    case "socket":
    case "light":
      return {
        face: { color: rgba(251, 146, 60, 1), opacity: 0.12, visible: true },
        edge: { color: rgba(253, 186, 116, 1), width: 1.2, opacity: 1, visible: true },
      };
    default:
      return {
        face: defaultFaceStyle(),
        edge: defaultEdgeStyle(),
      };
  }
}

export function resolveObjectStyle(type: string, style?: ObjectStyle): ObjectStyle {
  const base = defaultStyleForType(type);
  return {
    face: { ...base.face!, ...style?.face },
    edge: { ...base.edge!, ...style?.edge },
    hatch: style?.hatch ?? base.hatch,
  };
}
