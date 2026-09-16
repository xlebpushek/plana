import { z } from "zod";

import {
  ArcGeometrySchema,
  CircleGeometrySchema,
  LineGeometrySchema,
  PointGeometrySchema,
  SegmentGeometrySchema,
} from "./primitives.js";
import { PolygonGeometrySchema, PolylineGeometrySchema } from "./curves.js";
import {
  BoxGeometrySchema,
  CylinderGeometrySchema,
  ExtrusionGeometrySchema,
  WallGeometrySchema,
} from "./solids.js";

export const GeometrySchema = z.discriminatedUnion("type", [
  PointGeometrySchema,
  SegmentGeometrySchema,
  LineGeometrySchema,
  ArcGeometrySchema,
  CircleGeometrySchema,
  PolylineGeometrySchema,
  PolygonGeometrySchema,
  BoxGeometrySchema,
  CylinderGeometrySchema,
  ExtrusionGeometrySchema,
  WallGeometrySchema,
]);

export type Geometry = z.infer<typeof GeometrySchema>;

export * from "./primitives.js";
export * from "./curves.js";
export * from "./solids.js";
export * from "./topology.js";
export * from "./operations.js";
export * from "./bounds.js";
export * from "./surfaces.js";
