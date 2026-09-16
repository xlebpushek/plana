import { z } from "zod";

import { Vec3Schema } from "../transform.js";

export const PointGeometrySchema = z.object({
  type: z.literal("point"),
  position: Vec3Schema,
});

export const SegmentGeometrySchema = z.object({
  type: z.literal("segment"),
  start: Vec3Schema,
  end: Vec3Schema,
});

export const LineGeometrySchema = z.object({
  type: z.literal("line"),
  origin: Vec3Schema,
  direction: Vec3Schema,
});

export const ArcGeometrySchema = z.object({
  type: z.literal("arc"),
  center: Vec3Schema,
  radius: z.number().positive(),
  startAngle: z.number().finite(),
  endAngle: z.number().finite(),
  normal: Vec3Schema,
});

export const CircleGeometrySchema = z.object({
  type: z.literal("circle"),
  center: Vec3Schema,
  radius: z.number().positive(),
  normal: Vec3Schema,
});

export type PointGeometry = z.infer<typeof PointGeometrySchema>;
export type SegmentGeometry = z.infer<typeof SegmentGeometrySchema>;
export type LineGeometry = z.infer<typeof LineGeometrySchema>;
export type ArcGeometry = z.infer<typeof ArcGeometrySchema>;
export type CircleGeometry = z.infer<typeof CircleGeometrySchema>;
