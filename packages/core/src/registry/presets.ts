/**
 * Optional helpers for creating typed objects. Not product presets —
 * just convenient constructors used by the editor toolbar.
 */

import { createId } from "../document/document.js";
import { identityTransform } from "../transform.js";
import type { PlanaObject } from "../object/object.js";

export function createWallObject(options?: {
  id?: string;
  name?: string;
  length?: number;
  thickness?: number;
  height?: number;
  baseZ?: number;
}): PlanaObject {
  const length = options?.length ?? 2000;
  const thickness = options?.thickness ?? 150;
  const height = options?.height ?? 2700;
  const baseZ = options?.baseZ ?? 0;
  const id = options?.id ?? createId("wall");
  return {
    id,
    type: "wall",
    transform: identityTransform(),
    geometry: {
      type: "wall",
      path: {
        type: "polyline",
        points: [
          [0, 0, 0],
          [length, 0, 0],
        ],
        closed: false,
      },
      thickness,
      height: { start: height, end: height },
      baseZ,
    },
    metadata: { name: options?.name ?? "Wall" },
  };
}

export function createBoxObject(options?: {
  id?: string;
  name?: string;
  size?: [number, number, number];
  type?: string;
}): PlanaObject {
  const id = options?.id ?? createId("box");
  return {
    id,
    type: options?.type ?? "object",
    transform: { ...identityTransform(), position: [0, 0, 0] },
    geometry: { type: "box", size: options?.size ?? [1000, 1000, 1000] },
    metadata: { name: options?.name ?? id },
  };
}
