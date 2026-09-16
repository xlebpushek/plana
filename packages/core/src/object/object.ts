import { z } from "zod";

import { GeometrySchema } from "../geometry";
import { ObjectStyleSchema } from "../style";
import { TransformSchema } from "../transform";

export const ObjectIdSchema = z.string().min(1);
export const ObjectTypeSchema = z.string().min(1);

export const PlanaObjectSchema = z.object({
  id: ObjectIdSchema,
  type: ObjectTypeSchema,
  transform: TransformSchema,
  geometry: GeometrySchema.optional(),
  style: ObjectStyleSchema.optional(),
  parent: ObjectIdSchema.optional(),
  children: z.array(ObjectIdSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ObjectId = z.infer<typeof ObjectIdSchema>;
export type ObjectType = z.infer<typeof ObjectTypeSchema>;
export type PlanaObject = z.infer<typeof PlanaObjectSchema>;
