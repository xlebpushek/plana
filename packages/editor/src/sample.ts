import {
  addObject,
  createDocument,
  identityTransform,
  type PlanaDocument,
  type PlanaObject,
} from "@plana/core";

const wall = (
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  height = 2700,
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
    thickness: 150,
    height: { start: height, end: height },
    baseZ: 0,
  },
  metadata: { name: id },
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
  name?: string,
): PlanaObject => ({
  id,
  type,
  transform: {
    ...identityTransform(),
    position: [x, y, z],
  },
  geometry: {
    type: "box",
    size: [sx, sy, sz],
  },
  metadata: { name: name ?? id },
});

export function createApartmentDocument(): PlanaDocument {
  let document = createDocument();

  document = addObject(document, {
    id: "apartment",
    type: "group",
    transform: identityTransform(),
    children: [],
    metadata: { name: "Квартира ~33 м²" },
  });

  document = addObject(
    document,
    {
      id: "walls",
      type: "group",
      transform: identityTransform(),
      children: [],
      metadata: { name: "Стены" },
    },
    "apartment",
  );

  for (const item of [
    wall("wall-north", -3210, -2890, 3210, -2890),
    wall("wall-south", -3210, 2890, 3210, 2890),
    wall("wall-west", -3135, -2967, -3135, 2967),
    wall("wall-east", 3135, -2967, 3135, 2967),
    wall("wall-bath-west", -1750, -2967, -1750, -1560),
    wall("wall-bath-east", 570, -2967, 570, -1560),
    wall("wall-bath-south", -1750, -1632, 570, -1632),
    wall("wall-partition", -3210, -438, 3210, -438),
  ]) {
    document = addObject(document, item, "walls");
  }

  document = addObject(
    document,
    {
      id: "living-room",
      type: "group",
      transform: identityTransform(),
      children: [],
      metadata: { name: "Гостиная" },
    },
    "apartment",
  );

  for (const item of [
    box("floor-living", "floor", 0, 1227, 0, 6120, 3180, 40, "Пол гостиной"),
    box("sofa", "sofa", -1200, 1800, 0, 2200, 900, 750, "Диван"),
    box("table", "table", 400, 1400, 0, 1200, 700, 450, "Стол"),
    box("tv", "furniture", 2500, 2200, 400, 80, 1200, 700, "TV"),
    box("switch-living", "smart-switch", -3000, 800, 1100, 80, 30, 120, "Smart switch"),
  ]) {
    document = addObject(document, item, "living-room");
  }

  document = addObject(
    document,
    {
      id: "kitchen",
      type: "group",
      transform: identityTransform(),
      children: [],
      metadata: { name: "Кухня" },
    },
    "apartment",
  );

  for (const item of [
    box("floor-kitchen", "floor", 1850, -1665, 0, 2415, 2305, 40, "Пол кухни"),
    box("kitchen-table", "table", 1800, -1800, 0, 1400, 700, 750, "Кухонный стол"),
    box("kitchen-light", "light", 1800, -1800, 2400, 400, 400, 80, "Свет"),
  ]) {
    document = addObject(document, item, "kitchen");
  }

  document = addObject(
    document,
    {
      id: "bathroom",
      type: "group",
      transform: identityTransform(),
      children: [],
      metadata: { name: "Санузел" },
    },
    "apartment",
  );

  for (const item of [
    box("floor-bath", "floor", -590, -2262, 0, 2170, 1110, 40, "Пол санузла"),
    box("bath", "furniture", -900, -2300, 0, 1700, 700, 550, "Ванна"),
  ]) {
    document = addObject(document, item, "bathroom");
  }

  return document;
}
