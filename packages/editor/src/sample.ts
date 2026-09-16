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
    cutouts: [{ kind: "door", offset: 0.5, width: 0.8, height: 2.04 }],
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
  // Against the living north wall, facing south: width along X, depth along Y.
  const xCenter = xWest * MM + SPAN / 2;
  const yCenter = zNorth * MM + DEPTH / 2;
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
  horiz.forEach((h, i) => push(`sh-h-${i}`, h.label, xCenter, yCenter, h.bottom, SPAN, DEPTH, h.thick));

  const sideHeight = SPAN - 2 * OUTER;
  const sideCz = y0 + OUTER;
  push("sh-w", "West Stile", xWest * MM + OUTER / 2, yCenter, sideCz, OUTER, DEPTH, sideHeight);
  push("sh-e", "East Stile", xWest * MM + SPAN - OUTER / 2, yCenter, sideCz, OUTER, DEPTH, sideHeight);

  for (let row = 0; row < ROWS; row++) {
    const cellY0 = y0 + OUTER + row * (CELL + INNER);
    for (let col = 0; col < COLS - 1; col++) {
      const xBoard = xWest * MM + OUTER + (col + 1) * CELL + col * INNER;
      push(
        `sh-v-r${row}c${col}`,
        `Divider r${row + 1}c${col + 1}`,
        xBoard + INNER / 2,
        yCenter,
        cellY0,
        INNER,
        DEPTH,
        CELL,
      );
    }
  }

  const ySouthFace = zNorth * MM + DEPTH;
  push("mirror-low", "Lower Mirror", xCenter, ySouthFace + 2, y0 + 270, 370, 4, 370, "window");
  push("mirror-up", "Upper Mirror", xCenter, ySouthFace + 2, y0 + 270 + 370 + 210, 370, 4, 900, "window");
  return doc;
}



function quatAlignZ(dx: number, dy: number, dz: number): [number, number, number, number] {
  const len = Math.hypot(dx, dy, dz) || 1;
  const x = dx / len;
  const y = dy / len;
  const z = dz / len;
  const dot = z;
  if (dot > 0.9995) return [0, 0, 0, 1];
  if (dot < -0.9995) return [1, 0, 0, 0];
  const ax = -y;
  const ay = x;
  const alen = Math.hypot(ax, ay) || 1;
  const half = Math.acos(Math.max(-1, Math.min(1, dot)));
  const s = Math.sin(half);
  return [(ax / alen) * s, (ay / alen) * s, 0, Math.cos(half)];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function samplePolyline(
  pts: Array<[number, number, number]>,
  steps: number,
): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  const n = pts.length - 1;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const f = t * n;
    const k = Math.min(n - 1, Math.floor(f));
    const u = f - k;
    const a = pts[k];
    const b = pts[k + 1];
    out.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]);
  }
  return out;
}

/**
 * Indoor tree (Ficus-like) matching the reference: white ovoid pot,
 * dark tapering curved trunk, dense small-leaf canopy almost to the ceiling.
 */
function addJadePlant(doc: PlanaDocument, parent: string): PlanaDocument {
  const rootId = "jade-plant";
  doc = add(doc, group(rootId, "Indoor Tree", 0.58 * MM, 5.32 * MM, 0), parent);

  const white = {
    face: { color: { r: 248, g: 248, b: 246, a: 1 }, opacity: 0.42, visible: true },
    edge: { color: { r: 220, g: 220, b: 218, a: 1 }, width: 0.8, opacity: 0.75, visible: true },
  };
  const soilStyle = {
    face: { color: { r: 28, g: 22, b: 16, a: 1 }, opacity: 0.55, visible: true },
    edge: { color: { r: 18, g: 14, b: 10, a: 1 }, width: 0.8, opacity: 0.7, visible: true },
  };
  const bark = {
    face: { color: { r: 42, g: 32, b: 26, a: 1 }, opacity: 0.5, visible: true },
    edge: { color: { r: 28, g: 20, b: 16, a: 1 }, width: 0.7, opacity: 0.55, visible: true },
  };
  const leafA = {
    face: { color: { r: 72, g: 108, b: 58, a: 1 }, opacity: 0.45, visible: true },
    edge: { color: { r: 48, g: 78, b: 38, a: 1 }, width: 0.45, opacity: 0.35, visible: true },
  };
  const leafB = {
    face: { color: { r: 92, g: 128, b: 70, a: 1 }, opacity: 0.4, visible: true },
    edge: { color: { r: 60, g: 92, b: 46, a: 1 }, width: 0.45, opacity: 0.3, visible: true },
  };

  // Egg pot ~40 cm, stacked discs
  const pot: Array<[number, number]> = [
    [18, 78], [40, 128], [80, 168], [130, 192], [190, 202],
    [250, 198], [310, 178], [355, 148], [385, 118],
  ];
  pot.forEach(([z, r], i) => {
    const h = i < pot.length - 1 ? pot[i + 1][0] - z : 22;
    doc = add(doc, {
      id: `tree-pot-${i}`, type: "plant",
      transform: t(0, 0, FLOOR_T + z),
      geometry: { type: "cylinder", radius: r, height: Math.max(12, h + 4), radialSegments: 24 },
      metadata: { name: i === 0 ? "Pot Base" : "Pot" }, style: white,
    }, rootId);
  });
  doc = add(doc, {
    id: "tree-soil", type: "plant", transform: t(0, 0, FLOOR_T + 368),
    geometry: { type: "cylinder", radius: 108, height: 18, radialSegments: 20 },
    metadata: { name: "Soil" }, style: soilStyle,
  }, rootId);

  const addSeg = (
    id: string,
    x: number, y: number, z: number,
    dx: number, dy: number, dz: number,
    radius: number,
  ) => {
    const len = Math.hypot(dx, dy, dz);
    if (len < 4) return;
    doc = add(doc, {
      id, type: "plant",
      transform: {
        ...identityTransform(),
        position: [x, y, FLOOR_T + z],
        rotation: quatAlignZ(dx, dy, dz),
      },
      geometry: { type: "cylinder", radius, height: len, radialSegments: 10 },
      metadata: { name: "Trunk" }, style: bark,
    }, rootId);
  };

  // Main trunk spline (mm above floor inside pot)
  const trunkPts: Array<[number, number, number]> = [
    [0, 0, 385],
    [8, 6, 520],
    [22, 18, 680],
    [48, 28, 860],
    [70, 12, 1040],
    [55, -18, 1220],
    [18, -28, 1400],
    [-30, -10, 1580],
    [-70, 25, 1760],
    [-40, 70, 1940],
    [10, 95, 2100],
  ];
  const trunk = samplePolyline(trunkPts, 18);
  for (let i = 0; i < trunk.length - 1; i++) {
    const a = trunk[i];
    const b = trunk[i + 1];
    const t = i / (trunk.length - 2);
    addSeg(`tree-trunk-${i}`, a[0], a[1], a[2], b[0] - a[0], b[1] - a[1], b[2] - a[2], lerp(26, 9, t));
  }

  // Lower side branch (as in the photo)
  const low: Array<[number, number, number]> = [
    [55, -18, 1220],
    [90, -40, 1280],
    [130, -55, 1380],
    [155, -40, 1500],
    [145, -15, 1620],
  ];
  const lowS = samplePolyline(low, 8);
  for (let i = 0; i < lowS.length - 1; i++) {
    const a = lowS[i];
    const b = lowS[i + 1];
    addSeg(`tree-low-${i}`, a[0], a[1], a[2], b[0] - a[0], b[1] - a[1], b[2] - a[2], lerp(11, 5, i / (lowS.length - 2)));
  }

  // Upper forks
  const forks: Array<Array<[number, number, number]>> = [
    [[10, 95, 2100], [-40, 140, 2220], [-90, 170, 2340], [-120, 150, 2440]],
    [[10, 95, 2100], [60, 80, 2240], [110, 40, 2360], [140, 10, 2460]],
    [[-40, 70, 1940], [-90, 40, 2060], [-130, 0, 2180], [-150, -30, 2280]],
    [[-70, 25, 1760], [-110, 80, 1880], [-90, 130, 2020]],
  ];
  forks.forEach((pts, fi) => {
    const s = samplePolyline(pts, 7);
    for (let i = 0; i < s.length - 1; i++) {
      const a = s[i];
      const b = s[i + 1];
      addSeg(`tree-fork-${fi}-${i}`, a[0], a[1], a[2], b[0] - a[0], b[1] - a[1], b[2] - a[2], lerp(8, 4, i / (s.length - 2)));
    }
  });

  const leafPath = (len: number, wid: number): Array<[number, number, number]> => {
    const n = 8;
    const pts: Array<[number, number, number]> = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const w = (wid / 2) * Math.sin(Math.PI * t);
      pts.push([w, 0, t * len]);
    }
    for (let i = n - 1; i >= 1; i--) {
      const t = i / n;
      const w = (wid / 2) * Math.sin(Math.PI * t);
      pts.push([-w, 0, t * len]);
    }
    return pts;
  };

  let leaf = 0;
  const sprinkle = (
    cx: number, cy: number, cz: number,
    rx: number, ry: number, rz: number,
    count: number,
  ) => {
    for (let i = 0; i < count; i++) {
      const u = (i * 0.618033) % 1;
      const v = (i * 0.414213) % 1;
      const w = (i * 0.73205) % 1;
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const r = 0.25 + 0.75 * w;
      const lx = cx + Math.sin(phi) * Math.cos(theta) * rx * r;
      const ly = cy + Math.sin(phi) * Math.sin(theta) * ry * r;
      const lz = FLOOR_T + cz + Math.cos(phi) * rz * r;
      const len = 16 + (i % 5) * 3;
      const wid = 8 + (i % 3) * 2;
      leaf += 1;
      doc = add(doc, {
        id: `tree-leaf-${leaf}`,
        type: "plant",
        transform: {
          ...identityTransform(),
          position: [lx, ly, lz],
          rotation: quatFromEulerDeg((i % 7) * 18 - 40, (i * 47) % 360, (i % 5) * 12 - 20),
        },
        geometry: {
          type: "extrusion",
          profile: { type: "polygon", outer: leafPath(len, wid), holes: [] },
          height: 1.6,
          direction: [0, 1, 0],
        },
        metadata: { name: `Leaf ${leaf}` },
        style: i % 3 === 0 ? leafB : leafA,
      }, rootId);
    }
  };

  sprinkle(-40, 90, 2280, 280, 260, 180, 70);
  sprinkle(80, 30, 2320, 220, 200, 150, 45);
  sprinkle(-120, -10, 2140, 160, 150, 110, 28);
  sprinkle(145, -20, 1580, 90, 80, 70, 18);

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
      openingCenter(1.385, 0.5, 0.8),
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
