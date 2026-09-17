import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "apps/demo/apartment.json");
const doc = JSON.parse(readFileSync(path, "utf8"));
const objects = doc.objects;

const ident = { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };

function box(id, parent, type, name, position, size, style) {
  const obj = {
    id,
    type,
    transform: { position, rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
    geometry: { type: "box", size },
    metadata: { name },
    parent,
  };
  if (style) obj.style = style;
  objects[id] = obj;
  const p = objects[parent];
  p.children = p.children ?? [];
  if (!p.children.includes(id)) p.children.push(id);
  return obj;
}

function tube(id, parent, type, name, points, radius, extra = {}) {
  objects[id] = {
    id,
    type,
    transform: { ...ident },
    geometry: {
      type: "tube",
      points,
      radius,
      radialSegments: extra.radialSegments ?? 8,
      tubularSegments: extra.tubularSegments ?? 20,
      capped: true,
    },
    metadata: { name },
    parent,
    ...(extra.style ? { style: extra.style } : {}),
  };
  const p = objects[parent];
  p.children = p.children ?? [];
  if (!p.children.includes(id)) p.children.push(id);
}

function leaf(id, parent, position, rotation, geo, style) {
  objects[id] = {
    id,
    type: "plant",
    transform: { position, rotation, scale: [1, 1, 1] },
    geometry: { type: "leaf", ...geo },
    metadata: { name: id },
    style,
    parent,
  };
  const p = objects[parent];
  p.children = p.children ?? [];
  if (!p.children.includes(id)) p.children.push(id);
}

function removeTree(id) {
  const obj = objects[id];
  if (!obj) return;
  for (const child of [...(obj.children ?? [])]) removeTree(child);
  if (obj.parent && objects[obj.parent]) {
    objects[obj.parent].children = objects[obj.parent].children.filter((c) => c !== id);
  }
  delete objects[id];
}

function mulberry(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quatFromMatrix(m00, m01, m02, m10, m11, m12, m20, m21, m22) {
  const tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    w = 0.25 * s;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  const n = Math.hypot(x, y, z, w) || 1;
  return [x / n, y / n, z / n, w / n];
}

function lookQuat(dir, upHint = [0, 0, 1]) {
  const z = norm(dir);
  let up = upHint;
  if (Math.abs(dot(z, up)) > 0.92) up = [0, 1, 0];
  let x = norm(cross(up, z));
  if (len(x) < 1e-6) x = norm(cross([1, 0, 0], z));
  const y = norm(cross(z, x));
  return quatFromMatrix(x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]);
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function mul(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function len(a) {
  return Math.hypot(a[0], a[1], a[2]);
}
function norm(a) {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

const pvc = {
  face: { color: { r: 248, g: 248, b: 252, a: 1 }, opacity: 0.16, visible: true },
  edge: { color: { r: 232, g: 232, b: 238, a: 1 }, width: 1.15, opacity: 1, visible: true },
};
const glassPane = {
  face: { color: { r: 168, g: 214, b: 236, a: 1 }, opacity: 0.1, visible: true },
  edge: { color: { r: 125, g: 211, b: 252, a: 1 }, width: 1, opacity: 0.85, visible: true },
};
const handleStyle = {
  face: { color: { r: 214, g: 214, b: 220, a: 1 }, opacity: 0.18, visible: true },
  edge: { color: { r: 228, g: 228, b: 234, a: 1 }, width: 1, opacity: 0.95, visible: true },
};
const sillStyle = {
  face: { color: { r: 244, g: 244, b: 248, a: 1 }, opacity: 0.14, visible: true },
  edge: { color: { r: 228, g: 228, b: 236, a: 1 }, width: 1.15, opacity: 1, visible: true },
};
const creamDoor = {
  face: { color: { r: 236, g: 220, b: 186, a: 1 }, opacity: 0.045, visible: true },
  edge: { color: { r: 244, g: 230, b: 198, a: 1 }, width: 1.1, opacity: 0.92, visible: true },
};
const blackTop = {
  face: { color: { r: 36, g: 36, b: 40, a: 1 }, opacity: 0.08, visible: true },
  edge: { color: { r: 82, g: 82, b: 90, a: 1 }, width: 1.15, opacity: 0.95, visible: true },
};

function makePvcWindow({
  id,
  name,
  openingW,
  openingH,
  groupPos,
}) {
  if (objects[id] && objects[id].geometry) {
    const parent = objects[id].parent;
    delete objects[id];
    objects[id] = {
      id,
      type: "group",
      transform: { position: groupPos, rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
      children: [],
      metadata: { name },
      parent,
    };
  }

  const FRAME = 70;
  const MULLION = 80;
  const SASH = 58;
  const FOAM = 12;
  const unitW = openingW - FOAM * 2;
  const unitH = openingH - FOAM * 2;
  const frameX = -155;
  const innerW = unitW - FRAME * 2;
  const innerH = unitH - FRAME * 2;
  const sashOuterW = (innerW - MULLION) / 2;
  const glassW = sashOuterW - SASH * 2;
  const glassH = innerH - SASH * 2;
  const leftC = -MULLION / 2 - sashOuterW / 2;
  const rightC = MULLION / 2 + sashOuterW / 2;
  const zMid = FRAME + innerH / 2;

  box(`${id}-frame-head`, id, "window", "Frame Head", [frameX, 0, unitH - FRAME], [70, unitW, FRAME], pvc);
  box(`${id}-frame-sill`, id, "window", "Frame Sill", [frameX, 0, 0], [70, unitW, FRAME], pvc);
  box(`${id}-frame-l`, id, "window", "Frame Left", [frameX, -unitW / 2 + FRAME / 2, FRAME], [70, FRAME, innerH], pvc);
  box(`${id}-frame-r`, id, "window", "Frame Right", [frameX, unitW / 2 - FRAME / 2, FRAME], [70, FRAME, innerH], pvc);
  box(`${id}-impost`, id, "window", "Impost", [frameX, 0, FRAME], [70, MULLION, innerH], pvc);

  for (const [side, cy] of [["l", leftC], ["r", rightC]]) {
    box(`${id}-sash-${side}-head`, id, "window", "Sash Head", [frameX + 8, cy, FRAME + innerH - SASH], [54, sashOuterW, SASH], pvc);
    box(`${id}-sash-${side}-sill`, id, "window", "Sash Sill", [frameX + 8, cy, FRAME], [54, sashOuterW, SASH], pvc);
    box(`${id}-sash-${side}-a`, id, "window", "Sash Jamb", [frameX + 8, cy - sashOuterW / 2 + SASH / 2, FRAME + SASH], [54, SASH, glassH], pvc);
    box(`${id}-sash-${side}-b`, id, "window", "Sash Jamb", [frameX + 8, cy + sashOuterW / 2 - SASH / 2, FRAME + SASH], [54, SASH, glassH], pvc);
    const gx = frameX + 8;
    box(`${id}-g1-${side}`, id, "window", "IGU Outer", [gx - 16, cy, FRAME + SASH], [4, glassW, glassH], glassPane);
    box(`${id}-g2-${side}`, id, "window", "IGU Mid", [gx, cy, FRAME + SASH], [4, glassW, glassH], glassPane);
    box(`${id}-g3-${side}`, id, "window", "IGU Inner", [gx + 16, cy, FRAME + SASH], [4, glassW, glassH], glassPane);
  }

  box(`${id}-handle`, id, "window", "Handle", [frameX + 42, rightC - sashOuterW / 2 + 18, zMid], [14, 12, 120], handleStyle);
  box(`${id}-handle-bar`, id, "window", "Handle Bar", [frameX + 54, rightC - sashOuterW / 2 + 18, zMid + 28], [36, 10, 10], handleStyle);

  const sillDepth = 360;
  const sillX = -120 + sillDepth / 2;
  box(`${id}-sill`, id, "window", "Windowsill", [sillX, 0, -40], [sillDepth, openingW + 80, 40], sillStyle);
  box(`${id}-sill-drip`, id, "window", "Sill Nose", [sillX + sillDepth / 2 - 8, 0, -52], [18, openingW + 80, 12], sillStyle);
}

function flipY(id) {
  const obj = objects[id];
  if (!obj) return;
  obj.transform.position[1] *= -1;
  for (const child of obj.children ?? []) flipY(child);
}

function addSlats(doorId, prefix, count = 9) {
  const door = objects[doorId];
  const [dx, dy, dz] = door.transform.position;
  const [sx, sy, sz] = door.geometry.size;
  const inward = Math.sign(dy) || -1;
  const slatY = dy + inward * (sy / 2 + 3);
  const usable = sx - 48;
  const pitch = usable / count;
  for (let i = 0; i < count; i += 1) {
    const x = dx - usable / 2 + pitch * (i + 0.5);
    box(`${prefix}-slat-${i}`, "kitchen-run", "cabinet", "Beadboard", [x, slatY, dz + 24], [8, 4, sz - 48], creamDoor);
  }
}

// West wall thicker, outward.
objects["wall-west"].geometry.path.points = [
  [-50, 0, 0],
  [-50, 5935, 0],
];
objects["wall-west"].geometry.thickness = 400;

makePvcWindow({
  id: "window-kitchen-west",
  name: "Kitchen Window",
  openingW: 1320,
  openingH: 1460,
  groupPos: [-50, 950, 880],
});
makePvcWindow({
  id: "window-living-west",
  name: "Living Window",
  openingW: 1400,
  openingH: 1460,
  groupPos: [-50, 3815, 880],
});

objects["door-living-west"].transform.position = [-50, 4865, 80];
objects["door-living-west"].geometry.size = [400, 700, 2260];

// Kitchen run back to south partition, fronts toward room (-Y).
flipY("kitchen-run");
objects["kitchen-run"].transform.position = [1365, 2155, 0];
objects["cab-top"].style = blackTop;
objects["cab-base"].style = creamDoor;
objects["cab-upper"].style = creamDoor;
for (const id of ["cab-door-l", "cab-door-r", "cab-u-l", "cab-u-c", "cab-u-r"]) {
  if (objects[id]) objects[id].style = creamDoor;
}

addSlats("cab-door-l", "cab-l", 8);
addSlats("cab-door-r", "cab-r", 8);
addSlats("cab-u-l", "cab-ul", 6);
addSlats("cab-u-c", "cab-uc", 6);
addSlats("cab-u-r", "cab-ur", 6);

objects["kitchen-table"].transform.position = [1080, 530, 0];
objects["chair-south"].transform.position = [1080, 1090, 0];
objects["chair-south"].transform.rotation = [0, 0, 0, 1];
objects["chair-east"].transform.position = [1640, 490, 0];
objects["chair-east"].transform.rotation = [0, 0, -0.7071067811865475, 0.7071067811865476];

objects["mw"].transform.position = [20, 1480, 880];
objects["mw-window"].transform.position = [176, 1480, 910];

// Boston / sword fern ~1.2 m
removeTree("jade-plant");
objects["jade-plant"] = {
  id: "jade-plant",
  type: "group",
  transform: {
    position: [5150, 5080, 0],
    rotation: [0, 0, 0.984807753012208, -0.1736481776669303],
    scale: [1, 1, 1],
  },
  children: [],
  metadata: { name: "Boston Fern" },
  parent: "living",
};
if (!objects.living.children.includes("jade-plant")) objects.living.children.push("jade-plant");

objects["tree-pot"] = {
  id: "tree-pot",
  type: "plant",
  transform: { ...ident, position: [0, 0, 80] },
  geometry: {
    type: "lathe",
    profile: [
      [0, 0],
      [92, 0],
      [108, 18],
      [118, 90],
      [122, 170],
      [116, 230],
      [102, 248],
      [78, 252],
    ],
    segments: 28,
  },
  metadata: { name: "Pot" },
  style: {
    face: { color: { r: 92, g: 74, b: 58, a: 1 }, opacity: 0.16, visible: true },
    edge: { color: { r: 130, g: 104, b: 82, a: 1 }, width: 1.1, opacity: 0.9, visible: true },
  },
  parent: "jade-plant",
};
objects["tree-soil"] = {
  id: "tree-soil",
  type: "plant",
  transform: { ...ident, position: [0, 0, 300] },
  geometry: {
    type: "lathe",
    profile: [
      [0, 0],
      [86, 0],
      [90, 18],
      [70, 28],
    ],
    segments: 20,
  },
  metadata: { name: "Soil" },
  style: {
    face: { color: { r: 58, g: 42, b: 32, a: 1 }, opacity: 0.2, visible: true },
    edge: { color: { r: 78, g: 58, b: 42, a: 1 }, width: 1, opacity: 0.8, visible: true },
  },
  parent: "jade-plant",
};
objects["jade-plant"].children.push("tree-pot", "tree-soil");

const frondStyle = {
  face: { color: { r: 42, g: 98, b: 54, a: 1 }, opacity: 0.22, visible: true },
  edge: { color: { r: 28, g: 72, b: 38, a: 1 }, width: 1, opacity: 0.75, visible: true },
};
const pinnaStyle = {
  face: { color: { r: 52, g: 128, b: 64, a: 1 }, opacity: 0.92, visible: true },
  edge: { color: { r: 30, g: 86, b: 44, a: 1 }, width: 0.8, opacity: 0.4, visible: false },
};
const pinnaDark = {
  face: { color: { r: 36, g: 102, b: 52, a: 1 }, opacity: 0.92, visible: true },
  edge: { color: { r: 24, g: 70, b: 36, a: 1 }, width: 0.8, opacity: 0.4, visible: false },
};

const rng = mulberry(0x7e4f001);
const FRONDS = 18;
for (let f = 0; f < FRONDS; f += 1) {
  const yaw = (f / FRONDS) * Math.PI * 2 + rng() * 0.18;
  const lean = 0.55 + rng() * 0.55;
  const length = 720 + rng() * 420;
  const pts = [];
  const steps = 9;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const arch = Math.sin(t * Math.PI * 0.72) * (180 + rng() * 80);
    const drop = t * t * 220;
    const r = t * length;
    pts.push([
      Math.cos(yaw) * r + Math.cos(yaw + Math.PI / 2) * arch * 0.15,
      Math.sin(yaw) * r + Math.sin(yaw + Math.PI / 2) * arch * 0.15,
      330 + t * 820 * lean - drop,
    ]);
  }
  const rachisId = `fern-rachis-${f}`;
  tube(rachisId, "jade-plant", "plant", `Frond ${f + 1}`, pts, [7.5, 6.2, 5.2, 4.2, 3.2, 2.4, 1.6], {
    radialSegments: 7,
    tubularSegments: 18,
    style: frondStyle,
  });

  const pinnaCount = 18 + Math.floor(rng() * 8);
  for (let p = 1; p < pinnaCount; p += 1) {
    const t = p / pinnaCount;
    const idx = t * (pts.length - 1);
    const i0 = Math.min(pts.length - 2, Math.floor(idx));
    const frac = idx - i0;
    const pos = add(mul(pts[i0], 1 - frac), mul(pts[i0 + 1], frac));
    const tangent = norm(sub(pts[i0 + 1], pts[i0]));
    const sideA = norm(cross(tangent, [0, 0, 1]));
    const sideB = mul(sideA, -1);
    const taper = Math.sin(t * Math.PI);
    const pinnaLen = (28 + 42 * taper) * (0.85 + rng() * 0.25);
    const pinnaW = 9 + 7 * taper;
    for (const [s, side] of [[0, sideA], [1, sideB]]) {
      const origin = add(pos, mul(side, 8));
      const dir = norm(add(side, mul([0, 0, 0.08], 1)));
      leaf(
        `fern-p-${f}-${p}-${s}`,
        "jade-plant",
        origin,
        lookQuat(dir, tangent),
        { length: pinnaLen, width: pinnaW, thickness: 0.9, cup: 0.12, segments: 4 },
        rng() > 0.35 ? pinnaStyle : pinnaDark,
      );
    }
  }
}

writeFileSync(path, `${JSON.stringify(doc)}\n`);
console.log("objects", Object.keys(objects).length, "fern children", objects["jade-plant"].children.length);
