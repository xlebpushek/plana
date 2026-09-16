import {
  createEllipse,
  createEmptyDocument,
  createGroup,
  createRect,
  type PlanaDocument,
} from "@plana/viewer";

export function createApartmentSample(): PlanaDocument {
  const doc = createEmptyDocument("Квартира 33 м²");

  const floor = createRect({
    id: "floor",
    name: "Floor",
    width: 620,
    height: 520,
    transform: { x: -310, y: -260, rotation: 0, scaleX: 1, scaleY: 1 },
    style: { fill: "#f8fafc", stroke: "#94a3b8", strokeWidth: 2, opacity: 1 },
    cornerRadius: 4,
  });

  const living = createRect({
    id: "living",
    name: "Гостиная",
    width: 360,
    height: 280,
    transform: { x: -280, y: -230, rotation: 0, scaleX: 1, scaleY: 1 },
    style: { fill: "#e2e8f0", stroke: "#64748b", strokeWidth: 1.5, opacity: 1 },
  });

  const kitchen = createRect({
    id: "kitchen",
    name: "Кухня",
    width: 200,
    height: 180,
    transform: { x: 90, y: -230, rotation: 0, scaleX: 1, scaleY: 1 },
    style: { fill: "#fef3c7", stroke: "#b45309", strokeWidth: 1.5, opacity: 1 },
  });

  const bath = createRect({
    id: "bath",
    name: "Санузел",
    width: 140,
    height: 160,
    transform: { x: 90, y: -20, rotation: 0, scaleX: 1, scaleY: 1 },
    style: { fill: "#dbeafe", stroke: "#1d4ed8", strokeWidth: 1.5, opacity: 1 },
  });

  const balcony = createRect({
    id: "balcony",
    name: "Балкон",
    width: 360,
    height: 70,
    transform: { x: -280, y: 80, rotation: 0, scaleX: 1, scaleY: 1 },
    style: { fill: "#ecfccb", stroke: "#3f6212", strokeWidth: 1.5, opacity: 1 },
  });

  const table = createEllipse({
    id: "table",
    name: "Стол",
    width: 110,
    height: 70,
    transform: { x: -160, y: -120, rotation: 0, scaleX: 1, scaleY: 1 },
    style: { fill: "#fdba74", stroke: "#9a3412", strokeWidth: 1.5, opacity: 1 },
  });

  const sofa = createRect({
    id: "sofa",
    name: "Диван",
    width: 180,
    height: 60,
    cornerRadius: 10,
    transform: { x: -250, y: -40, rotation: 0, scaleX: 1, scaleY: 1 },
    style: { fill: "#a5b4fc", stroke: "#3730a3", strokeWidth: 1.5, opacity: 1 },
  });

  const furniture = createGroup({
    id: "furniture",
    name: "Мебель",
    childIds: ["table", "sofa"],
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
  });

  table.parentId = furniture.id;
  sofa.parentId = furniture.id;

  const objects = [floor, living, kitchen, bath, balcony, furniture, table, sofa];
  for (const object of objects) {
    doc.objects[object.id] = object;
  }
  doc.rootIds = ["floor", "living", "kitchen", "bath", "balcony", "furniture"];
  doc.camera = { x: 0, y: -40, zoom: 1.15 };
  return doc;
}
