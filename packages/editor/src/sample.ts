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
  multiplyQuat,
  quatFromEulerDeg,
  type ObjectStyle,
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
  style?: ObjectStyle,
  yawDeg = 0,
): PlanaObject => ({
  id,
  type,
  transform: {
    ...t(x, y, z),
    rotation: yawDeg ? quatFromEulerDeg(0, 0, yawDeg) : identityTransform().rotation,
  },
  geometry: { type: "box", size: [sx, sy, sz] },
  metadata: { name },
  style,
});

const cyl = (
  id: string,
  type: string,
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  name: string,
  style?: ObjectStyle,
  segments = 20,
): PlanaObject => ({
  id,
  type,
  transform: t(x, y, z),
  geometry: { type: "cylinder", radius, height, radialSegments: segments },
  metadata: { name },
  style,
});

const lathe = (
  id: string,
  type: string,
  x: number,
  y: number,
  z: number,
  profile: Array<[number, number]>,
  name: string,
  style?: ObjectStyle,
  segments = 24,
): PlanaObject => ({
  id,
  type,
  transform: t(x, y, z),
  geometry: { type: "lathe", profile, segments },
  metadata: { name },
  style,
});

const paint = (
  r: number,
  g: number,
  b: number,
  opacity = 0.97,
  edge = 0.28,
): ObjectStyle => ({
  face: { color: { r, g, b, a: 1 }, opacity, visible: true },
  edge: {
    color: { r: Math.max(0, r - 36), g: Math.max(0, g - 36), b: Math.max(0, b - 36), a: 1 },
    width: 0.65,
    opacity: edge,
    visible: true,
  },
});

const cream = paint(236, 232, 222);
const oak = paint(186, 142, 90);
const black = paint(18, 18, 20, 0.98, 0.22);
const charcoal = paint(32, 32, 36, 0.98, 0.2);
const duvet = paint(12, 12, 14, 0.98, 0.16);
const screen = paint(8, 10, 14, 0.99, 0.12);
const glass = {
  face: { color: { r: 186, g: 214, b: 230, a: 1 }, opacity: 0.28, visible: true },
  edge: { color: { r: 148, g: 180, b: 198, a: 1 }, width: 0.6, opacity: 0.45, visible: true },
} satisfies ObjectStyle;
const glassPad = {
  face: { color: { r: 210, g: 226, b: 236, a: 1 }, opacity: 0.34, visible: true },
  edge: { color: { r: 160, g: 188, b: 204, a: 1 }, width: 0.7, opacity: 0.55, visible: true },
} satisfies ObjectStyle;
const keycaps = paint(232, 232, 228, 0.97, 0.2);
const micBody = paint(28, 30, 36, 0.98, 0.2);
const fridgeWhite = paint(228, 230, 232, 0.98, 0.22);
const stoveWhite = paint(242, 242, 244, 0.97, 0.25);
const counter = paint(28, 28, 30, 0.98, 0.18);
const steel = paint(168, 172, 176, 0.97, 0.3);
const sinkSteel = paint(120, 124, 128, 0.96, 0.3);

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
 * - North strip: window on west kitchen, door on east corridor. Bathroom
 *   sits closer to the entry door so the kitchen bay by the window is wider.
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
  { id: "wall-bath-west", name: "Bath West Wall", along: "z", origin: 0, position: 2.64, length: 1.41 },
  { id: "wall-bath-east", name: "Bath East Wall", along: "z", origin: 0, position: 4.96, length: 1.41 },
  {
    id: "wall-bath-south",
    name: "Bath South Wall",
    along: "x",
    origin: 2.565,
    position: 1.335,
    length: 2.47,
    cutouts: [{ kind: "door", offset: flipOffset(2.47, 0.5, 0.8), width: 0.8, height: 2.04 }],
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

/** Bed tucked between the Kallax and the west window, against the partition. */
function addBed(doc: PlanaDocument, parent: string): PlanaDocument {
  const length = 2000;
  const width = 1600;
  const x0 = 230;
  const y0 = 2620;
  const cx = x0 + length / 2;
  const cy = y0 + width / 2;
  const z = FLOOR_T;
  doc = add(doc, group("bed", "Bed", cx, cy, 0), parent);

  const local = (
    id: string,
    type: string,
    x: number,
    y: number,
    zb: number,
    sx: number,
    sy: number,
    sz: number,
    name: string,
    style?: ObjectStyle,
  ) => {
    doc = add(doc, box(id, type, x - cx, y - cy, zb, sx, sy, sz, name, style), "bed");
  };

  local("bed-plinth", "bed", cx, cy, z, length, width, 300, "Bed Platform", cream);
  local("bed-drawer-w", "bed", cx - 430, y0 + width - 18, z + 40, 820, 36, 220, "West Drawer", cream);
  local("bed-drawer-e", "bed", cx + 430, y0 + width - 18, z + 40, 820, 36, 220, "East Drawer", cream);
  local("bed-mattress", "bed", cx, cy, z + 300, 1980, 1580, 160, "Mattress", charcoal);
  local("bed-sheet", "bed", cx + 40, cy + 20, z + 455, 1880, 1500, 18, "Sheet", duvet);
  local("bed-duvet", "bed", cx + 120, cy + 40, z + 470, 1640, 1320, 90, "Duvet", duvet);
  local("bed-pillow-a", "bed", x0 + 180, cy - 280, z + 460, 280, 520, 130, "Pillow", duvet);
  local("bed-pillow-b", "bed", x0 + 180, cy + 280, z + 460, 280, 520, 130, "Pillow", duvet);
  return doc;
}

/** IKEA BESTÅ against the south wall, facing the bed, plasma on top. */
function addTvStand(doc: PlanaDocument, parent: string): PlanaDocument {
  const w = 1800;
  const d = 410;
  const h = 480;
  const x0 = 520;
  const y1 = 5785;
  const cx = x0 + w / 2;
  const cy = y1 - d / 2;
  const z = FLOOR_T;
  doc = add(doc, group("tv-stand", "TV Stand", cx, cy, 0), parent);

  const local = (
    id: string,
    type: string,
    x: number,
    y: number,
    zb: number,
    sx: number,
    sy: number,
    sz: number,
    name: string,
    style?: ObjectStyle,
  ) => {
    doc = add(doc, box(id, type, x - cx, y - cy, zb, sx, sy, sz, name, style), "tv-stand");
  };

  for (const [i, lx, ly] of [
    [0, x0 + 50, y1 - d + 50],
    [1, x0 + w - 50, y1 - d + 50],
    [2, x0 + 50, y1 - 50],
    [3, x0 + w - 50, y1 - 50],
  ] as Array<[number, number, number]>) {
    doc = add(
      doc,
      cyl(`tv-leg-${i}`, "cabinet", lx - cx, ly - cy, z, 18, 40, `TV Leg ${i + 1}`, cream),
      "tv-stand",
    );
  }

  local("tv-body", "cabinet", cx, cy, z + 40, w, d, h - 40, "BESTA Body", cream);
  local("tv-top", "cabinet", cx, cy, z + h - 24, w + 8, d + 8, 24, "BESTA Top", cream);
  local("tv-drawer-w", "cabinet", cx - 430, y1 - 20, z + 70, 820, 22, 340, "West Drawer Front", cream);
  local("tv-drawer-e", "cabinet", cx + 430, y1 - 20, z + 70, 820, 22, 340, "East Drawer Front", cream);
  local("tv-knob-w", "decor", cx - 430, y1 - 8, z + 230, 18, 12, 18, "West Knob", cream);
  local("tv-knob-e", "decor", cx + 430, y1 - 8, z + 230, 18, 12, 18, "East Knob", cream);

  const tvW = 980;
  const tvD = 70;
  const tvH = 560;
  local("tv-plasma", "appliance", cx, cy - 20, z + h + 70, tvW, tvD, tvH, "Plasma TV", black);
  local("tv-screen", "appliance", cx, cy - 20 - tvD / 2 + 4, z + h + 90, tvW - 40, 6, tvH - 50, "TV Screen", screen);
  local("tv-neck", "appliance", cx, cy + 10, z + h, 80, 70, 70, "TV Neck", black);
  local("tv-base", "appliance", cx, cy + 20, z + h, 280, 180, 18, "TV Base", black);
  return doc;
}

/** Desk east of the Kallax, against the partition, with the PC kit from the photos. */
function addDesk(doc: PlanaDocument, parent: string): PlanaDocument {
  const w = 1200;
  const d = 600;
  const top = 30;
  const deskH = 750;
  const x0 = 2860;
  const y0 = 2620;
  const cx = x0 + w / 2;
  const cy = y0 + d / 2;
  const z = FLOOR_T;
  const topZ = z + deskH - top;
  doc = add(doc, group("desk", "Desk", cx, cy, 0), parent);

  const local = (
    id: string,
    type: string,
    x: number,
    y: number,
    zb: number,
    sx: number,
    sy: number,
    sz: number,
    name: string,
    style?: ObjectStyle,
    yaw = 0,
  ) => {
    doc = add(doc, box(id, type, x - cx, y - cy, zb, sx, sy, sz, name, style, yaw), "desk");
  };

  local("desk-top", "desk", cx, cy, topZ, w, d, top, "Desk Top", oak);
  for (const [i, lx, ly] of [
    [0, x0 + 40, y0 + 40],
    [1, x0 + w - 40, y0 + 40],
    [2, x0 + 40, y0 + d - 40],
    [3, x0 + w - 40, y0 + d - 40],
  ] as Array<[number, number, number]>) {
    local(`desk-leg-${i}`, "desk", lx, ly, z, 30, 30, deskH - top, `Desk Leg ${i + 1}`, black);
  }

  const surface = z + deskH;
  local("desk-monitor-stand", "appliance", cx - 40, y0 + 90, surface, 220, 160, 14, "Monitor Base", black);
  doc = add(
    doc,
    cyl("desk-monitor-neck", "appliance", -40, 90 - d / 2, surface + 14, 16, 110, "Monitor Neck", black, 16),
    "desk",
  );
  local("desk-monitor", "appliance", cx - 40, y0 + 70, surface + 120, 620, 40, 360, "Monitor", black);
  local("desk-monitor-screen", "appliance", cx - 40, y0 + 70 + 18, surface + 140, 580, 6, 320, "Monitor Screen", screen);

  local("desk-keyboard", "appliance", cx - 20, y0 + 340, surface, 360, 130, 18, "Keyboard", keycaps);
  local("desk-pad", "appliance", cx + 280, y0 + 360, surface, 420, 360, 6, "Glass Mousepad", glassPad);
  local("desk-mouse", "appliance", cx + 300, y0 + 330, surface + 6, 64, 110, 38, "Mouse", black);

  doc = add(
    doc,
    cyl("mic-base", "appliance", -420, 80, surface, 38, 8, "Mic Base", black, 20),
    "desk",
  );
  doc = add(
    doc,
    cyl("mic-stem", "appliance", -420, 80, surface + 8, 7, 150, "Mic Stem", black, 12),
    "desk",
  );
  local("mic-body", "appliance", cx - 420, y0 + d / 2 + 80, surface + 150, 58, 58, 118, "Fifine AM8", micBody, 18);
  local("mic-window", "appliance", cx - 420, y0 + d / 2 + 80 + 22, surface + 168, 36, 8, 78, "Mic Mesh", charcoal);

  const pcX = x0 + w + 160;
  const pcY = y0 + 280;
  const pcW = 220;
  const pcD = 450;
  const pcH = 450;
  local("pc-case", "appliance", pcX, pcY, z, pcW, pcD, pcH, "PC Case", black);
  local("pc-glass", "window", pcX, pcY + pcD / 2 - 3, z + 30, pcW - 40, 6, pcH - 70, "PC Glass Panel", glass);
  local("pc-feet-a", "appliance", pcX - 80, pcY - 160, z, 28, 28, 12, "PC Foot A", charcoal);
  local("pc-feet-b", "appliance", pcX + 80, pcY - 160, z, 28, 28, 12, "PC Foot B", charcoal);
  local("pc-feet-c", "appliance", pcX - 80, pcY + 160, z, 28, 28, 12, "PC Foot C", charcoal);
  local("pc-feet-d", "appliance", pcX + 80, pcY + 160, z, 28, 28, 12, "PC Foot D", charcoal);
  return doc;
}

function addFoldingChair(
  doc: PlanaDocument,
  parent: string,
  id: string,
  name: string,
  x: number,
  y: number,
  yawDeg: number,
): PlanaDocument {
  doc = add(
    doc,
    {
      id,
      type: "group",
      transform: {
        ...t(x, y, 0),
        rotation: quatFromEulerDeg(0, 0, yawDeg),
      },
      children: [],
      metadata: { name },
    },
    parent,
  );
  const z = FLOOR_T;
  const white = stoveWhite;
  doc = add(doc, box(`${id}-seat`, "chair", 0, 0, z + 430, 360, 340, 18, "Seat", white), id);
  doc = add(doc, box(`${id}-back`, "chair", 0, 155, z + 448, 360, 16, 390, "Back", white), id);
  for (let i = 0; i < 4; i += 1) {
    doc = add(
      doc,
      box(`${id}-slat-${i}`, "chair", 0, 148, z + 500 + i * 70, 330, 8, 28, `Back Slat ${i + 1}`, white),
      id,
    );
  }
  doc = add(doc, box(`${id}-leg-fl`, "chair", -150, -140, z, 22, 22, 430, "Leg FL", white), id);
  doc = add(doc, box(`${id}-leg-fr`, "chair", 150, -140, z, 22, 22, 430, "Leg FR", white), id);
  doc = add(doc, box(`${id}-leg-bl`, "chair", -150, 150, z, 22, 22, 448, "Leg BL", white), id);
  doc = add(doc, box(`${id}-leg-br`, "chair", 150, 150, z, 22, 22, 448, "Leg BR", white), id);
  doc = add(doc, box(`${id}-brace`, "chair", 0, 10, z + 180, 18, 280, 18, "Brace", white, 12), id);
  return doc;
}

/** Kitchen along the west window bay: cabinets on the partition, table on the north wall. */
function addKitchen(doc: PlanaDocument, parent: string): PlanaDocument {
  const z = FLOOR_T;
  const south = 2455;
  const east = 2565;
  const runY = south - 300;
  const fridgeW = 600;
  const fridgeD = 600;
  const fridgeH = 1780;
  const cabW = 1200;
  const cabD = 600;
  const stoveW = 500;
  const fridgeX = east - fridgeW / 2;
  const cabX = fridgeX - fridgeW / 2 - cabW / 2;
  const stoveX = cabX - cabW / 2 - stoveW / 2;

  doc = add(doc, group("kitchen-run", "Kitchen Cabinets", cabX, runY, 0), parent);

  const put = (
    id: string,
    type: string,
    x: number,
    y: number,
    zb: number,
    sx: number,
    sy: number,
    sz: number,
    name: string,
    style?: ObjectStyle,
    yaw = 0,
  ) => {
    doc = add(doc, box(id, type, x - cabX, y - runY, zb, sx, sy, sz, name, style, yaw), "kitchen-run");
  };

  put("fridge-body", "appliance", fridgeX, runY, z, fridgeW, fridgeD, fridgeH, "Fridge", fridgeWhite);
  put("fridge-door-top", "appliance", fridgeX, runY - fridgeD / 2 + 10, z + 620, fridgeW - 30, 18, 1120, "Fridge Door", fridgeWhite);
  put("fridge-door-bot", "appliance", fridgeX, runY - fridgeD / 2 + 10, z + 40, fridgeW - 30, 18, 540, "Freezer Door", fridgeWhite);
  put("fridge-handle-t", "appliance", fridgeX + 220, runY - fridgeD / 2 - 4, z + 1480, 18, 12, 90, "Fridge Handle", steel);
  put("fridge-handle-b", "appliance", fridgeX, runY - fridgeD / 2 - 4, z + 280, 18, 12, 18, "Freezer Knob", steel);

  put("cab-base", "cabinet", cabX, runY, z, cabW, cabD, 820, "Base Cabinets", cream);
  put("cab-door-l", "cabinet", cabX - 290, runY - cabD / 2 + 10, z + 50, 540, 16, 720, "Left Base Door", cream);
  put("cab-door-r", "cabinet", cabX + 290, runY - cabD / 2 + 10, z + 50, 540, 16, 720, "Right Base Door", cream);
  put("cab-handle-l", "appliance", cabX - 80, runY - cabD / 2 - 4, z + 430, 12, 10, 110, "Left Handle", black);
  put("cab-handle-r", "appliance", cabX + 80, runY - cabD / 2 - 4, z + 430, 12, 10, 110, "Right Handle", black);
  put("cab-top", "cabinet", cabX, runY + 8, z + 820, cabW + 20, cabD + 20, 36, "Countertop", counter);

  put("cab-upper", "cabinet", cabX, south - 150, z + 1480, cabW, 300, 720, "Wall Cabinets", cream);
  put("cab-u-l", "cabinet", cabX - 390, south - 150 - 150 + 8, z + 1510, 380, 16, 660, "Wall Door L", cream);
  put("cab-u-c", "cabinet", cabX, south - 150 - 150 + 8, z + 1510, 380, 16, 660, "Wall Door C", cream);
  put("cab-u-r", "cabinet", cabX + 390, south - 150 - 150 + 8, z + 1510, 380, 16, 660, "Wall Door R", cream);
  put("cab-u-k-l", "appliance", cabX - 390, south - 292, z + 1580, 14, 10, 14, "Knob L", black);
  put("cab-u-k-c", "appliance", cabX, south - 292, z + 1580, 14, 10, 14, "Knob C", black);
  put("cab-u-k-r", "appliance", cabX + 390, south - 292, z + 1580, 14, 10, 14, "Knob R", black);
  put("cab-rail", "decor", cabX, south - 310, z + 1360, 900, 12, 12, "Rail", black);

  put("stove-body", "appliance", stoveX, runY, z, stoveW, 600, 850, "Stove", stoveWhite);
  put("stove-top", "appliance", stoveX, runY, z + 850, stoveW, 600, 24, "Cooktop", charcoal);
  put("stove-oven", "appliance", stoveX, runY - 300 + 12, z + 80, 420, 16, 520, "Oven Door", stoveWhite);
  put("stove-glass", "appliance", stoveX, runY - 300 + 4, z + 160, 340, 8, 340, "Oven Window", screen);
  for (const [i, ox] of [-90, -30, 30, 90].entries()) {
    doc = add(
      doc,
      cyl(`stove-knob-${i}`, "appliance", stoveX - cabX + ox, runY - 300 + 20 - runY, z + 790, 14, 16, `Stove Knob ${i + 1}`, stoveWhite),
      "kitchen-run",
    );
  }
  for (const [i, ox, oy] of [
    [0, -90, -90],
    [1, 90, -90],
    [2, -90, 90],
    [3, 90, 90],
  ] as Array<[number, number, number]>) {
    doc = add(
      doc,
      cyl(`burner-${i}`, "appliance", stoveX - cabX + ox, oy, z + 874, 55, 6, `Burner ${i + 1}`, steel, 20),
      "kitchen-run",
    );
  }

  doc = add(
    doc,
    lathe(
      "sink-bowl",
      "appliance",
      cabX - cabX,
      runY - 40 - runY,
      z + 780,
      [
        [0, 0],
        [90, 0],
        [105, 8],
        [110, 30],
        [108, 90],
        [100, 140],
        [0, 140],
      ],
      "Sink",
      sinkSteel,
      28,
    ),
    "kitchen-run",
  );
  doc = add(doc, cyl("faucet-base", "appliance", 0, 80, z + 856, 22, 10, "Faucet Base", steel, 16), "kitchen-run");
  doc = add(doc, cyl("faucet-stem", "appliance", 0, 80, z + 866, 10, 180, "Faucet Stem", steel, 12), "kitchen-run");
  put("faucet-spout", "appliance", cabX, runY - 40, z + 1036, 16, 120, 16, "Faucet Spout", steel);

  doc = add(doc, box("mw", "appliance", 330, 950, z + 800, 320, 440, 260, "Microwave", cream), parent);
  doc = add(doc, box("mw-window", "appliance", 482, 950, z + 830, 8, 360, 180, "Microwave Window", screen), parent);
  doc = add(doc, box("radiator", "appliance", 195, 950, z + 90, 90, 1100, 420, "Radiator", stoveWhite), parent);
  for (let i = 0; i < 7; i += 1) {
    doc = add(
      doc,
      box(`rad-fin-${i}`, "appliance", 210, 950 - 450 + i * 150, z + 110, 70, 24, 380, `Radiator Fin ${i + 1}`, stoveWhite),
      parent,
    );
  }

  const tableX = 1080;
  const tableY = 530;
  doc = add(doc, group("kitchen-table", "Kitchen Table", tableX, tableY, 0), parent);
  doc = add(doc, box("table-top", "table", 0, 0, z + 720, 750, 750, 32, "Table Top", stoveWhite), "kitchen-table");
  for (const [i, lx, ly] of [
    [0, -330, -330],
    [1, 330, -330],
    [2, -330, 330],
    [3, 330, 330],
  ] as Array<[number, number, number]>) {
    doc = add(doc, box(`table-leg-${i}`, "table", lx, ly, z, 45, 45, 720, `Table Leg ${i + 1}`, stoveWhite), "kitchen-table");
  }

  doc = addFoldingChair(doc, parent, "chair-south", "Folding Chair", tableX, tableY + 560, 0);
  doc = addFoldingChair(doc, parent, "chair-east", "Folding Chair 2", tableX + 560, tableY + 40, -90);
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

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp3(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function pointOnPolyline(pts: Array<[number, number, number]>, t: number): [number, number, number] {
  const clamped = Math.min(1, Math.max(0, t));
  const f = clamped * (pts.length - 1);
  const k = Math.min(pts.length - 2, Math.floor(f));
  return lerp3(pts[k], pts[k + 1], f - k);
}

function tangentOnPolyline(pts: Array<[number, number, number]>, t: number): [number, number, number] {
  const clamped = Math.min(0.999, Math.max(0, t));
  const f = clamped * (pts.length - 1);
  const k = Math.min(pts.length - 2, Math.floor(f));
  const a = pts[k];
  const b = pts[k + 1];
  return [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
}

/**
 * Indoor tree matching the photo: one lathed egg pot, one tapered spline trunk,
 * one tube per branch, one smooth leaf mesh per leaflet.
 */
function addJadePlant(doc: PlanaDocument, parent: string): PlanaDocument {
  const rootId = "jade-plant";
  doc = add(
    doc,
    {
      id: rootId,
      type: "group",
      transform: {
        ...identityTransform(),
        position: [5.15 * MM, 5.08 * MM, 0],
        rotation: quatFromEulerDeg(0, 0, 200),
      },
      children: [],
      metadata: { name: "Indoor Tree" },
    },
    parent,
  );

  const white = {
    face: { color: { r: 252, g: 252, b: 250, a: 1 }, opacity: 0.97, visible: true },
    edge: { color: { r: 206, g: 206, b: 202, a: 1 }, width: 0.6, opacity: 0.25, visible: true },
  };
  const soilStyle = {
    face: { color: { r: 22, g: 18, b: 14, a: 1 }, opacity: 0.98, visible: true },
    edge: { color: { r: 10, g: 8, b: 6, a: 1 }, width: 0.5, opacity: 0.2, visible: true },
  };
  const bark = {
    face: { color: { r: 34, g: 25, b: 20, a: 1 }, opacity: 0.98, visible: true },
    edge: { color: { r: 16, g: 12, b: 10, a: 1 }, width: 0.5, opacity: 0.12, visible: false },
  };
  const leafStyles = [
    {
      face: { color: { r: 122, g: 152, b: 80, a: 1 }, opacity: 0.96, visible: true },
      edge: { color: { r: 70, g: 96, b: 48, a: 1 }, width: 0.3, opacity: 0.1, visible: false },
    },
    {
      face: { color: { r: 158, g: 180, b: 100, a: 1 }, opacity: 0.96, visible: true },
      edge: { color: { r: 90, g: 112, b: 58, a: 1 }, width: 0.3, opacity: 0.1, visible: false },
    },
    {
      face: { color: { r: 92, g: 124, b: 64, a: 1 }, opacity: 0.96, visible: true },
      edge: { color: { r: 52, g: 78, b: 38, a: 1 }, width: 0.3, opacity: 0.1, visible: false },
    },
  ];

  const z0 = FLOOR_T;

  doc = add(
    doc,
    {
      id: "tree-pot",
      type: "plant",
      transform: t(0, 0, z0),
      geometry: {
        type: "lathe",
        segments: 48,
        profile: [
          [0, 0],
          [64, 4],
          [112, 26],
          [158, 70],
          [196, 130],
          [220, 200],
          [228, 262],
          [220, 322],
          [202, 375],
          [184, 412],
          [172, 430],
          [163, 424],
        ],
      },
      metadata: { name: "Pot" },
      style: white,
    },
    rootId,
  );

  doc = add(
    doc,
    {
      id: "tree-soil",
      type: "plant",
      transform: t(0, 0, z0 + 392),
      geometry: {
        type: "lathe",
        segments: 28,
        profile: [
          [0, 24],
          [70, 20],
          [120, 12],
          [152, 4],
          [162, 0],
          [0, 0],
        ],
      },
      metadata: { name: "Soil" },
      style: soilStyle,
    },
    rootId,
  );

  const addTube = (
    id: string,
    name: string,
    points: Array<[number, number, number]>,
    radius: number | number[],
    radial = 14,
  ) => {
    doc = add(
      doc,
      {
        id,
        type: "plant",
        transform: identityTransform(),
        geometry: {
          type: "tube",
          points,
          radius,
          radialSegments: radial,
          tubularSegments: Math.max(20, (points.length - 1) * 10),
          capped: true,
        },
        metadata: { name },
        style: bark,
      },
      rootId,
    );
  };

  const rand = mulberry32(0x5eed);
  const rnd = (a: number, b: number) => a + (b - a) * rand();
  const zf = (v: number) => z0 + v;
  type P3 = [number, number, number];

  // Photo: dark S-trunk, a small leafy tuft low on the right, wide flat crown.
  const trunk: P3[] = [
    [0, 0, zf(380)],
    [26, 14, zf(520)],
    [6, -10, zf(700)],
    [-48, -24, zf(880)],
    [-46, -6, zf(1060)],
    [-2, 20, zf(1250)],
    [46, 16, zf(1410)],
    [34, -14, zf(1540)],
  ];
  addTube("tree-trunk", "Trunk", trunk, [34, 30, 27, 24, 21, 18, 16, 14], 18);

  const leftLimb: P3[] = [
    [-47, -16, zf(1010)],
    [-175, 28, zf(1120)],
    [-305, 58, zf(1255)],
    [-400, 38, zf(1420)],
    [-436, -12, zf(1570)],
  ];
  addTube("tree-left-limb", "Left Limb", leftLimb, [17, 14, 12, 10, 8.5], 14);

  const tuft: P3[] = [
    [10, 10, zf(1190)],
    [120, -40, zf(1205)],
    [216, -62, zf(1245)],
    [286, -44, zf(1292)],
  ];
  addTube("tree-tuft", "Lower Branch", tuft, [9, 6.5, 5, 3.6], 10);

  // Flat umbrella: highest in the middle, drooping toward the rim.
  const crownZ = (r: number) => 2390 - 0.00042 * r * r;

  const sprays: Array<{ path: P3[]; count: number; spread: number; size: number }> = [];
  let branchSeq = 0;

  const grow = (origin: P3, angle: number, reach: number, radius: number, depth: number) => {
    branchSeq += 1;
    const id = branchSeq;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const tipX = origin[0] + dx * reach;
    const tipY = origin[1] + dy * reach;
    const tip: P3 = [tipX, tipY, zf(crownZ(Math.hypot(tipX, tipY))) - rnd(0, 70)];
    const mid: P3 = [
      origin[0] + dx * reach * 0.5 + rnd(-35, 35),
      origin[1] + dy * reach * 0.5 + rnd(-35, 35),
      (origin[2] + tip[2]) / 2 + rnd(20, 80),
    ];
    const path: P3[] = [origin, mid, tip];
    addTube(
      `tree-branch-${id}`,
      depth === 0 ? `Limb ${id}` : `Branch ${id}`,
      path,
      [radius, radius * 0.62, radius * 0.4],
      depth === 0 ? 12 : 8,
    );

    if (depth >= 2) {
      sprays.push({ path, count: 48, spread: 52, size: 15 });
      return;
    }
    if (depth > 0) sprays.push({ path, count: 32, spread: 46, size: 16 });
    else sprays.push({ path, count: 16, spread: 38, size: 16 });
    const kids = depth === 0 ? 3 : 2;
    for (let i = 0; i < kids; i += 1) {
      grow(tip, angle + rnd(-0.9, 0.9), reach * rnd(0.45, 0.72), radius * 0.56, depth + 1);
    }
  };

  const fork = trunk[trunk.length - 1];
  for (let i = 0; i < 7; i += 1) {
    grow(fork, (i / 7) * Math.PI * 2 + rnd(-0.2, 0.2), rnd(270, 410), 11.5, 0);
  }
  const leftTop = leftLimb[leftLimb.length - 1];
  for (let i = 0; i < 4; i += 1) {
    grow(leftTop, Math.PI + (i - 1.5) * 0.6 + rnd(-0.18, 0.18), rnd(230, 340), 8.5, 0);
  }

  let leaf = 0;
  const addLeaf = (
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
    spin: number,
    tilt: number,
    length: number,
    width: number,
  ) => {
    leaf += 1;
    doc = add(
      doc,
      {
        id: `tree-leaf-${leaf}`,
        type: "plant",
        transform: {
          ...identityTransform(),
          position: [x, y, z],
          rotation: multiplyQuat(quatAlignZ(dx, dy, dz), quatFromEulerDeg(tilt, 0, spin)),
        },
        geometry: {
          type: "leaf",
          length,
          width,
          thickness: 0.5,
          cup: 0.22,
          segments: 4,
        },
        metadata: { name: `Leaf ${leaf}` },
        style: leafStyles[leaf % leafStyles.length],
      },
      rootId,
    );
  };

  /** Leaflets scattered around the outer part of a branch, blades near-flat. */
  const spray = (path: P3[], count: number, spread: number, size: number, t0 = 0.12) => {
    for (let i = 0; i < count; i += 1) {
      const t = t0 + (1 - t0) * rand();
      const p = pointOnPolyline(path, t);
      const tan = tangentOnPolyline(path, t);
      const tl = Math.hypot(tan[0], tan[1], tan[2]) || 1;
      const ux = tan[0] / tl;
      const uy = tan[1] / tl;
      const uz = tan[2] / tl;
      const ang = rand() * Math.PI * 2;
      const rad = spread * (0.2 + 0.8 * rand());
      const ox = Math.cos(ang) * rad;
      const oy = Math.sin(ang) * rad;
      const oz = rnd(-0.35, 0.25) * spread;
      const len = size + rnd(0, 10);
      addLeaf(
        p[0] + ox,
        p[1] + oy,
        p[2] + oz,
        ux * 0.5 + ox,
        uy * 0.5 + oy,
        uz * 0.3 + rnd(-0.25, 0.4) * spread,
        90 + rnd(-45, 45),
        rnd(-18, 18),
        len,
        len * rnd(0.38, 0.5),
      );
    }
  };

  for (const s of sprays) spray(s.path, s.count, s.spread, s.size);
  spray(tuft, 370, 58, 15, 0.12);
  spray(trunk, 80, 32, 14, 0.72);

  // Dense crown: outer silhouette + inner volume so it reads lush from every angle.
  for (let i = 0; i < 1440; i += 1) {
    const r = 80 + Math.sqrt(rand()) * 760;
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    const len = 14 + rnd(0, 10);
    addLeaf(
      x,
      y,
      zf(crownZ(r)) - rnd(0, 220),
      Math.cos(a) * rnd(0.35, 1.2),
      Math.sin(a) * rnd(0.35, 1.2),
      rnd(-0.4, 0.55),
      90 + rnd(-55, 55),
      rnd(-22, 22),
      len,
      len * rnd(0.36, 0.5),
    );
  }
  for (let i = 0; i < 720; i += 1) {
    const r = Math.sqrt(rand()) * 420;
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    const len = 13 + rnd(0, 8);
    addLeaf(
      x,
      y,
      zf(crownZ(r) - 80) - rnd(0, 280),
      rnd(-1, 1),
      rnd(-1, 1),
      rnd(-0.5, 0.7),
      90 + rnd(-60, 60),
      rnd(-24, 24),
      len,
      len * rnd(0.36, 0.5),
    );
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

  // West kitchen window — near the north wall.
  doc = add(
    doc,
    openingBox(
      "window-kitchen-west",
      "window",
      "Kitchen Window",
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

  // East corridor entry door — nearer the partition.
  doc = add(
    doc,
    openingBox(
      "door-corridor-east",
      "door",
      "Entry Door",
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
      openingCenter(2.565, flipOffset(2.47, 0.5, 0.8), 0.8),
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
      [2.565, 1.41],
      [5.035, 1.41],
      [5.035, 0.15],
      [6.27, 0.15],
      [6.27, 2.455],
      [2.565, 2.455],
    ]),
    "corridor",
  );

  doc = add(doc, group("bathroom", "Bathroom"), "apartment");
  doc = add(
    doc,
    floorPolygon("floor-bath", "Bath Floor", [
      [2.715, 0.15],
      [4.885, 0.15],
      [4.885, 1.26],
      [2.715, 1.26],
    ]),
    "bathroom",
  );

  doc = add(doc, group("kitchen", "Kitchen"), "apartment");
  doc = add(
    doc,
    floorPolygon("floor-kitchen", "Kitchen Floor", [
      [0.15, 0.15],
      [2.565, 0.15],
      [2.565, 2.455],
      [0.15, 2.455],
    ]),
    "kitchen",
  );
  doc = addKitchen(doc, "kitchen");

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
  doc = addShelving(doc, "living", 2.395, 2.605);
  doc = addBed(doc, "living");
  doc = addTvStand(doc, "living");
  doc = addDesk(doc, "living");
  doc = addJadePlant(doc, "living");

  return doc;
}
