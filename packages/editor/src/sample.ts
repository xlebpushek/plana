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
        position: [0.58 * MM, 5.32 * MM, 0],
        rotation: quatFromEulerDeg(0, 0, 225),
      },
      children: [],
      metadata: { name: "Indoor Tree" },
    },
    parent,
  );

  const white = {
    face: { color: { r: 250, g: 250, b: 248, a: 1 }, opacity: 0.5, visible: true },
    edge: { color: { r: 220, g: 220, b: 216, a: 1 }, width: 0.7, opacity: 0.55, visible: true },
  };
  const soilStyle = {
    face: { color: { r: 18, g: 14, b: 10, a: 1 }, opacity: 0.62, visible: true },
    edge: { color: { r: 10, g: 8, b: 6, a: 1 }, width: 0.5, opacity: 0.35, visible: true },
  };
  const bark = {
    face: { color: { r: 28, g: 20, b: 16, a: 1 }, opacity: 0.58, visible: true },
    edge: { color: { r: 16, g: 12, b: 10, a: 1 }, width: 0.6, opacity: 0.4, visible: true },
  };
  const leafStyles = [
    {
      face: { color: { r: 118, g: 148, b: 78, a: 1 }, opacity: 0.5, visible: true },
      edge: { color: { r: 70, g: 96, b: 48, a: 1 }, width: 0.35, opacity: 0.18, visible: true },
    },
    {
      face: { color: { r: 148, g: 168, b: 92, a: 1 }, opacity: 0.46, visible: true },
      edge: { color: { r: 90, g: 112, b: 58, a: 1 }, width: 0.35, opacity: 0.16, visible: true },
    },
    {
      face: { color: { r: 88, g: 118, b: 62, a: 1 }, opacity: 0.52, visible: true },
      edge: { color: { r: 52, g: 78, b: 38, a: 1 }, width: 0.35, opacity: 0.18, visible: true },
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
          [42, 6],
          [95, 28],
          [145, 72],
          [178, 130],
          [198, 195],
          [205, 255],
          [198, 315],
          [180, 360],
          [162, 388],
          [148, 402],
          [140, 396],
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
      transform: t(0, 0, z0 + 368),
      geometry: {
        type: "lathe",
        segments: 24,
        profile: [
          [0, 0],
          [118, 0],
          [122, 8],
          [110, 16],
          [0, 16],
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

  // Photo S-curve: left lean, then up-right, then into the umbrella.
  const trunk: Array<[number, number, number]> = [
    [0, 0, z0 + 372],
    [4, 10, z0 + 470],
    [-18, 18, z0 + 620],
    [-58, 12, z0 + 800],
    [-92, -4, z0 + 980],
    [-88, -18, z0 + 1160],
    [-48, -28, z0 + 1320],
    [8, -22, z0 + 1500],
    [42, -6, z0 + 1680],
    [18, 16, z0 + 1860],
    [-36, 28, z0 + 2040],
    [-22, 38, z0 + 2180],
  ];
  addTube("tree-trunk", "Trunk", trunk, [22, 20, 17, 15, 13, 12, 11, 10, 9, 8, 7, 6], 16);

  const low: Array<[number, number, number]> = [
    [-48, -28, z0 + 1320],
    [40, -48, z0 + 1380],
    [110, -42, z0 + 1480],
    [148, -18, z0 + 1600],
    [138, 8, z0 + 1705],
  ];
  addTube("tree-low", "Lower Branch", low, [8, 6.5, 5.5, 4.5, 3.5], 12);

  const canopyBranches: Array<Array<[number, number, number]>> = [
    [[-22, 38, z0 + 2180], [-180, 70, z0 + 2280], [-310, 40, z0 + 2360], [-380, -10, z0 + 2410]],
    [[-22, 38, z0 + 2180], [-120, 130, z0 + 2300], [-160, 210, z0 + 2400], [-140, 250, z0 + 2465]],
    [[-22, 38, z0 + 2180], [40, 120, z0 + 2320], [110, 180, z0 + 2420], [150, 200, z0 + 2480]],
    [[-22, 38, z0 + 2180], [130, 50, z0 + 2300], [250, 20, z0 + 2390], [330, -20, z0 + 2440]],
    [[-22, 38, z0 + 2180], [90, -70, z0 + 2280], [180, -140, z0 + 2360], [210, -190, z0 + 2410]],
    [[-22, 38, z0 + 2180], [-40, -90, z0 + 2270], [-90, -170, z0 + 2350], [-80, -230, z0 + 2415]],
    [[-22, 38, z0 + 2180], [-160, -50, z0 + 2260], [-260, -90, z0 + 2330], [-300, -130, z0 + 2380]],
    [[-36, 28, z0 + 2040], [-200, 20, z0 + 2140], [-280, -30, z0 + 2200], [-300, -70, z0 + 2240]],
    [[18, 16, z0 + 1860], [80, 90, z0 + 1980], [60, 150, z0 + 2100], [20, 170, z0 + 2180]],
    [[42, -6, z0 + 1680], [100, -80, z0 + 1800], [70, -130, z0 + 1920]],
    [[-22, 38, z0 + 2180], [-70, 40, z0 + 2320], [-90, 50, z0 + 2440], [-70, 40, z0 + 2495]],
    [[-22, 38, z0 + 2180], [20, -20, z0 + 2260], [80, -40, z0 + 2320], [140, -30, z0 + 2365]],
    [[-22, 38, z0 + 2180], [-80, 90, z0 + 2240], [-150, 80, z0 + 2280], [-210, 30, z0 + 2300]],
    [[-22, 38, z0 + 2180], [50, 80, z0 + 2230], [90, 40, z0 + 2260], [130, -10, z0 + 2280]],
  ];
  canopyBranches.forEach((pts, i) => {
    const r0 = 6.5 - Math.min(2.5, i * 0.18);
    addTube(`tree-branch-${i}`, `Branch ${i + 1}`, pts, [r0, r0 * 0.7, r0 * 0.45, 2.4], 10);
  });

  const twigs: Array<Array<[number, number, number]>> = [
    [[-310, 40, z0 + 2360], [-360, 90, z0 + 2390], [-390, 110, z0 + 2410]],
    [[-160, 210, z0 + 2400], [-200, 250, z0 + 2430], [-210, 270, z0 + 2450]],
    [[110, 180, z0 + 2420], [150, 220, z0 + 2450], [160, 235, z0 + 2470]],
    [[250, 20, z0 + 2390], [300, 50, z0 + 2420], [320, 70, z0 + 2435]],
    [[180, -140, z0 + 2360], [210, -180, z0 + 2385], [200, -210, z0 + 2400]],
    [[-90, -170, z0 + 2350], [-130, -210, z0 + 2375], [-140, -230, z0 + 2390]],
    [[-260, -90, z0 + 2330], [-300, -120, z0 + 2350], [-330, -140, z0 + 2365]],
    [[-380, -10, z0 + 2410], [-420, -40, z0 + 2390], [-450, -60, z0 + 2360]],
    [[150, 200, z0 + 2480], [170, 160, z0 + 2440], [165, 120, z0 + 2390]],
    [[-140, 250, z0 + 2465], [-100, 220, z0 + 2420], [-90, 180, z0 + 2370]],
  ];
  twigs.forEach((pts, i) => addTube(`tree-twig-${i}`, `Twig ${i + 1}`, pts, [3.2, 2.2, 1.6], 8));

  const rand = mulberry32(0xc0ffee);
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
          thickness: 0.55,
          cup: 0.28,
          segments: 6,
        },
        metadata: { name: `Leaf ${leaf}` },
        style: leafStyles[leaf % leafStyles.length],
      },
      rootId,
    );
  };

  const sprayOnBranch = (
    pts: Array<[number, number, number]>,
    count: number,
    t0: number,
    spread: number,
    len0: number,
    len1: number,
  ) => {
    for (let i = 0; i < count; i++) {
      const t = t0 + (1 - t0) * rand();
      const p = pointOnPolyline(pts, t);
      const tan = tangentOnPolyline(pts, t);
      const tl = Math.hypot(tan[0], tan[1], tan[2]) || 1;
      const ux = tan[0] / tl;
      const uy = tan[1] / tl;
      const uz = tan[2] / tl;
      const hx = Math.abs(uz) < 0.9 ? 0 : 1;
      const hy = Math.abs(uz) < 0.9 ? 0 : 0;
      const hz = Math.abs(uz) < 0.9 ? 1 : 0;
      let nx = uy * hz - uz * hy;
      let ny = uz * hx - ux * hz;
      let nz = ux * hy - uy * hx;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      const bx = uy * nz - uz * ny;
      const by = uz * nx - ux * nz;
      const bz = ux * ny - uy * nx;
      const ang = rand() * Math.PI * 2;
      const rad = spread * (0.15 + 0.85 * rand());
      const ox = nx * Math.cos(ang) * rad + bx * Math.sin(ang) * rad;
      const oy = ny * Math.cos(ang) * rad + by * Math.sin(ang) * rad;
      const oz = nz * Math.cos(ang) * rad + bz * Math.sin(ang) * rad;
      const dx = ox * 0.45 + ux;
      const dy = oy * 0.45 + uy;
      const dz = oz * 0.45 + uz * 0.35 + (rand() - 0.45) * 0.6;
      const length = len0 + rand() * (len1 - len0);
      addLeaf(p[0] + ox, p[1] + oy, p[2] + oz, dx, dy, dz, rand() * 360, rand() * 50 - 18, length, length * (0.38 + rand() * 0.12));
    }
  };

  canopyBranches.forEach((pts, i) => {
    const long = i < 8;
    sprayOnBranch(pts, long ? 42 : 26, 0.22, long ? 58 : 40, 16, 26);
  });
  twigs.forEach((pts) => sprayOnBranch(pts, 22, 0.02, 44, 15, 24));
  sprayOnBranch(low, 32, 0.5, 52, 15, 23);
  sprayOnBranch(trunk, 18, 0.8, 32, 14, 22);

  for (let i = 0; i < 90; i++) {
    const u = rand();
    const v = rand();
    const w = rand();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const r = 0.35 + 0.65 * w;
    const cx = -40 + Math.sin(phi) * Math.cos(theta) * 340 * r;
    const cy = 20 + Math.sin(phi) * Math.sin(theta) * 300 * r;
    const cz = z0 + 2320 + Math.cos(phi) * 220 * r;
    addLeaf(
      cx,
      cy,
      cz,
      cx + (rand() - 0.5) * 40,
      cy + (rand() - 0.5) * 40,
      40 + rand() * 80,
      rand() * 360,
      rand() * 40 - 12,
      16 + rand() * 10,
      7 + rand() * 5,
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
  doc = addShelving(doc, "living", 3.633, 3.821);
  doc = addJadePlant(doc, "living");

  return doc;
}
