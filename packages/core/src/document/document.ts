import { z } from "zod";

import { Group, isGroup } from "../object/group";
import { ObjectId, ObjectIdSchema, PlanaObject } from "../object/object";
import { PlanaObjectSchema } from "../object/object";
import { identityTransform } from "../transform";

export const PLANA_DOCUMENT_VERSION = 1;

export const PlanaUnitsSchema = z.enum(["mm"]);
export const PlanaDocumentMetaSchema = z.record(z.string(), z.unknown());

export const PlanaDocumentSchema = z.object({
  version: z.number().int().positive(),
  units: PlanaUnitsSchema,
  root: ObjectIdSchema,
  objects: z.record(ObjectIdSchema, PlanaObjectSchema),
  meta: PlanaDocumentMetaSchema.optional(),
});

export type PlanaDocument = z.infer<typeof PlanaDocumentSchema>;

export function createDocument(): PlanaDocument {
  const root: Group = {
    id: "root",
    type: "group",
    transform: identityTransform(),
    children: [],
  };
  return {
    version: PLANA_DOCUMENT_VERSION,
    units: "mm",
    root: root.id,
    objects: {
      [root.id]: root,
    },
  };
}

export function createId(prefix = "obj"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function requireObject(document: PlanaDocument, id: ObjectId): PlanaObject {
  const object = document.objects[id];
  if (!object) throw new Error(`Object "${id}" not found`);
  return object;
}

export function addObject(
  document: PlanaDocument,
  object: PlanaObject,
  parentId: ObjectId = document.root,
): PlanaDocument {
  if (document.objects[object.id]) {
    throw new Error(`Object "${object.id}" already exists`);
  }

  const parent = requireObject(document, parentId);
  if (!isGroup(parent)) {
    throw new Error(`Parent "${parentId}" is not a group`);
  }

  const nextParent: Group = {
    ...parent,
    children: [...parent.children, object.id],
  };

  return {
    ...document,
    objects: {
      ...document.objects,
      [parentId]: nextParent,
      [object.id]: {
        ...object,
        parent: parentId,
      },
    },
  };
}

function collectSubtree(document: PlanaDocument, id: ObjectId, out: Set<ObjectId>) {
  if (out.has(id)) return;
  out.add(id);
  const object = document.objects[id];
  if (!object?.children) return;
  for (const childId of object.children) collectSubtree(document, childId, out);
}

export function removeObject(document: PlanaDocument, id: ObjectId): PlanaDocument {
  if (id === document.root) throw new Error("Cannot remove root");
  const object = requireObject(document, id);
  const toRemove = new Set<ObjectId>();
  collectSubtree(document, id, toRemove);

  const objects: Record<ObjectId, PlanaObject> = { ...document.objects };
  for (const removeId of toRemove) delete objects[removeId];

  if (object.parent && objects[object.parent] && isGroup(objects[object.parent])) {
    const parent = objects[object.parent] as Group;
    objects[object.parent] = {
      ...parent,
      children: parent.children.filter((childId) => childId !== id),
    };
  }

  return { ...document, objects };
}

export function updateObject(
  document: PlanaDocument,
  id: ObjectId,
  patch: Partial<Omit<PlanaObject, "id">>,
): PlanaDocument {
  const current = requireObject(document, id);
  return {
    ...document,
    objects: {
      ...document.objects,
      [id]: {
        ...current,
        ...patch,
        id: current.id,
      },
    },
  };
}

export function createWallObject(options?: {
  id?: string;
  name?: string;
  length?: number;
  thickness?: number;
  height?: number;
  baseZ?: number;
}): PlanaObject {
  const length = options?.length ?? 2000;
  const thickness = options?.thickness ?? 150;
  const height = options?.height ?? 2700;
  const baseZ = options?.baseZ ?? 0;
  const id = options?.id ?? createId("wall");
  return {
    id,
    type: "wall",
    transform: identityTransform(),
    geometry: {
      type: "wall",
      path: {
        type: "polyline",
        points: [
          [0, 0, 0],
          [length, 0, 0],
        ],
        closed: false,
      },
      thickness,
      height: { start: height, end: height },
      baseZ,
    },
    metadata: { name: options?.name ?? "Wall" },
  };
}

export function createBoxObject(options?: {
  id?: string;
  name?: string;
  size?: [number, number, number];
  type?: string;
}): PlanaObject {
  const id = options?.id ?? createId("box");
  return {
    id,
    type: options?.type ?? "object",
    transform: { ...identityTransform(), position: [0, 0, 0] },
    geometry: { type: "box", size: options?.size ?? [1000, 1000, 1000] },
    metadata: { name: options?.name ?? id },
  };
}
