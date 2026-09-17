import {
  addObject,
  cloneObjectTree,
  createBoxObject,
  createDocument,
  createId,
  createWallObject,
  deserialize,
  extractSubtree,
  identityTransform,
  pasteSubtree,
  removeObject,
  updateObject,
  type ObjectId,
  type PlanaDocument,
  type PlanaObject,
} from "@plana/core";
import { combine, createEvent, createStore, sample } from "effector";

const HISTORY_LIMIT = 100;

export const setDocument = createEvent<PlanaDocument>();
export const commitDocument = createEvent<PlanaDocument>();
export const undo = createEvent();
export const redo = createEvent();
export const selectId = createEvent<ObjectId | undefined>();
export const frameScene = createEvent();
export const addPrimitive = createEvent<"box" | "wall" | "cylinder" | "group">();
export const deleteSelected = createEvent();
export const importJson = createEvent<string>();

export const $document = createStore<PlanaDocument>(createDocument());
export const $selectedId = createStore<ObjectId | null>(null);
export const $past = createStore<PlanaDocument[]>([]);
export const $future = createStore<PlanaDocument[]>([]);
export const $frameTick = createStore(0);
export const $canUndo = $past.map((past) => past.length > 0);
export const $canRedo = $future.map((future) => future.length > 0);

export const $selectedIds = combine($document, $selectedId, (document, selectedId) => {
  if (!selectedId) return [] as ObjectId[];
  const ids: ObjectId[] = [];
  const walk = (id: ObjectId) => {
    const object = document.objects[id];
    if (!object) return;
    ids.push(id);
    for (const child of object.children ?? []) walk(child);
  };
  walk(selectedId);
  return ids;
});

$document.on(setDocument, (_, document) => document);
$selectedId.on(selectId, (_, id) => id ?? null);
$selectedId.on(setDocument, () => null);
$past.on(setDocument, () => []);
$future.on(setDocument, () => []);
$frameTick.on(frameScene, (tick) => tick + 1);

sample({
  clock: commitDocument,
  source: { document: $document, past: $past },
  fn: ({ document, past }) => [...past, document].slice(-HISTORY_LIMIT),
  target: $past,
});
sample({
  clock: commitDocument,
  fn: () => [] as PlanaDocument[],
  target: $future,
});
sample({
  clock: commitDocument,
  target: $document,
});

const undoStep = sample({
  clock: undo,
  source: { document: $document, past: $past, future: $future },
  filter: ({ past }) => past.length > 0,
  fn: ({ document, past, future }) => ({
    document: past[past.length - 1],
    past: past.slice(0, -1),
    future: [...future, document],
  }),
});
$document.on(undoStep, (_, step) => step.document);
$past.on(undoStep, (_, step) => step.past);
$future.on(undoStep, (_, step) => step.future);

const redoStep = sample({
  clock: redo,
  source: { document: $document, past: $past, future: $future },
  filter: ({ future }) => future.length > 0,
  fn: ({ document, past, future }) => ({
    document: future[future.length - 1],
    past: [...past, document],
    future: future.slice(0, -1),
  }),
});
$document.on(redoStep, (_, step) => step.document);
$past.on(redoStep, (_, step) => step.past);
$future.on(redoStep, (_, step) => step.future);

function buildPrimitive(document: PlanaDocument, kind: "box" | "wall" | "cylinder" | "group") {
  if (kind === "group") {
    const id = createId("group");
    return {
      document: addObject(document, {
        id,
        type: "group",
        transform: identityTransform(),
        children: [],
        metadata: { name: id },
      }),
      id,
    };
  }
  if (kind === "wall") {
    const wall = createWallObject({ name: "Wall" });
    return { document: addObject(document, wall), id: wall.id };
  }
  if (kind === "cylinder") {
    const id = createId("cylinder");
    return {
      document: addObject(document, {
        id,
        type: "object",
        transform: { ...identityTransform(), position: [0, 0, 0] },
        geometry: { type: "cylinder", radius: 200, height: 800, radialSegments: 24 },
        metadata: { name: id },
      }),
      id,
    };
  }
  const box = createBoxObject();
  return { document: addObject(document, box), id: box.id };
}

const primitiveAdded = sample({
  clock: addPrimitive,
  source: $document,
  fn: buildPrimitive,
});
sample({
  clock: primitiveAdded,
  fn: ({ document }) => document,
  target: commitDocument,
});
sample({
  clock: primitiveAdded,
  fn: ({ id }) => id,
  target: selectId,
});

const deleted = sample({
  clock: deleteSelected,
  source: { document: $document, selectedId: $selectedId },
  filter: ({ document, selectedId }) => Boolean(selectedId && selectedId !== document.root),
  fn: ({ document, selectedId }) => removeObject(document, selectedId!),
});
sample({
  clock: deleted,
  target: commitDocument,
});
sample({
  clock: deleted,
  fn: () => undefined,
  target: selectId,
});

sample({
  clock: importJson,
  fn: deserialize,
  target: commitDocument,
});
sample({
  clock: importJson,
  fn: () => undefined,
  target: selectId,
});

export const duplicateSelected = createEvent();
export const copySelected = createEvent();
export const cutSelected = createEvent();
export const pasteClipboard = createEvent();
export const requestZoom = createEvent<"in" | "out" | "fit">();
export const setZoomPercent = createEvent<number>();
export const $zoomPercent = createStore(100).on(setZoomPercent, (_, value) => value);

export const $clipboard = createStore<{
  rootId: ObjectId;
  objects: Record<ObjectId, PlanaObject>;
} | null>(null);

sample({
  clock: copySelected,
  source: { document: $document, selectedId: $selectedId },
  filter: ({ document, selectedId }) => Boolean(selectedId && selectedId !== document.root),
  fn: ({ document, selectedId }) => extractSubtree(document, selectedId!),
  target: $clipboard,
});

const duplicated = sample({
  clock: duplicateSelected,
  source: { document: $document, selectedId: $selectedId },
  filter: ({ document, selectedId }) => Boolean(selectedId && selectedId !== document.root),
  fn: ({ document, selectedId }) =>
    cloneObjectTree(document, selectedId!, { offset: [120, 120, 0] }),
});
sample({
  clock: duplicated,
  fn: ({ document }) => document,
  target: commitDocument,
});
sample({
  clock: duplicated,
  fn: ({ id }) => id,
  target: selectId,
});

const pasted = sample({
  clock: pasteClipboard,
  source: { document: $document, clipboard: $clipboard, selectedId: $selectedId },
  filter: ({ clipboard }) => Boolean(clipboard),
  fn: ({ document, clipboard, selectedId }) => {
    const parentId =
      (selectedId && document.objects[selectedId]?.children ? selectedId : document.objects[selectedId ?? ""]?.parent) ??
      document.root;
    return pasteSubtree(document, clipboard!, { parentId, offset: [160, 80, 0] });
  },
});
sample({
  clock: pasted,
  fn: ({ document }) => document,
  target: commitDocument,
});
sample({
  clock: pasted,
  fn: ({ id }) => id,
  target: selectId,
});

sample({
  clock: cutSelected,
  target: copySelected,
});
sample({
  clock: cutSelected,
  target: deleteSelected,
});

export const nudgeSelected = createEvent<{ dx: number; dy: number; dz: number }>();

const nudged = sample({
  clock: nudgeSelected,
  source: { document: $document, selectedId: $selectedId },
  filter: ({ document, selectedId }) => Boolean(selectedId && selectedId !== document.root),
  fn: ({ document, selectedId }, delta) => {
    const object = document.objects[selectedId!];
    const [x, y, z] = object.transform.position;
    return updateObject(document, selectedId!, {
      transform: {
        ...object.transform,
        position: [x + delta.dx, y + delta.dy, z + delta.dz],
      },
    });
  },
});
sample({
  clock: nudged,
  target: commitDocument,
});
