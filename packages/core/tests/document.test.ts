import { describe, expect, it } from "vitest";

import {
  addObject,
  createDocument,
  deserialize,
  getObject,
  identityTransform,
  removeObject,
  serialize,
  validateDocument,
} from "../src/index.js";

describe("document", () => {
  it("creates a root group", () => {
    const doc = createDocument();
    expect(doc.root).toBe("root");
    expect(doc.units).toBe("mm");
    expect(getObject(doc, "root")?.type).toBe("group");
  });

  it("adds and removes hierarchical objects", () => {
    let doc = createDocument();
    doc = addObject(doc, {
      id: "living",
      type: "group",
      transform: identityTransform(),
      children: [],
    });
    doc = addObject(
      doc,
      {
        id: "sofa",
        type: "sofa",
        transform: identityTransform(),
        geometry: { type: "box", size: [2000, 900, 800] },
      },
      "living",
    );

    expect(getObject(doc, "living")?.children).toContain("sofa");
    doc = removeObject(doc, "living");
    expect(getObject(doc, "sofa")).toBeUndefined();
    expect(getObject(doc, "living")).toBeUndefined();
  });

  it("round-trips serialization", () => {
    let doc = createDocument();
    doc = addObject(doc, {
      id: "wall-1",
      type: "wall",
      transform: identityTransform(),
      geometry: {
        type: "wall",
        path: {
          type: "polyline",
          points: [
            [0, 0, 0],
            [5000, 0, 0],
          ],
          closed: false,
        },
        thickness: 200,
        height: { start: 2800, end: 2800 },
        baseZ: 0,
      },
    });
    const json = serialize(doc);
    const again = deserialize(json);
    expect(validateDocument(again).objects["wall-1"]?.type).toBe("wall");
  });
});
