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

export function extractSubtree(
  document: PlanaDocument,
  id: ObjectId,
): { rootId: ObjectId; objects: Record<ObjectId, PlanaObject> } {
  const objects: Record<ObjectId, PlanaObject> = {};
  const walk = (oid: ObjectId) => {
    const object = requireObject(document, oid);
    objects[oid] = structuredClone(object);
    for (const childId of object.children ?? []) walk(childId);
  };
  walk(id);
  return { rootId: id, objects };
}

export function pasteSubtree(
  document: PlanaDocument,
  clip: { rootId: ObjectId; objects: Record<ObjectId, PlanaObject> },
  options?: { parentId?: ObjectId; offset?: [number, number, number] },
): { document: PlanaDocument; id: ObjectId } {
  const source = clip.objects[clip.rootId];
  if (!source) throw new Error("Clipboard is empty");
  const parentId = options?.parentId ?? source.parent ?? document.root;
  const parent = requireObject(document, parentId);
  if (!isGroup(parent)) throw new Error(`Parent "${parentId}" is not a group`);

  const idMap = new Map<ObjectId, ObjectId>();
  const collect = (oid: ObjectId) => {
    const object = clip.objects[oid];
    const prefix = oid.replace(/_[a-z0-9]+$/i, "") || "obj";
    idMap.set(oid, createId(prefix));
    for (const childId of object.children ?? []) collect(childId);
  };
  collect(clip.rootId);

  const objects: Record<ObjectId, PlanaObject> = { ...document.objects };
  for (const [oldId, newId] of idMap) {
    const object = clip.objects[oldId];
    const isRootClone = oldId === clip.rootId;
    const position = [...object.transform.position] as [number, number, number];
    if (isRootClone && options?.offset) {
      position[0] += options.offset[0];
      position[1] += options.offset[1];
      position[2] += options.offset[2];
    }
    objects[newId] = {
      ...structuredClone(object),
      id: newId,
      parent: isRootClone ? parentId : idMap.get(object.parent ?? parentId) ?? parentId,
      children: (object.children ?? []).map((childId) => idMap.get(childId)!),
      transform: { ...structuredClone(object.transform), position },
    };
  }

  const nextParent = objects[parentId] as Group;
  objects[parentId] = {
    ...nextParent,
    children: [...nextParent.children, idMap.get(clip.rootId)!],
  };

  return { document: { ...document, objects }, id: idMap.get(clip.rootId)! };
}

export function cloneObjectTree(
  document: PlanaDocument,
  id: ObjectId,
  options?: { parentId?: ObjectId; offset?: [number, number, number] },
): { document: PlanaDocument; id: ObjectId } {
  if (id === document.root) throw new Error("Cannot clone root");
  const source = requireObject(document, id);
  const parentId = options?.parentId ?? source.parent ?? document.root;
  const parent = requireObject(document, parentId);
  if (!isGroup(parent)) throw new Error(`Parent "${parentId}" is not a group`);

  const idMap = new Map<ObjectId, ObjectId>();
  const collect = (oid: ObjectId) => {
    const object = requireObject(document, oid);
    const prefix = oid.replace(/_[a-z0-9]+$/i, "") || "obj";
    idMap.set(oid, createId(prefix));
    for (const childId of object.children ?? []) collect(childId);
  };
  collect(id);

  const objects: Record<ObjectId, PlanaObject> = { ...document.objects };
  for (const [oldId, newId] of idMap) {
    const object = document.objects[oldId];
    const isRootClone = oldId === id;
    const position = [...object.transform.position] as [number, number, number];
    if (isRootClone && options?.offset) {
      position[0] += options.offset[0];
      position[1] += options.offset[1];
      position[2] += options.offset[2];
    }
    objects[newId] = {
      ...structuredClone(object),
      id: newId,
      parent: isRootClone ? parentId : idMap.get(object.parent ?? parentId) ?? parentId,
      children: (object.children ?? []).map((childId) => idMap.get(childId)!),
      transform: { ...structuredClone(object.transform), position },
    };
  }

  const nextParent = objects[parentId] as Group;
  objects[parentId] = {
    ...nextParent,
    children: [...nextParent.children, idMap.get(id)!],
  };

  return { document: { ...document, objects }, id: idMap.get(id)! };
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
