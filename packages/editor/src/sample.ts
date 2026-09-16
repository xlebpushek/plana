/**
 * Demo apartment document (~33 m²), adapted from plana.v2.d flat plan.
 *
 * Plan mm: X east, Y south, Z up. Openings on the north strip are swapped
 * across east/west (door ↔ window) with left/right offsets mirrored; living
 * east window+door moved to the west living wall the same way.
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
 * Corrected opening layout (baked in):
 * - North strip: entry door on east kitchen wall, window on west corridor
 *   (swapped from flat.ts, offsets mirrored).
 * - Living: window + balcony door on west living wall (moved from east,
 *   offsets mirrored).
 */
/** Full west/east runs (corridor+living) as one wall each — cutouts, not pieces. */
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
      // Corridor window (was kitchen east window — swapped, offset mirrored).
      {
        kind: "window",
        offset: flipOffset(2.53, 0.29, 1.32),
        width: 1.32,
        height: 1.46,
        sill: 0.8,
      },
      // Living door + window (moved from east living, offsets mirrored).
      {
        kind: "door",
        offset: LIVING_ORIGIN + flipOffset(3.405, 1.985, 0.7),
        width: 0.7,
        height: 2.26,
      },
      {
        kind: "window",
        offset: LIVING_ORIGIN + flipOffset(3.405, 0.585, 1.4),
        width: 1.4,
        height: 1.46,
        sill: 0.8,
      },
    ],
  },
  {
    id: "wall-east",
    name: "East Wall",
    along: "z",
    origin: 0,
    position: 6.345,
    length: EAST_LEN,
    cutouts: [
      // Kitchen entry door (was west corridor door — swapped, offset mirrored).
      {
        kind: "door",
        offset: flipOffset(2.53, 1.23, 0.8),
        width: 0.8,
        height: 2.04,
      },
    ],
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
    cutouts: [{ kind: "door", offset: 0.88, width: 0.8, height: 2.04 }],
  },
  {
    id: "wall-partition",
    name: "Partition Wall",
    along: "x",
    origin: 0,
    position: 2.53,
    length: 6.42,
    cutouts: [{ kind: "door", offset: 0.575, width: 0.84, height: 2.04 }],
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

/**
 * Jade plant / money tree (~1 m tall Crassula ovata) with segmented trunk,
 * forked branches and fleshy oval leaves (flattened cylinders).
 * Placed in the living-room south-west corner.
 */
function addMoneyTree(doc: PlanaDocument, parent: string): PlanaDocument {
  const gx = 0.55 * MM;
  const gy = 5.35 * MM;
  doc = add(doc, group("money-tree", "Money Tree", gx, gy, 0), parent);

  const potStyle = {
    face: { color: { r: 92, g: 72, b: 55, a: 1 }, opacity: 0.4, visible: true },
    edge: { color: { r: 70, g: 55, b: 40, a: 1 }, width: 1, opacity: 0.85, visible: true },
  };
  const soilStyle = {
    face: { color: { r: 55, g: 42, b: 30, a: 1 }, opacity: 0.45, visible: true },
    edge: { color: { r: 40, g: 30, b: 22, a: 1 }, width: 1, opacity: 0.7, visible: true },
  };
  const woodStyle = {
    face: { color: { r: 110, g: 82, b: 52, a: 1 }, opacity: 0.4, visible: true },
    edge: { color: { r: 80, g: 58, b: 36, a: 1 }, width: 1, opacity: 0.75, visible: true },
  };
  const leafFace = { color: { r: 46, g: 150, b: 78, a: 1 }, opacity: 0.5, visible: true };
  const leafEdge = { color: { r: 28, g: 110, b: 58, a: 1 }, width: 0.8, opacity: 0.7, visible: true };
  const leafTipFace = { color: { r: 62, g: 170, b: 95, a: 1 }, opacity: 0.48, visible: true };

  // Terracotta-ish pot (~22 cm) with soil
  doc = add(
    doc,
    {
      id: "mt-pot-base",
      type: "plant",
      transform: t(0, 0, FLOOR_T),
      geometry: { type: "cylinder", radius: 115, height: 28, radialSegments: 24 },
      metadata: { name: "Pot Base" },
      style: potStyle,
    },
    "money-tree",
  );
  doc = add(
    doc,
    {
      id: "mt-pot",
      type: "plant",
      transform: {
        ...identityTransform(),
        position: [0, 0, FLOOR_T + 28],
        scale: [1, 1, 1],
      },
      geometry: { type: "cylinder", radius: 100, height: 155, radialSegments: 24 },
      metadata: { name: "Pot" },
      style: potStyle,
    },
    "money-tree",
  );
  doc = add(
    doc,
    {
      id: "mt-soil",
      type: "plant",
      transform: t(0, 0, FLOOR_T + 165),
      geometry: { type: "cylinder", radius: 88, height: 22, radialSegments: 20 },
      metadata: { name: "Soil" },
      style: soilStyle,
    },
    "money-tree",
  );

  // Trunk: slight jogs, tapering (~70 cm wood above soil → ~1 m total with crown)
  const trunk: Array<[number, number, number, number, number]> = [
    [0, 0, 185, 22, 95],
    [6, -3, 280, 20, 90],
    [-5, 5, 370, 18, 85],
    [4, -2, 455, 16, 80],
    [-2, 3, 535, 14, 75],
    [2, -1, 610, 12, 70],
  ];
  trunk.forEach(([x, y, z, r, h], i) => {
    doc = add(
      doc,
      {
        id: `mt-trunk-${i}`,
        type: "plant",
        transform: t(x, y, FLOOR_T + z),
        geometry: { type: "cylinder", radius: r, height: h, radialSegments: 14 },
        metadata: { name: `Trunk ${i + 1}` },
        style: woodStyle,
      },
      "money-tree",
    );
  });

  // Forked branches (tilted cylinders)
  const branches: Array<[number, number, number, number, number, number, number, number]> = [
    // x, y, z, yaw, pitch, roll, radius, length
    [8, 6, 680, 35, 28, 0, 7, 95],
    [-10, -4, 700, -40, 32, 8, 6.5, 90],
    [4, 12, 740, 10, 45, -6, 6, 80],
    [14, -8, 760, 55, 38, 4, 5.5, 85],
    [-12, 10, 780, -55, 42, -5, 5.5, 75],
    [0, -2, 820, 0, 55, 0, 5, 70],
    [10, 4, 850, 25, 48, 10, 4.5, 65],
    [-8, -6, 860, -30, 50, -8, 4.5, 60],
  ];
  branches.forEach(([x, y, z, yaw, pitch, roll, r, len], i) => {
    doc = add(
      doc,
      {
        id: `mt-branch-${i}`,
        type: "plant",
        transform: {
          ...identityTransform(),
          position: [x, y, FLOOR_T + z],
          rotation: quatFromEulerDeg(pitch, yaw, roll),
        },
        geometry: { type: "cylinder", radius: r, height: len, radialSegments: 10 },
        metadata: { name: `Branch ${i + 1}` },
        style: woodStyle,
      },
      "money-tree",
    );
  });

  // Fleshy oval leaves — flattened cylinders (scale Y thin) with tip pads
  let leaf = 0;
  const clusters: Array<[number, number, number, number]> = [
    [55, 20, 730, 0.9],
    [-48, -12, 750, 0.95],
    [18, 58, 790, 1.0],
    [68, -32, 810, 0.9],
    [-38, 48, 830, 1.05],
    [5, 5, 870, 1.1],
    [40, 28, 890, 0.95],
    [-42, -22, 910, 1.0],
    [12, -48, 850, 0.9],
    [-15, 18, 940, 1.05],
    [28, -8, 960, 0.85],
    [-22, 8, 980, 0.8],
  ];
  for (const [cx, cy, cz, scale] of clusters) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + cz * 0.01;
      const radial = (28 + (i % 4) * 10) * scale;
      const lx = cx + Math.cos(ang) * radial;
      const ly = cy + Math.sin(ang) * radial;
      const lz = FLOOR_T + cz + (i % 5) * 6 - 8;
      const lean = 18 + (i % 6) * 7;
      const yaw = (ang * 180) / Math.PI + (i % 3) * 8;
      const leafW = (22 + (i % 3) * 4) * scale;
      const leafL = (38 + (i % 4) * 5) * scale;
      doc = add(
        doc,
        {
          id: `mt-leaf-${leaf}`,
          type: "plant",
          transform: {
            ...identityTransform(),
            position: [lx, ly, lz],
            rotation: quatFromEulerDeg(lean, yaw, (i % 3) * 10 - 10),
            // Flatten cylinder into a thick oval leaf pad
            scale: [leafW / 20, 0.28, leafL / 40],
          },
          geometry: { type: "cylinder", radius: 20, height: 40, radialSegments: 16 },
          metadata: { name: `Leaf ${leaf + 1}` },
          style: {
            face: i % 3 === 0 ? leafTipFace : leafFace,
            edge: leafEdge,
          },
        },
        "money-tree",
      );
      leaf += 1;

      // Smaller tip leaflet
      if (i % 2 === 0) {
        const tipR = radial + leafL * 0.35;
        doc = add(
          doc,
          {
            id: `mt-leaf-tip-${leaf}`,
            type: "plant",
            transform: {
              ...identityTransform(),
              position: [
                cx + Math.cos(ang) * tipR,
                cy + Math.sin(ang) * tipR,
                lz + 4,
              ],
              rotation: quatFromEulerDeg(lean + 8, yaw, 0),
              scale: [0.55, 0.22, 0.7],
            },
            geometry: { type: "cylinder", radius: 14, height: 28, radialSegments: 12 },
            metadata: { name: `Leaf Tip ${leaf + 1}` },
            style: { face: leafTipFace, edge: leafEdge },
          },
          "money-tree",
        );
        leaf += 1;
      }
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

  // West corridor window (swapped from east kitchen)
  doc = add(
    doc,
    openingBox(
      "window-corridor-west",
      "window",
      "Corridor Window",
      0.075,
      openingCenter(0, flipOffset(2.53, 0.29, 1.32), 1.32),
      "z",
      1.32,
      1.46,
      0.8,
      180,
    ),
    "openings",
  );

  // East kitchen entry door (swapped from west corridor)
  doc = add(
    doc,
    openingBox(
      "door-kitchen-east",
      "door",
      "Kitchen Entry Door",
      6.345,
      openingCenter(0, flipOffset(2.53, 1.23, 0.8), 0.8),
      "z",
      0.8,
      2.04,
      0,
      180,
    ),
    "openings",
  );

  // Living west: door + window (moved from east, mirrored offsets, yaw 180°)
  doc = add(
    doc,
    openingBox(
      "door-living-west",
      "door",
      "Living Door",
      0.075,
      openingCenter(2.53, flipOffset(3.405, 1.985, 0.7), 0.7),
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
      openingCenter(2.53, flipOffset(3.405, 0.585, 1.4), 1.4),
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
    openingBox("door-partition", "door", "Partition Door", 0.995, 2.53, "x", 0.84, 2.04),
    "openings",
  );
  doc = add(
    doc,
    openingBox("door-bath", "door", "Bath Door", 2.665, 1.335, "x", 0.8, 2.04),
    "openings",
  );

  // Floors: L-shaped corridor as one slab; bath / kitchen / living separate.
  doc = add(doc, group("corridor", "Corridor"), "apartment");
  doc = add(
    doc,
    floorPolygon("floor-corridor", "Corridor Floor", [
      [0.15, 0.15],
      [1.385, 0.15],
      [1.385, 1.41],
      [3.855, 1.41],
      [3.855, 2.455],
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
  doc = add(
    doc,
    floorPolygon("floor-kitchen", "Kitchen Floor", [
      [3.855, 0.15],
      [6.27, 0.15],
      [6.27, 2.455],
      [3.855, 2.455],
    ]),
    "kitchen",
  );

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
  doc = addMoneyTree(doc, "living");

  return doc;
}
