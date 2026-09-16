/**
 * Preset constructors for built-in object types (wall, box, …).
 * Types stay free-form strings; these only provide convenient defaults.
 */

import { createId } from "../document/document.js";
import { identityTransform } from "../transform.js";
import type { PlanaObject } from "../object/object.js";
import { defaultObjectRegistry } from "./object.js";

export type WallPresetOptions = {
  id?: string;
  name?: string;
  length?: number;
  thickness?: number;
  height?: number;
  baseZ?: number;
};

export function createWallObject(options: WallPresetOptions = {}): PlanaObject {
  const length = options.length ?? 2000;
  const thickness = options.thickness ?? 150;
  const height = options.height ?? 2700;
  const baseZ = options.baseZ ?? 0;
  const id = options.id ?? createId("wall");
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
    metadata: { name: options.name ?? "Стена" },
  };
}

export type BoxPresetOptions = {
  id?: string;
  name?: string;
  size?: [number, number, number];
  type?: string;
};

export function createBoxObject(options: BoxPresetOptions = {}): PlanaObject {
  const id = options.id ?? createId("box");
  return {
    id,
    type: options.type ?? "object",
    transform: { ...identityTransform(), position: [0, 0, 0] },
    geometry: { type: "box", size: options.size ?? [1000, 1000, 1000] },
    metadata: { name: options.name ?? id },
  };
}

let presetsRegistered = false;

/** Idempotent registration of built-in presets on the default registry. */
export function registerBuiltinPresets() {
  if (presetsRegistered) return;
  presetsRegistered = true;
  if (!defaultObjectRegistry.has("wall")) {
    defaultObjectRegistry.register({
      type: "wall",
      create: createWallObject as never,
      validate: (object) => object.geometry?.type === "wall",
    });
  }
  if (!defaultObjectRegistry.has("box")) {
    defaultObjectRegistry.register({
      type: "box",
      create: createBoxObject as never,
    });
  }
}

registerBuiltinPresets();
