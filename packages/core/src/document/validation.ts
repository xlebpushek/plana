import type { PlanaDocument } from "./document.js";
import { PlanaDocumentSchema } from "./document.js";
import { isGroup } from "../object/group.js";

export function validateDocument(document: PlanaDocument): PlanaDocument {
  const parsed = PlanaDocumentSchema.parse(document);

  if (!parsed.objects[parsed.root]) {
    throw new Error(`Root object "${parsed.root}" is missing`);
  }

  for (const object of Object.values(parsed.objects)) {
    if (object.parent) {
      const parent = parsed.objects[object.parent];
      if (!parent) throw new Error(`Object "${object.id}" has missing parent "${object.parent}"`);
      if (!isGroup(parent)) throw new Error(`Parent "${object.parent}" is not a group`);
      if (!parent.children.includes(object.id)) {
        throw new Error(`Parent "${object.parent}" does not list child "${object.id}"`);
      }
    }
    for (const childId of object.children ?? []) {
      if (!parsed.objects[childId]) {
        throw new Error(`Object "${object.id}" references missing child "${childId}"`);
      }
    }
  }

  return parsed;
}
