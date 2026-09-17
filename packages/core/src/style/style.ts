import { z } from "zod";

import { ColorSchema, rgba } from "./color";

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
  inheritColor: z.boolean().optional(),
  pattern: z.enum(["lines", "cross", "dots"]).optional(),
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

const WHITE = rgba(245, 245, 245, 1);
const WHITE_DIM = rgba(228, 228, 231, 1);

/** Mass furniture: faint fill, CAD edges. Dumped solid opacities are ignored. */
const CAD_GHOST_TYPES = new Set([
  "sofa",
  "bed",
  "chair",
  "table",
  "shelving",
  "furniture",
  "cabinet",
  "desk",
  "wardrobe",
  "clock",
  "lamp",
  "vase",
  "decor",
  "appliance",
  "socket",
  "light",
  "smart-switch",
]);

export function isCadGhostType(type: string) {
  return CAD_GHOST_TYPES.has(type);
}

export const defaultFaceStyle = (): FaceStyle => ({
  color: WHITE,
  opacity: 0.06,
  visible: true,
});

export const defaultEdgeStyle = (): EdgeStyle => ({
  color: WHITE_DIM,
  width: 1,
  opacity: 1,
  visible: true,
});

/**
 * Built-in type styles. Ready rules: wall/floor CAD edges, door/opening warm,
 * window cool, furniture tinted by type.
 */
export function defaultStyleForType(type: string): ObjectStyle {
  switch (type) {
    case "wall":
      return {
        face: { color: WHITE, opacity: 0, visible: true },
        edge: { color: WHITE, width: 1.25, opacity: 0.95, visible: true },
      };
    case "floor":
      return {
        face: { color: WHITE, opacity: 0.05, visible: true },
        edge: { color: WHITE_DIM, width: 1, opacity: 0.55, visible: true },
      };
    case "door":
    case "opening":
      return {
        face: { color: rgba(251, 191, 36, 1), opacity: 0.1, visible: true },
        edge: { color: rgba(252, 211, 77, 1), width: 1.2, opacity: 1, visible: true },
      };
    case "window":
      return {
        face: { color: rgba(125, 211, 252, 1), opacity: 0.08, visible: true },
        edge: { color: rgba(56, 189, 248, 1), width: 1.15, opacity: 1, visible: true },
      };
    case "sofa":
      return {
        face: { color: rgba(214, 186, 162, 1), opacity: 0.035, visible: true },
        edge: { color: rgba(232, 208, 184, 1), width: 1.15, opacity: 0.92, visible: true },
      };
    case "bed":
      return {
        face: { color: rgba(232, 180, 184, 1), opacity: 0.035, visible: true },
        edge: { color: rgba(244, 196, 200, 1), width: 1.15, opacity: 0.92, visible: true },
      };
    case "chair":
      return {
        face: { color: rgba(236, 220, 186, 1), opacity: 0.035, visible: true },
        edge: { color: rgba(245, 230, 196, 1), width: 1.15, opacity: 0.92, visible: true },
      };
    case "table":
      return {
        face: { color: rgba(210, 168, 122, 1), opacity: 0.035, visible: true },
        edge: { color: rgba(232, 196, 150, 1), width: 1.15, opacity: 0.92, visible: true },
      };
    case "shelving":
      return {
        face: { color: rgba(176, 196, 214, 1), opacity: 0.035, visible: true },
        edge: { color: rgba(198, 216, 232, 1), width: 1.15, opacity: 0.92, visible: true },
      };
    case "furniture":
      return {
        face: { color: rgba(210, 210, 216, 1), opacity: 0.035, visible: true },
        edge: { color: WHITE_DIM, width: 1.15, opacity: 0.92, visible: true },
      };
    case "cabinet":
      return {
        face: { color: rgba(232, 214, 176, 1), opacity: 0.035, visible: true },
        edge: { color: rgba(244, 228, 192, 1), width: 1.15, opacity: 0.92, visible: true },
      };
    case "desk":
      return {
        face: { color: rgba(148, 196, 186, 1), opacity: 0.035, visible: true },
        edge: { color: rgba(174, 216, 206, 1), width: 1.15, opacity: 0.92, visible: true },
      };
    case "wardrobe":
      return {
        face: { color: rgba(196, 186, 214, 1), opacity: 0.035, visible: true },
        edge: { color: rgba(214, 204, 230, 1), width: 1.15, opacity: 0.92, visible: true },
      };
    case "plant":
    case "flower":
    case "tree":
      return {
        face: { color: rgba(134, 239, 172, 1), opacity: 0.14, visible: true },
        edge: { color: rgba(74, 222, 128, 1), width: 1, opacity: 0.85, visible: true },
      };
    case "clock":
      return {
        face: { color: rgba(232, 196, 112, 1), opacity: 0.035, visible: true },
        edge: { color: rgba(244, 214, 140, 1), width: 1.1, opacity: 0.92, visible: true },
      };
    case "lamp":
    case "light":
      return {
        face: { color: rgba(250, 220, 140, 1), opacity: 0.035, visible: true },
        edge: { color: rgba(252, 232, 170, 1), width: 1.1, opacity: 0.92, visible: true },
      };
    case "vase":
      return {
        face: { color: rgba(216, 140, 122, 1), opacity: 0.035, visible: true },
        edge: { color: rgba(232, 164, 146, 1), width: 1.1, opacity: 0.92, visible: true },
      };
    case "decor":
      return {
        face: { color: rgba(244, 188, 156, 1), opacity: 0.035, visible: true },
        edge: { color: rgba(250, 206, 178, 1), width: 1.1, opacity: 0.92, visible: true },
      };
    case "appliance":
      return {
        face: { color: rgba(164, 184, 204, 1), opacity: 0.035, visible: true },
        edge: { color: rgba(186, 204, 222, 1), width: 1.1, opacity: 0.92, visible: true },
      };
    case "socket":
    case "smart-switch":
      return {
        face: { color: rgba(250, 204, 120, 1), opacity: 0.035, visible: true },
        edge: { color: rgba(252, 220, 150, 1), width: 1.1, opacity: 0.92, visible: true },
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
  const face = { ...base.face!, ...style?.face };
  const edge = { ...base.edge!, ...style?.edge };
  if (isCadGhostType(type)) {
    face.opacity = base.face!.opacity;
    face.visible = true;
    edge.color = base.edge!.color;
    edge.opacity = base.edge!.opacity;
    edge.visible = true;
    edge.width = Math.max(edge.width, base.edge!.width);
  }
  return { face, edge, hatch: style?.hatch ?? base.hatch };
}
