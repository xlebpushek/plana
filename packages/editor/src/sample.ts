/**
 * Demo apartment document (~33 m²), adapted from plana.v2.d flat plan.
 *
 * Plan mm: X east, Y south, Z up.
 * Openings sit on the opposite wall from the original flat.ts placement;
 * along-wall offsets stay as in the source (moving across the room already
 * swaps left/right for someone facing the wall). Partition / bath doors
 * are flipped onto the other side of their wall.
 */

import {
  addObject,
  createDocument,
  identityTransform,
  quatFromEulerDeg,
  type PlanaDocument,
  type PlanaObject,
  type Transform,
  type WallCutout,
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

function add(doc: PlanaDocument, object: PlanaObject, parent: string): PlanaDocument {
  return addObject(doc, object, parent);
}

type WallSpec = {
  id: string;
  name: string;
  along: "x" | "z";
  origin: number;
  position: number;
  length: number;
  cutouts?: Array<{
    kind: "door" | "window" | "opening";
    offset: number;
    width: number;
    height: number;
    sill?: number;
  }>;
};

/** Mirror opening along a wall: left clearance becomes right. */
const flipOffset = (length: number, offset: number, width: number) =>
  length - offset - width;

function wallObject(spec: WallSpec): PlanaObject {
  const cutouts: WallCutout[] | undefined = spec.cutouts?.map((c) => ({
    offset: c.offset * MM,
    width: c.width * MM,
    height: c.height * MM,
    sill: (c.sill ?? 0) * MM,
    kind: c.kind,
  }));

  if (spec.along === "x") {
    const y = spec.position * MM;
    return {
      id: spec.id,
      type: "wall",
      transform: identityTransform(),
      geometry: {
        type: "wall",
        path: {
          type: "polyline",
          points: [
            [spec.origin * MM, y, 0],
            [(spec.origin + spec.length) * MM, y, 0],
          ],
          closed: false,
        },
        thickness: WALL_T,
        height: { start: WALL_H, end: WALL_H },
        baseZ: FLOOR_T,
        cutouts,
      },
      metadata: { name: spec.name },
    };
  }

  const x = spec.position * MM;
  return {
    id: spec.id,
    type: "wall",
    transform: identityTransform(),
    geometry: {
      type: "wall",
      path: {
        type: "polyline",
        points: [
          [x, spec.origin * MM, 0],
          [x, (spec.origin + spec.length) * MM, 0],
        ],
        closed: false,
      },
      thickness: WALL_T,
      height: { start: WALL_H, end: WALL_H },
      baseZ: FLOOR_T,
      cutouts,
    },
    metadata: { name: spec.name },
  };
}

/**
 * Opening layout baked into the sample:
 * - North strip: window on west corridor (was kitchen east), door on east
 *   kitchen (was west entry). Same source offsets — window stays near the
 *   north wall, entry door stays near the partition.
 * - Living: window + balcony door on west wall with original east offsets
 *   (window near partition, door near south) and 180° yaw.
 * - Partition / bath doors flipped to the other side of their wall.
 */
/** Full west/east runs as one wall each — cutouts punched in the elevation. */
const WEST_LEN = 2.53 + 3.405; // 5.935
const EAST_LEN = WEST_LEN;
const LIVING_ORIGIN = 2.53;

const WALLS: WallSpec[] = [
  { id: "wall-north", name: "North Wall", along: "x", origin: 0, position: 0.075, length: 6.42 },
  { id: "wall-south", name: "South Wall", along: "x", origin: 0, position: 5.86, length: 6.42 },
  {
    id: "wall-west",
    name: "West Wall",
    along: "z",
    origin: 0,
    position: 0.075,
    length: WEST_LEN,
    cutouts: [
      { kind: "window", offset: 0.29, width: 1.32, height: 1.46, sill: 0.8 },
      { kind: "window", offset: LIVING_ORIGIN + 0.585, width: 1.4, height: 1.46, sill: 0.8 },
      { kind: "door", offset: LIVING_ORIGIN + 1.985, width: 0.7, height: 2.26 },
    ],
  },
  {
    id: "wall-east",
    name: "East Wall",
    along: "z",
    origin: 0,
    position: 6.345,
    length: EAST_LEN,
    cutouts: [{ kind: "door", offset: 1.23, width: 0.8, height: 2.04 }],
  },
  { id: "wall-bath-west", name: "Bath West Wall", along: "z", origin: 0, position: 1.46, length: 1.41 },
  { id: "wall-bath-east", name: "Bath East Wall", along: "z", origin: 0, position: 3.78, length: 1.41 },
  {
    id: "wall-bath-south",
    name: "Bath South Wall",
    along: "x",
    origin: 1.385,
    position: 1.335,
    length: 2.47,
    cutouts: [{ kind: "door", offset: flipOffset(2.47, 0.88, 0.8), width: 0.8, height: 2.04 }],
  },
  {
    id: "wall-partition",
    name: "Partition Wall",
    along: "x",
    origin: 0,
    position: 2.53,
    length: 6.42,
    cutouts: [{ kind: "door", offset: flipOffset(6.42, 0.575, 0.84), width: 0.84, height: 2.04 }],
  },
];

function openingCenter(origin: number, offset: number, width: number) {
  return origin + offset + width / 2;
}

function openingBox(
  id: string,
  type: "door" | "window" | "opening",
  name: string,
  x: number,
  z: number,
  along: "x" | "z",
  width: number,
  height: number,
  sill = 0,
  yawDeg = 0,
): PlanaObject {
  const sx = along === "x" ? width * MM : WALL_T;
  const sy = along === "z" ? width * MM : WALL_T;
  const bottom = FLOOR_T + sill * MM;
  return {
    id,
    type,
    transform: {
      ...identityTransform(),
      position: [x * MM, z * MM, bottom],
      rotation: quatFromEulerDeg(0, 0, yawDeg),
    },
    geometry: { type: "box", size: [sx, sy, height * MM] },
    metadata: { name },
  };
}

function floorPolygon(
  id: string,
  name: string,
  outlineM: Array<[number, number]>,
  holesM?: Array<Array<[number, number]>>,
): PlanaObject {
  return {
    id,
    type: "floor",
    transform: identityTransform(),
    geometry: {
      type: "floor",
      outline: outlineM.map(([x, y]) => [x * MM, y * MM] as [number, number]),
      holes: holesM?.map((h) => h.map(([x, y]) => [x * MM, y * MM] as [number, number])),
      thickness: FLOOR_T,
      baseZ: 0,
    },
    metadata: { name },
  };
}

function addShelving(doc: PlanaDocument, parent: string, xWest: number, zNorth: number): PlanaDocument {
  const OUTER = 50;
  const INNER = 16;
  const CELL = 360;
  const DEPTH = 392;
  const COLS = 5;
  const ROWS = 5;
  const SPAN = OUTER * 2 + INNER * (COLS - 1) + CELL * COLS;
  const xCenter = xWest * MM + DEPTH / 2;
  const yCenter = zNorth * MM + SPAN / 2;
  const y0 = FLOOR_T;

  doc = add(doc, group("shelving", "Living Shelving", xCenter, yCenter, 0), parent);

  const push = (
    id: string,
    name: string,
    cx: number,
    cy: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    type = "shelving",
  ) => {
    doc = add(
      doc,
      box(id, type, cx - xCenter, cy - yCenter, cz, w, d, h, name),
      "shelving",
    );
  };

  const horiz: Array<{ bottom: number; thick: number; label: string }> = [
    { bottom: y0, thick: OUTER, label: "Bottom Shelf" },
  ];
  let yCursor = y0 + OUTER;
  for (let row = 0; row < ROWS - 1; row++) {
    yCursor += CELL;
    horiz.push({ bottom: yCursor, thick: INNER, label: `Shelf ${row + 1}` });
    yCursor += INNER;
  }
  yCursor += CELL;
  horiz.push({ bottom: yCursor, thick: OUTER, label: "Top Shelf" });
  horiz.forEach((h, i) => push(`sh-h-${i}`, h.label, xCenter, yCenter, h.bottom, DEPTH, SPAN, h.thick));

  const sideHeight = SPAN - 2 * OUTER;
  const sideCz = y0 + OUTER;
  push("sh-n", "North Stile", xCenter, zNorth * MM + OUTER / 2, sideCz, DEPTH, OUTER, sideHeight);
  push("sh-s", "South Stile", xCenter, zNorth * MM + SPAN - OUTER / 2, sideCz, DEPTH, OUTER, sideHeight);

  for (let row = 0; row < ROWS; row++) {
    const cellY0 = y0 + OUTER + row * (CELL + INNER);
    for (let col = 0; col < COLS - 1; col++) {
      const zBoard = zNorth * MM + OUTER + (col + 1) * CELL + col * INNER;
      push(
        `sh-v-r${row}c${col}`,
        `Divider r${row + 1}c${col + 1}`,
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
  push("mirror-low", "Lower Mirror", xCenter, zSouthFace + 2, y0 + 270, 370, 4, 370, "window");
  push("mirror-up", "Upper Mirror", xCenter, zSouthFace + 2, y0 + 270 + 370 + 210, 370, 4, 900, "window");
  return doc;
}


/** Obovate Crassula ovata leaf outline (mm), wider toward the rounded tip. */
function crassulaLeafPath(length: number, width: number): Array<[number, number, number]> {
  const n = 16;
  const pts: Array<[number, number, number]> = [];
  const half = (t: number) => {
    const envelope = Math.pow(Math.sin(Math.PI * Math.pow(Math.min(1, Math.max(0, t)), 0.7)), 0.82);
    return (width / 2) * envelope * (0.32 + 0.68 * t);
  };
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([half(t), 0, t * length]);
  }
  for (let i = n - 1; i >= 1; i--) {
    const t = i / n;
    pts.push([-half(t), 0, t * length]);
  }
  return pts;
}

/**
 * Crassula ovata (jade plant / толстянка) ~1 m: thick forking trunk and
 * large fleshy obovate leaves extruded from a path — not boxes/cylinders.
 */
function addJadePlant(doc: PlanaDocument, parent: string): PlanaDocument {
  const rootId = "jade-plant";
  doc = add(doc, group(rootId, "Jade Plant (Crassula ovata)", 0.55 * MM, 5.35 * MM, 0), parent);

  const potStyle = {
    face: { color: { r: 176, g: 118, b: 82, a: 1 }, opacity: 0.45, visible: true },
    edge: { color: { r: 138, g: 90, b: 60, a: 1 }, width: 1, opacity: 0.85, visible: true },
  };
  const soilStyle = {
    face: { color: { r: 58, g: 44, b: 32, a: 1 }, opacity: 0.5, visible: true },
    edge: { color: { r: 40, g: 30, b: 22, a: 1 }, width: 1, opacity: 0.7, visible: true },
  };
  const barkStyle = {
    face: { color: { r: 124, g: 104, b: 84, a: 1 }, opacity: 0.44, visible: true },
    edge: { color: { r: 92, g: 76, b: 58, a: 1 }, width: 1, opacity: 0.8, visible: true },
  };
  const greenLeaf = {
    face: { color: { r: 52, g: 122, b: 68, a: 1 }, opacity: 0.55, visible: true },
    edge: { color: { r: 32, g: 88, b: 48, a: 1 }, width: 0.7, opacity: 0.75, visible: true },
  };
  const sunLeaf = {
    face: { color: { r: 68, g: 132, b: 64, a: 1 }, opacity: 0.52, visible: true },
    edge: { color: { r: 168, g: 78, b: 42, a: 1 }, width: 0.8, opacity: 0.8, visible: true },
  };

  doc = add(doc, {
    id: "jade-pot-rim", type: "plant", transform: t(0, 0, FLOOR_T),
    geometry: { type: "cylinder", radius: 110, height: 24, radialSegments: 28 },
    metadata: { name: "Pot Rim" }, style: potStyle,
  }, rootId);
  doc = add(doc, {
    id: "jade-pot", type: "plant",
    transform: { ...identityTransform(), position: [0, 0, FLOOR_T + 18], scale: [0.9, 0.9, 1] },
    geometry: { type: "cylinder", radius: 102, height: 165, radialSegments: 28 },
    metadata: { name: "Pot" }, style: potStyle,
  }, rootId);
  doc = add(doc, {
    id: "jade-soil", type: "plant", transform: t(0, 0, FLOOR_T + 170),
    geometry: { type: "cylinder", radius: 84, height: 16, radialSegments: 20 },
    metadata: { name: "Soil" }, style: soilStyle,
  }, rootId);

  type Stem = { id: string; x: number; y: number; z: number; yaw: number; pitch: number; radius: number; length: number; leafy: boolean };
  const stems: Stem[] = [
    { id: "jade-trunk-0", x: 0, y: 0, z: 175, yaw: 0, pitch: 0, radius: 30, length: 150, leafy: false },
    { id: "jade-trunk-1", x: 4, y: -3, z: 320, yaw: 6, pitch: 5, radius: 24, length: 125, leafy: false },
    { id: "jade-trunk-2", x: -3, y: 5, z: 440, yaw: -8, pitch: -4, radius: 18, length: 100, leafy: false },
    { id: "jade-fork-a", x: -22, y: 14, z: 530, yaw: -40, pitch: 24, radius: 12, length: 130, leafy: false },
    { id: "jade-fork-b", x: 24, y: -10, z: 535, yaw: 44, pitch: 22, radius: 12, length: 135, leafy: false },
    { id: "jade-fork-c", x: 2, y: 20, z: 545, yaw: 6, pitch: 34, radius: 11, length: 115, leafy: false },
    { id: "jade-fork-a1", x: -55, y: 32, z: 630, yaw: -58, pitch: 30, radius: 8, length: 95, leafy: true },
    { id: "jade-fork-a2", x: -30, y: 4, z: 640, yaw: -24, pitch: 36, radius: 8, length: 90, leafy: true },
    { id: "jade-fork-b1", x: 58, y: -26, z: 640, yaw: 60, pitch: 28, radius: 8, length: 100, leafy: true },
    { id: "jade-fork-b2", x: 32, y: 10, z: 650, yaw: 30, pitch: 36, radius: 8, length: 92, leafy: true },
    { id: "jade-fork-c1", x: -10, y: 48, z: 640, yaw: -14, pitch: 42, radius: 7, length: 88, leafy: true },
    { id: "jade-fork-c2", x: 20, y: 44, z: 645, yaw: 26, pitch: 40, radius: 7, length: 85, leafy: true },
  ];

  for (const s of stems) {
    doc = add(doc, {
      id: s.id, type: "plant",
      transform: { ...identityTransform(), position: [s.x, s.y, FLOOR_T + s.z], rotation: quatFromEulerDeg(s.pitch, s.yaw, 0) },
      geometry: { type: "cylinder", radius: s.radius, height: s.length, radialSegments: 12 },
      metadata: { name: s.id.replace("jade-", "").replace(/-/g, " ") }, style: barkStyle,
    }, rootId);
  }

  let leafSeq = 0;
  const addLeaf = (bx: number, by: number, bz: number, yaw: number, pitch: number, roll: number, length: number, width: number, thick: number, sunned: boolean) => {
    const style = sunned ? sunLeaf : greenLeaf;
    leafSeq += 1;
    doc = add(doc, {
      id: `jade-leaf-${leafSeq}`,
      type: "plant",
      transform: { ...identityTransform(), position: [bx, by, bz], rotation: quatFromEulerDeg(pitch, yaw, roll) },
      geometry: {
        type: "extrusion",
        profile: { type: "polygon", outer: crassulaLeafPath(length, width), holes: [] },
        height: thick,
        direction: [0, 1, 0],
      },
      metadata: { name: `Leaf ${leafSeq}` },
      style,
    }, rootId);
  };

  for (const s of stems) {
    if (!s.leafy) continue;
    const yawRad = (s.yaw * Math.PI) / 180;
    const pitchRad = (s.pitch * Math.PI) / 180;
    const dirX = Math.sin(yawRad) * Math.cos(pitchRad);
    const dirY = -Math.cos(yawRad) * Math.cos(pitchRad);
    const dirZ = Math.sin(pitchRad);
    const sideX = Math.cos(yawRad);
    const sideY = Math.sin(yawRad);
    const pairs = 3;
    for (let p = 0; p < pairs; p++) {
      const tAlong = 0.35 + (p / (pairs - 1)) * 0.55;
      const cx = s.x + dirX * s.length * tAlong;
      const cy = s.y + dirY * s.length * tAlong * 0.25;
      const cz = FLOOR_T + s.z + s.length * tAlong * 0.72;
      const spread = 18;
      const len = 78 + (p % 3) * 8;
      const wid = 42 + (p % 2) * 6;
      const thick = 9 + (p % 2);
      const sunned = p === pairs - 1;
      addLeaf(cx + sideX * spread, cy + sideY * spread, cz, s.yaw + 90, 58 + p * 6, 8, len, wid, thick, sunned);
      addLeaf(cx - sideX * spread, cy - sideY * spread, cz + 3, s.yaw - 90, 56 + p * 6, -8, len * 0.96, wid * 0.96, thick, sunned);
    }
    const tipX = s.x + dirX * s.length * 0.98;
    const tipY = s.y + dirY * s.length * 0.25;
    const tipZ = FLOOR_T + s.z + s.length * 0.92;
    for (let k = 0; k < 4; k++) {
      const ang = (k / 4) * Math.PI * 2;
      addLeaf(
        tipX + Math.cos(ang) * 16,
        tipY + Math.sin(ang) * 16,
        tipZ + (k % 2) * 8,
        s.yaw + (ang * 180) / Math.PI,
        38 + (k % 3) * 10,
        (k % 2) * 12 - 6,
        72 + (k % 3) * 10,
        40 + (k % 2) * 8,
        10,
        k % 3 === 0,
      );
    }
  }

  return doc;
}

export function createApartmentDocument(): PlanaDocument {
  let doc = createDocument();
  doc = {
    ...doc,
    meta: { name: "Apartment ~33m2", source: "plana.v2.d/engine/presets/flat.ts" },
  };

  doc = add(doc, group("apartment", "Apartment"), "root");
  doc = add(doc, group("walls", "Walls"), "apartment");
  for (const spec of WALLS) doc = add(doc, wallObject(spec), "walls");

  doc = add(doc, group("openings", "Openings"), "apartment");

  // West corridor window (was kitchen east) — near the north wall.
  doc = add(
    doc,
    openingBox(
      "window-corridor-west",
      "window",
      "Corridor Window",
      0.075,
      openingCenter(0, 0.29, 1.32),
      "z",
      1.32,
      1.46,
      0.8,
      180,
    ),
    "openings",
  );

  // East kitchen entry door (was west corridor) — nearer the partition.
  doc = add(
    doc,
    openingBox(
      "door-kitchen-east",
      "door",
      "Kitchen Entry Door",
      6.345,
      openingCenter(0, 1.23, 0.8),
      "z",
      0.8,
      2.04,
      0,
      180,
    ),
    "openings",
  );

  // Living west: original east offsets, 180° yaw (window near partition, door south).
  doc = add(
    doc,
    openingBox(
      "door-living-west",
      "door",
      "Living Door",
      0.075,
      openingCenter(2.53, 1.985, 0.7),
      "z",
      0.7,
      2.26,
      0,
      180,
    ),
    "openings",
  );
  doc = add(
    doc,
    openingBox(
      "window-living-west",
      "window",
      "Living Window",
      0.075,
      openingCenter(2.53, 0.585, 1.4),
      "z",
      1.4,
      1.46,
      0.8,
      180,
    ),
    "openings",
  );

  doc = add(
    doc,
    openingBox(
      "door-partition",
      "door",
      "Partition Door",
      openingCenter(0, flipOffset(6.42, 0.575, 0.84), 0.84),
      2.53,
      "x",
      0.84,
      2.04,
    ),
    "openings",
  );
  doc = add(
    doc,
    openingBox(
      "door-bath",
      "door",
      "Bath Door",
      openingCenter(1.385, flipOffset(2.47, 0.88, 0.8), 0.8),
      1.335,
      "x",
      0.8,
      2.04,
    ),
    "openings",
  );

  // One hall floor: corridor + kitchen as a single C-shape wrapping the bath.
  doc = add(doc, group("corridor", "Corridor"), "apartment");
  doc = add(
    doc,
    floorPolygon("floor-hall", "Hall Floor", [
      [0.15, 0.15],
      [1.385, 0.15],
      [1.385, 1.41],
      [3.855, 1.41],
      [3.855, 0.15],
      [6.27, 0.15],
      [6.27, 2.455],
      [0.15, 2.455],
    ]),
    "corridor",
  );

  doc = add(doc, group("bathroom", "Bathroom"), "apartment");
  doc = add(
    doc,
    floorPolygon("floor-bath", "Bath Floor", [
      [1.535, 0.15],
      [3.705, 0.15],
      [3.705, 1.26],
      [1.535, 1.26],
    ]),
    "bathroom",
  );

  doc = add(doc, group("kitchen", "Kitchen"), "apartment");

  doc = add(doc, group("living", "Living Room"), "apartment");
  doc = add(
    doc,
    floorPolygon("floor-living", "Living Floor", [
      [0.15, 2.605],
      [6.27, 2.605],
      [6.27, 5.785],
      [0.15, 5.785],
    ]),
    "living",
  );
  doc = addShelving(doc, "living", 3.633, 2.605);
  doc = addJadePlant(doc, "living");

  return doc;
}
