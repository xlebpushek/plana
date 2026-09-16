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

/**
 * Floor plan (mm), Z-up:
 *  X: -3210 … 3210
 *  Y: -2890 … 2890
 *  Partition at Y = -438
 *  Living: Y > -438
 *  Kitchen/bath/corridor: Y < -438
 */
export function createApartmentDocument(): PlanaDocument {
  let doc = createDocument();
  doc = add(doc, group("apartment", "Квартира ~33 м²"), "root");

  // --- Walls with door gaps ---
  doc = add(doc, group("walls", "Стены"), "apartment");
  for (const item of [
    wall("wall-north", -3210, -2890, 3210, -2890, "Север"),
    wall("wall-south", -3210, 2890, 3210, 2890, "Юг"),
    wall("wall-west-n", -3135, -2967, -3135, -1737, "Запад север"),
    wall("wall-west-s", -3135, -937, -3135, 2967, "Запад юг"),
    wall("wall-east", 3135, -2967, 3135, 2967, "Восток"),
    wall("wall-bath-west", -1750, -2967, -1750, -1560, "С/у запад"),
    wall("wall-bath-east", 570, -2967, 570, -1560, "С/у восток"),
    wall("wall-bath-s-w", -1750, -1632, -945, -1632, "С/у юг L"),
    wall("wall-bath-s-e", -145, -1632, 570, -1632, "С/у юг R"),
    wall("wall-part-w", -3210, -438, -2635, -438, "Перегородка L"),
    wall("wall-part-e", -1795, -438, 3210, -438, "Перегородка R"),
  ]) {
    doc = add(doc, item, "walls");
  }

  // --- Openings ---
  doc = add(doc, group("openings", "Проёмы"), "apartment");
  doc = addDoor(doc, "openings", "door-entry", "Входная дверь", -3135, -1337, 0, 80, 800, 2040);
  doc = addDoor(doc, "openings", "door-living", "Дверь в гостиную", -2215, -438, 0, 840, 80, 2040);
  doc = addDoor(doc, "openings", "door-bath", "Дверь с/у", -545, -1632, 0, 800, 80, 2040);
  doc = addWindow(doc, "openings", "window-kitchen", "Окно кухни", 3135, -2017, 900, 80, 1320, 1460);
  doc = addWindow(doc, "openings", "window-living", "Окно гостиной", 3135, 1200, 900, 80, 1400, 1460);

  // --- Corridor (west strip, south of entry / north of living door) ---
  doc = add(doc, group("corridor", "Коридор"), "apartment");
  doc = add(doc, box("floor-corridor", "floor", -2440, -1660, 0, 1400, 2300, 30, "Пол коридора"), "corridor");
  doc = add(doc, box("mirror", "furniture", -3040, -2100, 900, 30, 500, 900, "Зеркало"), "corridor");
  doc = add(doc, box("switch-entry", "smart-switch", -3040, -900, 1100, 70, 25, 110, "Выключатель"), "corridor");

  // --- Living room ---
  // Sofa along south wall, facing north; TV on north partition side? Better:
  // Sofa against west living wall, looking east toward window+TV.
  doc = add(doc, group("living-room", "Гостиная"), "apartment");
  doc = add(doc, box("floor-living", "floor", 0, 1220, 0, 6200, 3200, 30, "Пол гостиной"), "living-room");

  // Sofa: against west wall of living, centered in living depth
  doc = add(doc, group("sofa", "Диван", -2550, 1400, 0), "living-room");
  doc = add(doc, box("sofa-base", "sofa", 0, 0, 0, 900, 2200, 280, "Основание"), "sofa");
  doc = add(doc, box("sofa-back", "sofa", -360, 0, 280, 180, 2200, 520, "Спинка"), "sofa");
  doc = add(doc, box("sofa-arm-n", "sofa", 0, -1010, 280, 900, 180, 400, "Подлокотник"), "sofa");
  doc = add(doc, box("sofa-arm-s", "sofa", 0, 1010, 280, 900, 180, 400, "Подлокотник"), "sofa");
  doc = add(doc, box("sofa-seat-1", "sofa", 40, -520, 280, 620, 980, 110, "Сиденье"), "sofa");
  doc = add(doc, box("sofa-seat-2", "sofa", 40, 520, 280, 620, 980, 110, "Сиденье"), "sofa");

  // Coffee table in front of sofa
  doc = add(doc, group("coffee-table", "Журнальный стол", -1200, 1400, 0), "living-room");
  doc = add(doc, box("coffee-top", "table", 0, 0, 400, 600, 1000, 30, "Столешница"), "coffee-table");
  doc = add(doc, box("coffee-l1", "furniture", -240, -420, 0, 45, 45, 400, "Ножка"), "coffee-table");
  doc = add(doc, box("coffee-l2", "furniture", 240, -420, 0, 45, 45, 400, "Ножка"), "coffee-table");
  doc = add(doc, box("coffee-l3", "furniture", -240, 420, 0, 45, 45, 400, "Ножка"), "coffee-table");
  doc = add(doc, box("coffee-l4", "furniture", 240, 420, 0, 45, 45, 400, "Ножка"), "coffee-table");

  // TV unit under living window (east wall)
  doc = add(doc, group("tv-unit", "ТВ-зона", 2850, 1200, 0), "living-room");
  doc = add(doc, box("tv-stand", "furniture", 0, 0, 0, 400, 1400, 450, "Тумба"), "tv-unit");
  doc = add(doc, box("tv-screen", "furniture", -80, 0, 520, 50, 1200, 700, "Телевизор"), "tv-unit");

  // Shelving against south living wall, east of sofa clear path
  doc = add(doc, group("shelving", "Стеллаж", 800, 2550, 0), "living-room");
  doc = add(doc, box("sh-left", "furniture", -900, 0, 0, 40, 350, 1960, "Стойка L"), "shelving");
  doc = add(doc, box("sh-right", "furniture", 900, 0, 0, 40, 350, 1960, "Стойка R"), "shelving");
  doc = add(doc, box("sh-back", "furniture", 0, 155, 0, 1840, 30, 1960, "Задняя стенка"), "shelving");
  doc = add(doc, box("sh-1", "furniture", 0, 0, 40, 1760, 320, 28, "Полка 1"), "shelving");
  doc = add(doc, box("sh-2", "furniture", 0, 0, 420, 1760, 320, 28, "Полка 2"), "shelving");
  doc = add(doc, box("sh-3", "furniture", 0, 0, 820, 1760, 320, 28, "Полка 3"), "shelving");
  doc = add(doc, box("sh-4", "furniture", 0, 0, 1220, 1760, 320, 28, "Полка 4"), "shelving");
  doc = add(doc, box("sh-5", "furniture", 0, 0, 1620, 1760, 320, 28, "Полка 5"), "shelving");
  doc = add(doc, box("sh-top", "furniture", 0, 0, 1930, 1840, 350, 28, "Верх"), "shelving");

  doc = add(doc, box("socket-living", "socket", -3040, 1800, 300, 70, 70, 70, "Розетка"), "living-room");

  // --- Kitchen (east, north of partition / south of north wall) ---
  doc = add(doc, group("kitchen", "Кухня"), "apartment");
  doc = add(doc, box("floor-kitchen", "floor", 1850, -1660, 0, 2500, 2300, 30, "Пол кухни"), "kitchen");

  // Counter along east wall under kitchen window
  doc = add(doc, group("kitchen-set", "Кухонный гарнитур", 2750, -2000, 0), "kitchen");
  doc = add(doc, box("counter-base", "furniture", 0, 0, 0, 560, 2100, 850, "Низ"), "kitchen-set");
  doc = add(doc, box("counter-top", "table", 0, 0, 850, 580, 2140, 40, "Столешница"), "kitchen-set");
  doc = add(doc, box("upper-cab", "furniture", 40, 0, 1500, 320, 2100, 700, "Верх"), "kitchen-set");
  doc = add(doc, box("sink", "furniture", -40, -400, 890, 480, 420, 30, "Мойка"), "kitchen-set");

  // Fridge in NE kitchen corner (near partition / east)
  doc = add(doc, box("fridge", "furniture", 2750, -700, 0, 600, 650, 1850, "Холодильник"), "kitchen");

  // Dining table center-west of kitchen work zone
  doc = add(doc, group("kitchen-table", "Обеденный стол", 1400, -1700, 0), "kitchen");
  doc = add(doc, box("kt-top", "table", 0, 0, 740, 1200, 700, 35, "Столешница"), "kitchen-table");
  doc = add(doc, box("kt-l1", "furniture", -520, -280, 0, 50, 50, 740, "Ножка"), "kitchen-table");
  doc = add(doc, box("kt-l2", "furniture", 520, -280, 0, 50, 50, 740, "Ножка"), "kitchen-table");
  doc = add(doc, box("kt-l3", "furniture", -520, 280, 0, 50, 50, 740, "Ножка"), "kitchen-table");
  doc = add(doc, box("kt-l4", "furniture", 520, 280, 0, 50, 50, 740, "Ножка"), "kitchen-table");

  doc = add(doc, box("chair-1", "chair", 900, -1700, 0, 420, 420, 900, "Стул"), "kitchen");
  doc = add(doc, box("chair-2", "chair", 1900, -1700, 0, 420, 420, 900, "Стул"), "kitchen");
  doc = add(doc, box("kitchen-light", "light", 1850, -1700, 2500, 420, 420, 50, "Светильник"), "kitchen");

  // --- Bathroom ---
  doc = add(doc, group("bathroom", "Санузел"), "apartment");
  doc = add(doc, box("floor-bath", "floor", -590, -2260, 0, 2200, 1120, 30, "Пол с/у"), "bathroom");

  // Tub along north wall of bath
  doc = add(doc, group("bathtub", "Ванна", -1100, -2550, 0), "bathroom");
  doc = add(doc, box("bath-shell", "furniture", 0, 0, 0, 1700, 700, 560, "Корпус"), "bathtub");
  doc = add(
    doc,
    box("bath-inner", "furniture", 0, 0, 70, 1480, 500, 400, "Чаша", {
      face: { color: { r: 186, g: 230, b: 253, a: 1 }, opacity: 0.08, visible: true },
      edge: { color: { r: 125, g: 211, b: 252, a: 1 }, width: 1, opacity: 0.9, visible: true },
    }),
    "bathtub",
  );

  // Toilet near east bath wall / door side
  doc = add(doc, box("toilet", "furniture", 200, -2000, 0, 380, 620, 400, "Унитаз"), "bathroom");
  // Washbasin near east wall of bath
  doc = add(doc, box("washbasin", "furniture", 250, -2550, 0, 500, 400, 850, "Раковина"), "bathroom");
  doc = add(doc, box("bath-light", "light", -590, -2260, 2500, 280, 280, 40, "Свет с/у"), "bathroom");

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
  doc = add(doc, box(`${id}-frame`, "door", 0, 0, 0, sx + 60, sy + 40, sz + 30, "Коробка"), id);
  doc = add(
    doc,
    box(`${id}-leaf`, "door", 0, 0, 20, Math.max(30, sx - 10), Math.max(40, sy - 30), sz - 40, "Полотно"),
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
    box(`${id}-glass`, "window", 0, 0, 40, Math.max(16, sx - 40), Math.max(40, sy - 80), sz - 100, "Стекло", {
      face: { color: { r: 125, g: 211, b: 252, a: 1 }, opacity: 0.05, visible: true },
      edge: { color: { r: 56, g: 189, b: 248, a: 1 }, width: 1, opacity: 0.85, visible: true },
    }),
    id,
  );
  doc = add(doc, box(`${id}-mullion`, "window", 0, 0, 40, 24, Math.max(30, sy - 100), sz - 120, "Импост"), id);
  doc = add(doc, box(`${id}-sill`, "window", -20, 0, -25, sx + 40, sy + 80, 35, "Подоконник"), id);
  return doc;
}
