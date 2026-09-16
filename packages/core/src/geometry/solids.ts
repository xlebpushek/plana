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

/** Opening punched through a wall (offsets in mm along the path from start). */
export const WallCutoutSchema = z.object({
  offset: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive(),
  /** Height of opening bottom above wall baseZ (mm). */
  sill: z.number().nonnegative().default(0),
  kind: z.enum(["door", "window", "opening"]).optional(),
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
  cutouts: z.array(WallCutoutSchema).optional(),
});

/** Horizontal slab with optional holes (mm, XY outline). */
export const FloorGeometrySchema = z.object({
  type: z.literal("floor"),
  outline: z.array(z.tuple([z.number(), z.number()])).min(3),
  holes: z.array(z.array(z.tuple([z.number(), z.number()])).min(3)).optional(),
  thickness: z.number().positive(),
  baseZ: z.number().finite().default(0),
});

export type BoxGeometry = z.infer<typeof BoxGeometrySchema>;
export type CylinderGeometry = z.infer<typeof CylinderGeometrySchema>;
export type ExtrusionGeometry = z.infer<typeof ExtrusionGeometrySchema>;
export type WallCutout = z.infer<typeof WallCutoutSchema>;
export type WallGeometry = z.infer<typeof WallGeometrySchema>;
export type FloorGeometry = z.infer<typeof FloorGeometrySchema>;
