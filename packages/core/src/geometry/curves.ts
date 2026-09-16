import { z } from "zod";

import { Vec3Schema } from "../transform.js";

export const PolylineGeometrySchema = z.object({
  type: z.literal("polyline"),
  points: z.array(Vec3Schema).min(2),
  closed: z.boolean(),
});

export const PolygonGeometrySchema = z.object({
  type: z.literal("polygon"),
  outer: z.array(Vec3Schema).min(3),
  holes: z.array(z.array(Vec3Schema).min(3)).default([]),
});

export type PolylineGeometry = z.infer<typeof PolylineGeometrySchema>;
export type PolygonGeometry = z.infer<typeof PolygonGeometrySchema>;
