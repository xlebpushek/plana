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
  color: rgba(120, 160, 255, 1),
  opacity: 0.12,
  visible: true,
});

export const defaultEdgeStyle = (): EdgeStyle => ({
  color: rgba(79, 124, 255, 1),
  width: 1,
  opacity: 1,
  visible: true,
});

export function defaultStyleForType(type: string): ObjectStyle {
  switch (type) {
    case "wall":
      return {
        face: { color: rgba(96, 165, 250, 1), opacity: 0.14, visible: true },
        edge: { color: rgba(59, 130, 246, 1), width: 1.25, opacity: 1, visible: true },
      };
    case "furniture":
    case "table":
    case "sofa":
    case "bed":
    case "chair":
      return {
        face: { color: rgba(74, 222, 128, 1), opacity: 0.16, visible: true },
        edge: { color: rgba(34, 197, 94, 1), width: 1.25, opacity: 1, visible: true },
      };
    case "door":
    case "window":
      return {
        face: { color: rgba(251, 191, 36, 1), opacity: 0.18, visible: true },
        edge: { color: rgba(245, 158, 11, 1), width: 1.25, opacity: 1, visible: true },
      };
    case "floor":
      return {
        face: { color: rgba(161, 161, 170, 1), opacity: 0.1, visible: true },
        edge: { color: rgba(113, 113, 122, 1), width: 1, opacity: 0.8, visible: true },
      };
    case "smart-switch":
    case "socket":
    case "light":
      return {
        face: { color: rgba(251, 146, 60, 1), opacity: 0.2, visible: true },
        edge: { color: rgba(249, 115, 22, 1), width: 1.25, opacity: 1, visible: true },
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
