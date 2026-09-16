import { z } from "zod";

import { Vec3Schema } from "../transform";

export const PolylineGeometrySchema = z.object({
  type: z.literal("polyline"),
  points: z.array(Vec3Schema).min(2),
  closed: z.boolean(),
});

export type PolylineGeometry = z.infer<typeof PolylineGeometrySchema>;
