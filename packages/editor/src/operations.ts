import {
  cloneDocument,
  createEllipse,
  createGroup,
  createId,
  createRect,
  type PlanaDocument,
  type SceneObject,
  type Style,
} from "@plana/viewer";

export type EditorTool = "select" | "pan" | "rect" | "ellipse";

export function addObject(doc: PlanaDocument, object: SceneObject): PlanaDocument {
  const next = cloneDocument(doc);
  next.objects[object.id] = object;
  if (object.parentId) {
    const parent = next.objects[object.parentId];
    if (parent?.type === "group") parent.childIds.push(object.id);
  } else {
    next.rootIds.push(object.id);
  }
  return next;
}

export function updateObject(
  doc: PlanaDocument,
  id: string,
  patch: Partial<SceneObject>,
): PlanaDocument {
  const next = cloneDocument(doc);
  const current = next.objects[id];
  if (!current) return doc;
  next.objects[id] = { ...current, ...patch, id: current.id, type: current.type } as SceneObject;
  return next;
}

export function updateStyle(doc: PlanaDocument, id: string, style: Partial<Style>): PlanaDocument {
  const current = doc.objects[id];
  if (!current) return doc;
  return updateObject(doc, id, { style: { ...current.style, ...style } });
}

export function moveObjects(
  doc: PlanaDocument,
  ids: string[],
  dx: number,
  dy: number,
): PlanaDocument {
  const next = cloneDocument(doc);
  for (const id of ids) {
    const obj = next.objects[id];
    if (!obj || obj.locked) continue;
    obj.transform.x += dx;
    obj.transform.y += dy;
  }
  return next;
}

export function deleteObjects(doc: PlanaDocument, ids: string[]): PlanaDocument {
  const next = cloneDocument(doc);
  const toDelete = new Set<string>();

  const collect = (id: string) => {
    if (toDelete.has(id)) return;
    toDelete.add(id);
    const obj = next.objects[id];
    if (obj?.type === "group") obj.childIds.forEach(collect);
  };
  ids.forEach(collect);

  for (const id of toDelete) {
    const obj = next.objects[id];
    if (!obj) continue;
    if (obj.parentId) {
      const parent = next.objects[obj.parentId];
      if (parent?.type === "group") {
        parent.childIds = parent.childIds.filter((childId) => childId !== id);
      }
    }
    delete next.objects[id];
  }
  next.rootIds = next.rootIds.filter((id) => !toDelete.has(id));
  return next;
}

export function reorderObject(doc: PlanaDocument, id: string, direction: "up" | "down"): PlanaDocument {
  const next = cloneDocument(doc);
  const obj = next.objects[id];
  if (!obj) return doc;
  const list = obj.parentId
    ? next.objects[obj.parentId]?.type === "group"
      ? (next.objects[obj.parentId] as Extract<SceneObject, { type: "group" }>).childIds
      : null
    : next.rootIds;
  if (!list) return doc;
  const index = list.indexOf(id);
  if (index < 0) return doc;
  const target = direction === "up" ? index + 1 : index - 1;
  if (target < 0 || target >= list.length) return doc;
  [list[index], list[target]] = [list[target], list[index]];
  return next;
}

export function groupObjects(doc: PlanaDocument, ids: string[]): PlanaDocument {
  if (ids.length < 2) return doc;
  const next = cloneDocument(doc);
  const group = createGroup({ name: "Group", childIds: [] });
  let minX = Infinity;
  let minY = Infinity;

  for (const id of ids) {
    const obj = next.objects[id];
    if (!obj || obj.parentId) continue;
    minX = Math.min(minX, obj.transform.x);
    minY = Math.min(minY, obj.transform.y);
  }
  if (!Number.isFinite(minX)) return doc;

  group.transform.x = minX;
  group.transform.y = minY;
  next.objects[group.id] = group;

  for (const id of ids) {
    const obj = next.objects[id];
    if (!obj || obj.parentId) continue;
    obj.parentId = group.id;
    obj.transform.x -= minX;
    obj.transform.y -= minY;
    group.childIds.push(id);
  }

  next.rootIds = next.rootIds.filter((id) => !ids.includes(id));
  next.rootIds.push(group.id);
  return next;
}

export function createRectAt(
  doc: PlanaDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  name?: string,
): { document: PlanaDocument; id: string } {
  const object = createRect({
    id: createId("rect"),
    name: name ?? `Rect ${Object.keys(doc.objects).length + 1}`,
    width: Math.max(8, width),
    height: Math.max(8, height),
    transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1 },
    style: {
      fill: "#e4e4e7",
      stroke: "#27272a",
      strokeWidth: 1.5,
      opacity: 1,
    },
  });
  return { document: addObject(doc, object), id: object.id };
}

export function createEllipseAt(
  doc: PlanaDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  name?: string,
): { document: PlanaDocument; id: string } {
  const object = createEllipse({
    id: createId("ellipse"),
    name: name ?? `Ellipse ${Object.keys(doc.objects).length + 1}`,
    width: Math.max(8, width),
    height: Math.max(8, height),
    transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1 },
    style: {
      fill: "#dbeafe",
      stroke: "#1d4ed8",
      strokeWidth: 1.5,
      opacity: 1,
    },
  });
  return { document: addObject(doc, object), id: object.id };
}
