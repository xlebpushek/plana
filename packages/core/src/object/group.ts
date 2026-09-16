import { z } from "zod";

import { ObjectIdSchema, PlanaObjectSchema } from "./object.js";

export const GroupSchema = PlanaObjectSchema.extend({
  type: z.literal("group"),
  children: z.array(ObjectIdSchema),
});

export type Group = z.infer<typeof GroupSchema>;

export function isGroup(object: { type: string; children?: string[] }): object is Group {
  return object.type === "group" && Array.isArray(object.children);
}
