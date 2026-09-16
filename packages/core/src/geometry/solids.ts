import { z } from "zod";

import { Vec3Schema } from "../transform.js";
import { PolygonGeometrySchema, PolylineGeometrySchema } from "./curves.js";
import { ArcGeometrySchema } from "./primitives.js";

export const BoxGeometrySchema = z.object({
  type: z.literal("box"),
  size: Vec3Schema,
});

export const CylinderGeometrySchema = z.object({
  type: z.literal("cylinder"),
  radius: z.number().positive(),
  height: z.number().positive(),
  radialSegments: z.number().int().min(3).default(16),
});

export const ExtrusionGeometrySchema = z.object({
  type: z.literal("extrusion"),
  profile: PolygonGeometrySchema,
  height: z.number().positive(),
  direction: Vec3Schema,
});

export const WallGeometrySchema = z.object({
  type: z.literal("wall"),
  path: z.union([PolylineGeometrySchema, ArcGeometrySchema]),
  thickness: z.number().positive(),
  height: z.object({
    start: z.number().positive(),
    end: z.number().positive(),
  }),
  baseZ: z.number().finite(),
});

export type BoxGeometry = z.infer<typeof BoxGeometrySchema>;
export type CylinderGeometry = z.infer<typeof CylinderGeometrySchema>;
export type ExtrusionGeometry = z.infer<typeof ExtrusionGeometrySchema>;
export type WallGeometry = z.infer<typeof WallGeometrySchema>;
