export type Vec2 = { x: number; y: number };

export type ObjectType = "rect" | "ellipse" | "group";

export type Transform = {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
};

export type Style = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
};

export type SceneObjectBase = {
  id: string;
  name: string;
  type: ObjectType;
  parentId: string | null;
  visible: boolean;
  locked: boolean;
  transform: Transform;
  style: Style;
};

export type RectObject = SceneObjectBase & {
  type: "rect";
  width: number;
  height: number;
  cornerRadius: number;
};

export type EllipseObject = SceneObjectBase & {
  type: "ellipse";
  width: number;
  height: number;
};

export type GroupObject = SceneObjectBase & {
  type: "group";
  childIds: string[];
};

export type SceneObject = RectObject | EllipseObject | GroupObject;

export type Camera = {
  x: number;
  y: number;
  zoom: number;
};

export type PlanaDocument = {
  version: 1;
  name: string;
  rootIds: string[];
  objects: Record<string, SceneObject>;
  camera: Camera;
};

export const defaultStyle = (): Style => ({
  fill: "#d4d4d8",
  stroke: "#3f3f46",
  strokeWidth: 1.5,
  opacity: 1,
});

export const defaultTransform = (x = 0, y = 0): Transform => ({
  x,
  y,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
});

export function createId(prefix = "obj"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createRect(
  partial: Partial<RectObject> & Pick<RectObject, "name" | "width" | "height">,
): RectObject {
  return {
    id: partial.id ?? createId("rect"),
    name: partial.name,
    type: "rect",
    parentId: partial.parentId ?? null,
    visible: partial.visible ?? true,
    locked: partial.locked ?? false,
    transform: partial.transform ?? defaultTransform(),
    style: partial.style ?? defaultStyle(),
    width: partial.width,
    height: partial.height,
    cornerRadius: partial.cornerRadius ?? 0,
  };
}

export function createEllipse(
  partial: Partial<EllipseObject> & Pick<EllipseObject, "name" | "width" | "height">,
): EllipseObject {
  return {
    id: partial.id ?? createId("ellipse"),
    name: partial.name,
    type: "ellipse",
    parentId: partial.parentId ?? null,
    visible: partial.visible ?? true,
    locked: partial.locked ?? false,
    transform: partial.transform ?? defaultTransform(),
    style: partial.style ?? defaultStyle(),
    width: partial.width,
    height: partial.height,
  };
}

export function createGroup(
  partial: Partial<GroupObject> & Pick<GroupObject, "name">,
): GroupObject {
  return {
    id: partial.id ?? createId("group"),
    name: partial.name,
    type: "group",
    parentId: partial.parentId ?? null,
    visible: partial.visible ?? true,
    locked: partial.locked ?? false,
    transform: partial.transform ?? defaultTransform(),
    style: partial.style ?? { ...defaultStyle(), fill: "transparent", stroke: "transparent" },
    childIds: partial.childIds ?? [],
  };
}

export function createEmptyDocument(name = "Untitled"): PlanaDocument {
  return {
    version: 1,
    name,
    rootIds: [],
    objects: {},
    camera: { x: 0, y: 0, zoom: 1 },
  };
}

export function cloneDocument(doc: PlanaDocument): PlanaDocument {
  return structuredClone(doc);
}

export function listChildren(doc: PlanaDocument, parentId: string | null): SceneObject[] {
  if (parentId === null) {
    return doc.rootIds.map((id) => doc.objects[id]).filter(Boolean);
  }
  const parent = doc.objects[parentId];
  if (!parent || parent.type !== "group") return [];
  return parent.childIds.map((id) => doc.objects[id]).filter(Boolean);
}

export function walkVisible(doc: PlanaDocument): SceneObject[] {
  const out: SceneObject[] = [];
  const visit = (ids: string[], ancestorsVisible: boolean) => {
    for (const id of ids) {
      const obj = doc.objects[id];
      if (!obj) continue;
      const visible = ancestorsVisible && obj.visible;
      if (obj.type === "group") {
        if (visible) visit(obj.childIds, true);
      } else if (visible) {
        out.push(obj);
      }
    }
  };
  visit(doc.rootIds, true);
  return out;
}

export function getWorldTransform(doc: PlanaDocument, id: string): Transform {
  const obj = doc.objects[id];
  if (!obj) return defaultTransform();
  if (!obj.parentId) return { ...obj.transform };
  const parent = getWorldTransform(doc, obj.parentId);
  return {
    x: parent.x + obj.transform.x * parent.scaleX,
    y: parent.y + obj.transform.y * parent.scaleY,
    rotation: parent.rotation + obj.transform.rotation,
    scaleX: parent.scaleX * obj.transform.scaleX,
    scaleY: parent.scaleY * obj.transform.scaleY,
  };
}

export function objectBounds(obj: SceneObject): { width: number; height: number } {
  if (obj.type === "group") return { width: 0, height: 0 };
  return { width: obj.width, height: obj.height };
}

export function hitTest(
  doc: PlanaDocument,
  worldX: number,
  worldY: number,
): string | undefined {
  const visible = walkVisible(doc);
  for (let i = visible.length - 1; i >= 0; i -= 1) {
    const obj = visible[i];
    if (obj.locked) continue;
    const t = getWorldTransform(doc, obj.id);
    const localX = (worldX - t.x) / t.scaleX;
    const localY = (worldY - t.y) / t.scaleY;
    if (obj.type === "rect") {
      if (localX >= 0 && localY >= 0 && localX <= obj.width && localY <= obj.height) {
        return obj.id;
      }
    } else if (obj.type === "ellipse") {
      const cx = obj.width / 2;
      const cy = obj.height / 2;
      const nx = (localX - cx) / cx;
      const ny = (localY - cy) / cy;
      if (nx * nx + ny * ny <= 1) return obj.id;
    }
  }
  return undefined;
}

export function serializeDocument(doc: PlanaDocument): string {
  return JSON.stringify(doc, null, 2);
}

export function parseDocument(json: string): PlanaDocument {
  const data = JSON.parse(json) as PlanaDocument;
  if (data.version !== 1 || !data.objects || !data.rootIds) {
    throw new Error("Invalid Plana document");
  }
  return data;
}
