import { z } from "zod";

import { PolylineGeometrySchema } from "./curves";
import {
  BoxGeometrySchema,
  CylinderGeometrySchema,
  FloorGeometrySchema,
  LatheGeometrySchema,
  LeafGeometrySchema,
  TubeGeometrySchema,
  WallGeometrySchema,
} from "./solids";

export const GeometrySchema = z.discriminatedUnion("type", [
  PolylineGeometrySchema,
  BoxGeometrySchema,
  CylinderGeometrySchema,
  WallGeometrySchema,
  FloorGeometrySchema,
  LatheGeometrySchema,
  TubeGeometrySchema,
  LeafGeometrySchema,
]);

export type Geometry = z.infer<typeof GeometrySchema>;

export * from "./curves";
export * from "./solids";
