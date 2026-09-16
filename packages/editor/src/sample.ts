import {
  addObject,
  createDocument,
  identityTransform,
  type PlanaDocument,
  type PlanaObject,
  type Transform,
} from "@plana/core";

type Doc = PlanaDocument;

const t = (x: number, y: number, z: number): Transform => ({
  ...identityTransform(),
  position: [x, y, z],
});

const wall = (
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  name: string,
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
  style?: PlanaObject["style"],
): PlanaObject => ({
  id,
  type,
  transform: t(x, y, z),
  geometry: { type: "box", size: [sx, sy, sz] },
  metadata: { name },
  style,
});

const group = (id: string, name: string, x = 0, y = 0, z = 0): PlanaObject => ({
  id,
  type: "group",
  transform: t(x, y, z),
  children: [],
  metadata: { name },
});

function add(doc: Doc, object: PlanaObject, parent: string): Doc {
  return addObject(doc, object, parent);
}

function addSofa(doc: Doc, parent: string): Doc {
  doc = add(doc, group("sofa", "Диван", -1400, 1900, 0), parent);
  doc = add(doc, box("sofa-base", "sofa", 0, 0, 0, 2200, 860, 280, "Основание"), "sofa");
  doc = add(doc, box("sofa-back", "sofa", 0, 320, 280, 2200, 180, 520, "Спинка"), "sofa");
  doc = add(doc, box("sofa-arm-l", "sofa", -1010, 0, 280, 180, 860, 420, "Подлокотник L"), "sofa");
  doc = add(doc, box("sofa-arm-r", "sofa", 1010, 0, 280, 180, 860, 420, "Подлокотник R"), "sofa");
  doc = add(doc, box("sofa-seat-l", "sofa", -520, -40, 280, 980, 620, 120, "Подушка L"), "sofa");
  doc = add(doc, box("sofa-seat-r", "sofa", 520, -40, 280, 980, 620, 120, "Подушка R"), "sofa");
  doc = add(doc, box("sofa-leg-1", "furniture", -980, -360, 0, 60, 60, 40, "Ножка"), "sofa");
  doc = add(doc, box("sofa-leg-2", "furniture", 980, -360, 0, 60, 60, 40, "Ножка"), "sofa");
  doc = add(doc, box("sofa-leg-3", "furniture", -980, 360, 0, 60, 60, 40, "Ножка"), "sofa");
  doc = add(doc, box("sofa-leg-4", "furniture", 980, 360, 0, 60, 60, 40, "Ножка"), "sofa");
  return doc;
}

function addTable(doc: Doc, parent: string, id: string, name: string, x: number, y: number): Doc {
  doc = add(doc, group(id, name, x, y, 0), parent);
  doc = add(doc, box(`${id}-top`, "table", 0, 0, 720, 1200, 700, 40, "Столешница"), id);
  doc = add(doc, box(`${id}-leg-1`, "furniture", -520, -280, 0, 60, 60, 720, "Ножка"), id);
  doc = add(doc, box(`${id}-leg-2`, "furniture", 520, -280, 0, 60, 60, 720, "Ножка"), id);
  doc = add(doc, box(`${id}-leg-3`, "furniture", -520, 280, 0, 60, 60, 720, "Ножка"), id);
  doc = add(doc, box(`${id}-leg-4`, "furniture", 520, 280, 0, 60, 60, 720, "Ножка"), id);
  return doc;
}

function addShelving(doc: Doc, parent: string): Doc {
  // Living shelving ~392×1964×1964 near east side of living
  doc = add(doc, group("shelving", "Стеллаж", 620, 1060, 0), parent);
  doc = add(doc, box("shelving-left", "furniture", -176, 0, 0, 40, 1964, 1964, "Стойка L"), "shelving");
  doc = add(doc, box("shelving-right", "furniture", 176, 0, 0, 40, 1964, 1964, "Стойка R"), "shelving");
  doc = add(doc, box("shelving-back", "furniture", 0, 952, 0, 352, 40, 1964, "Задняя стенка"), "shelving");
  doc = add(doc, box("shelving-shelf-1", "furniture", 0, 0, 40, 352, 1880, 28, "Полка 1"), "shelving");
  doc = add(doc, box("shelving-shelf-2", "furniture", 0, 0, 420, 352, 1880, 28, "Полка 2"), "shelving");
  doc = add(doc, box("shelving-shelf-3", "furniture", 0, 0, 820, 352, 1880, 28, "Полка 3"), "shelving");
  doc = add(doc, box("shelving-shelf-4", "furniture", 0, 0, 1220, 352, 1880, 28, "Полка 4"), "shelving");
  doc = add(doc, box("shelving-shelf-5", "furniture", 0, 0, 1620, 352, 1880, 28, "Полка 5"), "shelving");
  doc = add(doc, box("shelving-top", "furniture", 0, 0, 1936, 392, 1964, 28, "Верх"), "shelving");
  doc = add(
    doc,
    box("shelving-box-1", "furniture", -40, -400, 448, 180, 280, 220, "Короб"),
    "shelving",
  );
  doc = add(
    doc,
    box("shelving-box-2", "furniture", 40, 350, 848, 160, 240, 180, "Короб"),
    "shelving",
  );
  return doc;
}

function addDoor(
  doc: Doc,
  parent: string,
  id: string,
  name: string,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
): Doc {
  doc = add(doc, group(id, name, x, y, z), parent);
  doc = add(doc, box(`${id}-frame`, "door", 0, 0, 0, sx + 80, sy + 40, sz + 40, "Коробка"), id);
  doc = add(
    doc,
    box(`${id}-leaf`, "door", 0, 0, 20, Math.max(40, sx - 20), Math.max(40, sy - 20), sz - 20, "Полотно"),
    id,
  );
  doc = add(
    doc,
    box(`${id}-handle`, "furniture", sx > sy ? -sx / 4 : 0, sy > sx ? -sy / 4 : 0, sz * 0.45, 20, 80, 20, "Ручка"),
    id,
  );
  return doc;
}

function addWindow(
  doc: Doc,
  parent: string,
  id: string,
  name: string,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
): Doc {
  doc = add(doc, group(id, name, x, y, z), parent);
  doc = add(doc, box(`${id}-frame`, "window", 0, 0, 0, sx, sy, sz, "Рама"), id);
  doc = add(
    doc,
    box(`${id}-glass`, "window", 0, 0, 40, Math.max(20, sx - 60), Math.max(20, sy - 60), sz - 80, "Стекло", {
      face: { color: { r: 125, g: 211, b: 252, a: 1 }, opacity: 0.22, visible: true },
      edge: { color: { r: 56, g: 189, b: 248, a: 1 }, width: 1, opacity: 0.9, visible: true },
    }),
    id,
  );
  doc = add(doc, box(`${id}-mullion`, "window", 0, 0, 40, 30, Math.max(20, sy - 80), sz - 100, "Импост"), id);
  doc = add(doc, box(`${id}-sill`, "window", 0, 0, -30, sx + 40, sy + 60, 40, "Подоконник"), id);
  return doc;
}

export function createApartmentDocument(): PlanaDocument {
  let doc = createDocument();

  doc = add(doc, group("apartment", "Квартира ~33 м²"), "root");

  // Walls split around openings
  doc = add(doc, group("walls", "Стены"), "apartment");
  for (const item of [
    wall("wall-north", -3210, -2890, 3210, -2890, "Север"),
    wall("wall-south", -3210, 2890, 3210, 2890, "Юг"),
    // west wall split for entry door (~800 opening around y=-1337)
    wall("wall-west-n", -3135, -2967, -3135, -1737, "Запад (сев.)"),
    wall("wall-west-s", -3135, -937, -3135, 2967, "Запад (юг)"),
    // east wall continuous but windows sit in it visually
    wall("wall-east", 3135, -2967, 3135, 2967, "Восток"),
    wall("wall-bath-west", -1750, -2967, -1750, -1560, "С/у запад"),
    wall("wall-bath-east", 570, -2967, 570, -1560, "С/у восток"),
    // bath south split for door (~800 around x=-545)
    wall("wall-bath-s-w", -1750, -1632, -945, -1632, "С/у юг L"),
    wall("wall-bath-s-e", -145, -1632, 570, -1632, "С/у юг R"),
    // partition split for door (~840 around x=-2215)
    wall("wall-part-w", -3210, -438, -2635, -438, "Перегородка L"),
    wall("wall-part-e", -1795, -438, 3210, -438, "Перегородка R"),
  ]) {
    doc = add(doc, item, "walls");
  }

  // Openings
  doc = add(doc, group("openings", "Проёмы"), "apartment");
  doc = addDoor(doc, "openings", "door-entry", "Входная дверь", -3135, -1337, 0, 150, 800, 2040);
  doc = addDoor(doc, "openings", "door-partition", "Дверь в гостиную", -2215, -438, 0, 840, 150, 2040);
  doc = addDoor(doc, "openings", "door-bath", "Дверь с/у", -545, -1632, 0, 800, 150, 2040);
  doc = addWindow(doc, "openings", "window-kitchen", "Окно кухни", 3135, -2017, 900, 150, 1320, 1460);
  doc = addWindow(doc, "openings", "window-living", "Окно гостиной", 3135, 847, 900, 150, 1400, 1460);

  // Corridor
  doc = add(doc, group("corridor", "Коридор"), "apartment");
  doc = add(doc, box("floor-corridor", "floor", -2442, -1665, 0, 1235, 2305, 40, "Пол коридора"), "corridor");
  doc = add(
    doc,
    box("mirror", "furniture", -3000, -2000, 900, 40, 500, 900, "Зеркало"),
    "corridor",
  );

  // Living room
  doc = add(doc, group("living-room", "Гостиная"), "apartment");
  doc = add(doc, box("floor-living", "floor", 0, 1227, 0, 6120, 3180, 40, "Пол гостиной"), "living-room");
  doc = addSofa(doc, "living-room");
  doc = add(doc, group("coffee-table", "Журнальный стол", 200, 1450, 0), "living-room");
  doc = add(doc, box("coffee-top", "table", 0, 0, 400, 1000, 600, 30, "Столешница"), "coffee-table");
  doc = add(doc, box("coffee-leg-1", "furniture", -420, -220, 0, 50, 50, 400, "Ножка"), "coffee-table");
  doc = add(doc, box("coffee-leg-2", "furniture", 420, -220, 0, 50, 50, 400, "Ножка"), "coffee-table");
  doc = add(doc, box("coffee-leg-3", "furniture", -420, 220, 0, 50, 50, 400, "Ножка"), "coffee-table");
  doc = add(doc, box("coffee-leg-4", "furniture", 420, 220, 0, 50, 50, 400, "Ножка"), "coffee-table");
  doc = addShelving(doc, "living-room");

  doc = add(doc, group("tv-unit", "ТВ-зона", 2700, 2200, 0), "living-room");
  doc = add(doc, box("tv-stand", "furniture", 0, 0, 0, 400, 1400, 450, "Тумба TV"), "tv-unit");
  doc = add(doc, box("tv-screen", "furniture", -120, 0, 520, 60, 1200, 700, "Телевизор"), "tv-unit");
  doc = add(
    doc,
    box("switch-living", "smart-switch", -3000, 800, 1100, 80, 30, 120, "Smart switch"),
    "living-room",
  );
  doc = add(
    doc,
    box("socket-living", "socket", -3000, 500, 300, 80, 80, 80, "Розетка"),
    "living-room",
  );

  // Kitchen
  doc = add(doc, group("kitchen", "Кухня"), "apartment");
  doc = add(doc, box("floor-kitchen", "floor", 1852, -1665, 0, 2415, 2305, 40, "Пол кухни"), "kitchen");
  doc = add(doc, group("kitchen-set", "Кухонный гарнитур", 2400, -2300, 0), "kitchen");
  doc = add(doc, box("counter-base", "furniture", 0, 0, 0, 600, 2200, 850, "Низ"), "kitchen-set");
  doc = add(doc, box("counter-top", "table", 0, 0, 850, 620, 2240, 40, "Столешница"), "kitchen-set");
  doc = add(doc, box("upper-cab", "furniture", 0, 0, 1500, 350, 2200, 700, "Верх"), "kitchen-set");
  doc = add(doc, box("sink", "furniture", -100, -600, 890, 500, 450, 40, "Мойка"), "kitchen-set");
  doc = add(doc, box("fridge", "furniture", 2800, -900, 0, 600, 650, 1850, "Холодильник"), "kitchen");
  doc = addTable(doc, "kitchen", "kitchen-table", "Обеденный стол", 1400, -1200);
  doc = add(doc, box("kitchen-light", "light", 1850, -1665, 2500, 500, 500, 60, "Светильник"), "kitchen");
  doc = add(doc, box("chair-1", "chair", 900, -1200, 0, 420, 420, 900, "Стул"), "kitchen");
  doc = add(doc, box("chair-2", "chair", 1900, -1200, 0, 420, 420, 900, "Стул"), "kitchen");

  // Bathroom
  doc = add(doc, group("bathroom", "Санузел"), "apartment");
  doc = add(doc, box("floor-bath", "floor", -590, -2262, 0, 2170, 1110, 40, "Пол с/у"), "bathroom");
  doc = add(doc, group("bathtub", "Ванна", -1100, -2400, 0), "bathroom");
  doc = add(doc, box("bath-shell", "furniture", 0, 0, 0, 1700, 700, 560, "Корпус"), "bathtub");
  doc = add(
    doc,
    box("bath-inner", "furniture", 0, 0, 80, 1500, 520, 400, "Чаша", {
      face: { color: { r: 219, g: 234, b: 254, a: 1 }, opacity: 0.2, visible: true },
      edge: { color: { r: 147, g: 197, b: 253, a: 1 }, width: 1, opacity: 1, visible: true },
    }),
    "bathtub",
  );
  doc = add(doc, box("toilet", "furniture", 200, -2100, 0, 380, 650, 400, "Унитаз"), "bathroom");
  doc = add(doc, box("washbasin", "furniture", 200, -2600, 0, 500, 400, 850, "Раковина"), "bathroom");
  doc = add(doc, box("bath-light", "light", -590, -2262, 2500, 300, 300, 50, "Свет с/у"), "bathroom");

  return doc;
}
