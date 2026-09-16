/**
 * Example scene ported from plana.v2.d/engine/presets/flat.ts
 * (real ~33 m² flat). This is demo *document data*, not product presets.
 *
 * Flat plan space: X east, Z south, Y up (meters).
 * Core document: XY floor, Z up (millimetres).
 *
 * Boxes are XY-centered and Z-bottom-anchored in the renderer, so vertical
 * centers from flat.ts are converted to bottoms (floor top / sill / board bottom).
 */

import {
  addObject,
  createDocument,
  identityTransform,
  type PlanaDocument,
  type PlanaObject,
  type Transform,
} from "@plana/core";

const MM = 1000;
const WALL_H = 2470;
const WALL_T = 150;
const FLOOR_T = 80;

const t = (x: number, y: number, z: number): Transform => ({
  ...identityTransform(),
  position: [x, y, z],
});

const group = (id: string, name: string, x = 0, y = 0, z = 0): PlanaObject => ({
  id,
  type: "group",
  transform: t(x, y, z),
  children: [],
  metadata: { name },
});

const box = (
  id: string,
  type: string,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  name: string,
): PlanaObject => ({
  id,
  type,
  transform: t(x, y, z),
  geometry: { type: "box", size: [sx, sy, sz] },
  metadata: { name },
});

const wallSeg = (
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  name: string,
  baseZ = FLOOR_T,
  height = WALL_H,
): PlanaObject => ({
  id,
  type: "wall",
  transform: identityTransform(),
  geometry: {
    type: "wall",
    path: {
      type: "polyline",
      points: [
        [x1, y1, 0],
        [x2, y2, 0],
      ],
      closed: false,
    },
    thickness: WALL_T,
    height: { start: height, end: height },
    baseZ,
  },
  metadata: { name },
});

type Cutout = {
  kind: "door" | "window";
  offset: number;
  width: number;
  height: number;
  sill?: number;
};

type WallSpec = {
  id: string;
  name: string;
  along: "x" | "z";
  origin: number;
  position: number;
  length: number;
  cutouts?: Cutout[];
};

function add(doc: PlanaDocument, object: PlanaObject, parent: string): PlanaDocument {
  return addObject(doc, object, parent);
}

function segAlong(
  id: string,
  spec: WallSpec,
  a: number,
  b: number,
  name: string,
  baseZ: number,
  height: number,
): PlanaObject {
  if (spec.along === "x") {
    const y = spec.position * MM;
    return wallSeg(id, (spec.origin + a) * MM, y, (spec.origin + b) * MM, y, name, baseZ, height);
  }
  const x = spec.position * MM;
  return wallSeg(id, x, (spec.origin + a) * MM, x, (spec.origin + b) * MM, name, baseZ, height);
}

/**
 * Split a centerline wall into full-height runs plus lintel/sill pieces so
 * openings match flat.ts cutout heights (not full-height gaps).
 */
function wallPieces(spec: WallSpec): PlanaObject[] {
  const cuts = [...(spec.cutouts ?? [])].sort((a, b) => a.offset - b.offset);
  const pieces: PlanaObject[] = [];
  let cursor = 0;
  let piece = 0;

  const pushFull = (a: number, b: number) => {
    if (b - a < 1e-6) return;
    pieces.push(segAlong(`${spec.id}-${piece++}`, spec, a, b, spec.name, FLOOR_T, WALL_H));
  };

  for (const cut of cuts) {
    if (cut.offset > cursor + 1e-6) pushFull(cursor, cut.offset);

    const sillM = cut.kind === "window" ? (cut.sill ?? 0.8) : 0;
    const sillMm = Math.round(sillM * MM);
    const openH = Math.round(cut.height * MM);
    const openBottom = FLOOR_T + sillMm;
    const openTop = openBottom + openH;

    if (cut.kind === "window" && sillMm > 0) {
      pieces.push(
        segAlong(
          `${spec.id}-sill-${piece++}`,
          spec,
          cut.offset,
          cut.offset + cut.width,
          `${spec.name} · подоконник`,
          FLOOR_T,
          sillMm,
        ),
      );
    }

    if (openTop < FLOOR_T + WALL_H - 1e-6) {
      pieces.push(
        segAlong(
          `${spec.id}-lintel-${piece++}`,
          spec,
          cut.offset,
          cut.offset + cut.width,
          `${spec.name} · перемычка`,
          openTop,
          FLOOR_T + WALL_H - openTop,
        ),
      );
    }

    cursor = Math.max(cursor, cut.offset + cut.width);
  }

  if (cursor < spec.length - 1e-6) pushFull(cursor, spec.length);
  return pieces;
}

const WALLS: WallSpec[] = [
  { id: "wall-north", name: "Север", along: "x", origin: 0, position: 0.075, length: 6.42 },
  { id: "wall-south", name: "Юг", along: "x", origin: 0, position: 5.86, length: 6.42 },
  {
    id: "wall-west-north",
    name: "Запад (коридор)",
    along: "z",
    origin: 0,
    position: 0.075,
    length: 2.53,
    cutouts: [{ kind: "door", offset: 1.23, width: 0.8, height: 2.04 }],
  },
  {
    id: "wall-west-living",
    name: "Запад (гостиная)",
    along: "z",
    origin: 2.53,
    position: 0.075,
    length: 3.405,
  },
  {
    id: "wall-east-kitchen",
    name: "Восток (кухня)",
    along: "z",
    origin: 0,
    position: 6.345,
    length: 2.53,
    cutouts: [{ kind: "window", offset: 0.29, width: 1.32, height: 1.46, sill: 0.8 }],
  },
  {
    id: "wall-east-living",
    name: "Восток (гостиная)",
    along: "z",
    origin: 2.53,
    position: 6.345,
    length: 3.405,
    cutouts: [
      { kind: "window", offset: 0.585, width: 1.4, height: 1.46, sill: 0.8 },
      { kind: "door", offset: 1.985, width: 0.7, height: 2.26 },
    ],
  },
  { id: "wall-bath-west", name: "С/у запад", along: "z", origin: 0, position: 1.46, length: 1.41 },
  { id: "wall-bath-east", name: "С/у восток", along: "z", origin: 0, position: 3.78, length: 1.41 },
  {
    id: "wall-bath-south",
    name: "С/у юг",
    along: "x",
    origin: 1.385,
    position: 1.335,
    length: 2.47,
    cutouts: [{ kind: "door", offset: 0.88, width: 0.8, height: 2.04 }],
  },
  {
    id: "wall-partition",
    name: "Перегородка",
    along: "x",
    origin: 0,
    position: 2.53,
    length: 6.42,
    cutouts: [{ kind: "door", offset: 0.575, width: 0.84, height: 2.04 }],
  },
];

function floorSlab(
  id: string,
  name: string,
  x0: number,
  z0: number,
  width: number,
  depth: number,
): PlanaObject {
  return box(
    id,
    "floor",
    (x0 + width / 2) * MM,
    (z0 + depth / 2) * MM,
    0,
    width * MM,
    depth * MM,
    FLOOR_T,
    name,
  );
}

function openingBox(
  id: string,
  type: "door" | "window",
  name: string,
  x: number,
  z: number,
  along: "x" | "z",
  width: number,
  height: number,
  /** Height of opening bottom above floor top (meters), from flat.ts. */
  sill = 0,
): PlanaObject {
  const sx = along === "x" ? width * MM : WALL_T;
  const sy = along === "z" ? width * MM : WALL_T;
  const bottom = FLOOR_T + sill * MM;
  return box(id, type, x * MM, z * MM, bottom, sx, sy, height * MM, name);
}

/** Living shelving 5×5 from flat.ts (xWest, zNorth of carcass). */
function addShelving(doc: PlanaDocument, parent: string, xWest: number, zNorth: number): PlanaDocument {
  const OUTER = 50;
  const INNER = 16;
  const CELL = 360;
  const DEPTH = 392;
  const COLS = 5;
  const ROWS = 5;
  const SPAN = OUTER * 2 + INNER * (COLS - 1) + CELL * COLS; // 1964
  const xCenter = xWest * MM + DEPTH / 2;
  const yCenter = zNorth * MM + SPAN / 2;
  const y0 = FLOOR_T;

  doc = add(doc, group("shelving", "стеллаж гостиная", xCenter, yCenter, 0), parent);

  const local = (ax: number, ay: number, az: number) =>
    [ax - xCenter, ay - yCenter, az] as const;

  const push = (
    id: string,
    name: string,
    cx: number,
    cy: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    type = "furniture",
  ) => {
    const [lx, ly] = local(cx, cy, 0);
    doc = add(doc, box(id, type, lx, ly, cz, w, d, h, name), "shelving");
  };

  const horiz: Array<{ bottom: number; thick: number; label: string }> = [
    { bottom: y0, thick: OUTER, label: "полка низ 50" },
  ];
  let yCursor = y0 + OUTER;
  for (let row = 0; row < ROWS - 1; row++) {
    yCursor += CELL;
    horiz.push({ bottom: yCursor, thick: INNER, label: `полка 16 #${row + 1}` });
    yCursor += INNER;
  }
  yCursor += CELL;
  horiz.push({ bottom: yCursor, thick: OUTER, label: "полка верх 50" });

  horiz.forEach((h, i) => {
    push(`sh-h-${i}`, h.label, xCenter, yCenter, h.bottom, DEPTH, SPAN, h.thick);
  });

  const sideHeight = SPAN - 2 * OUTER;
  const sideCz = y0 + OUTER;
  push("sh-n", "стойка 50 север", xCenter, zNorth * MM + OUTER / 2, sideCz, DEPTH, OUTER, sideHeight);
  push(
    "sh-s",
    "стойка 50 юг",
    xCenter,
    zNorth * MM + SPAN - OUTER / 2,
    sideCz,
    DEPTH,
    OUTER,
    sideHeight,
  );

  for (let row = 0; row < ROWS; row++) {
    const cellY0 = y0 + OUTER + row * (CELL + INNER);
    for (let col = 0; col < COLS - 1; col++) {
      const zBoard = zNorth * MM + OUTER + (col + 1) * CELL + col * INNER;
      push(
        `sh-v-r${row}c${col}`,
        `стойка 16 r${row + 1}c${col + 1}`,
        xCenter,
        zBoard + INNER / 2,
        cellY0,
        DEPTH,
        INNER,
        CELL,
      );
    }
  }

  const zSouthFace = zNorth * MM + SPAN;
  const mirrorCz = zSouthFace + 2;
  const lowerBottom = y0 + 270;
  const upperBottom = lowerBottom + 370 + 210;
  push("mirror-low", "зеркало нижнее", xCenter, mirrorCz, lowerBottom, 370, 4, 370, "window");
  push("mirror-up", "зеркало верхнее", xCenter, mirrorCz, upperBottom, 370, 4, 900, "window");

  return doc;
}

export function createApartmentDocument(): PlanaDocument {
  let doc = createDocument();
  doc = { ...doc, meta: { name: "Квартира (~33 м²)", source: "plana.v2.d/engine/presets/flat.ts" } };

  doc = add(doc, group("apartment", "Квартира"), "root");
  doc = add(doc, group("walls", "Стены"), "apartment");
  for (const spec of WALLS) {
    for (const piece of wallPieces(spec)) doc = add(doc, piece, "walls");
  }

  doc = add(doc, group("openings", "Проёмы"), "apartment");
  doc = add(
    doc,
    openingBox("door-entry", "door", "дверь", 0.075, 1.63, "z", 0.8, 2.04),
    "openings",
  );
  doc = add(
    doc,
    openingBox("door-partition", "door", "дверь", 0.995, 2.53, "x", 0.84, 2.04),
    "openings",
  );
  doc = add(
    doc,
    openingBox("door-bath", "door", "дверь", 2.665, 1.335, "x", 0.8, 2.04),
    "openings",
  );
  doc = add(
    doc,
    openingBox("door-living-east", "door", "дверь", 6.345, 4.865, "z", 0.7, 2.26),
    "openings",
  );
  doc = add(
    doc,
    openingBox("window-kitchen", "window", "окно", 6.345, 0.95, "z", 1.32, 1.46, 0.8),
    "openings",
  );
  doc = add(
    doc,
    openingBox("window-living", "window", "окно", 6.345, 3.815, "z", 1.4, 1.46, 0.8),
    "openings",
  );

  doc = add(doc, group("corridor", "Коридор"), "apartment");
  doc = add(
    doc,
    floorSlab("floor-corridor-a", "Пол коридор", 0.15, 0.15, 1.235, 2.305),
    "corridor",
  );
  doc = add(
    doc,
    floorSlab("floor-corridor-b", "Пол коридор (рукав)", 1.385, 1.41, 2.47, 1.045),
    "corridor",
  );

  doc = add(doc, group("bathroom", "Сан-узел"), "apartment");
  doc = add(doc, floorSlab("floor-bath", "Пол с/у", 1.535, 0.15, 2.17, 1.11), "bathroom");

  doc = add(doc, group("kitchen", "Кухня"), "apartment");
  doc = add(doc, floorSlab("floor-kitchen", "Пол кухня", 3.855, 0.15, 2.415, 2.305), "kitchen");

  doc = add(doc, group("living", "Гостиная"), "apartment");
  doc = add(doc, floorSlab("floor-living", "Пол гостиная", 0.15, 2.605, 6.12, 3.18), "living");
  doc = addShelving(doc, "living", 3.633, 2.605);

  return doc;
}
