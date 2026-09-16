import { z } from "zod";

import { Vec3Schema } from "../transform";
import { PolylineGeometrySchema } from "./curves";

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
        path: PolylineGeometrySchema,
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

/**
 * Surface of revolution around +Z (Blender Screw / Three.js Lathe).
 * Profile is [radius, z] mm — any outline, not a stack of cylinders.
 */
export const LatheGeometrySchema = z.object({
  type: z.literal("lathe"),
  profile: z.array(z.tuple([z.number().nonnegative(), z.number().finite()])).min(2),
  segments: z.number().int().min(3).default(32),
});

/**
 * Sweep a circle along a spline (Blender Curve to Mesh / Three.js Tube).
 * `radius` is constant or per-control-point for taper (Set Curve Radius).
 */
export const TubeGeometrySchema = z.object({
  type: z.literal("tube"),
  points: z.array(Vec3Schema).min(2),
  radius: z.union([z.number().positive(), z.array(z.number().positive()).min(1)]),
  radialSegments: z.number().int().min(3).default(12),
  tubularSegments: z.number().int().min(2).optional(),
  capped: z.boolean().default(true),
});

/** Smooth parametric leaf blade (subdivided surface), not an extruded polygon. */
export const LeafGeometrySchema = z.object({
  type: z.literal("leaf"),
  length: z.number().positive(),
  width: z.number().positive(),
  thickness: z.number().positive(),
  cup: z.number().default(0.35),
  segments: z.number().int().min(2).default(8),
});

export type BoxGeometry = z.infer<typeof BoxGeometrySchema>;
export type CylinderGeometry = z.infer<typeof CylinderGeometrySchema>;
export type WallCutout = z.infer<typeof WallCutoutSchema>;
export type WallGeometry = z.infer<typeof WallGeometrySchema>;
export type FloorGeometry = z.infer<typeof FloorGeometrySchema>;
export type LatheGeometry = z.infer<typeof LatheGeometrySchema>;
export type TubeGeometry = z.infer<typeof TubeGeometrySchema>;
export type LeafGeometry = z.infer<typeof LeafGeometrySchema>;
