/**
 * Built-in object type stubs. No product presets / rules — just named types
 * the editor and styles can resolve. Ready CAD styles exist only for
 * wall / floor / window / door / opening (see style.ts).
 */

export type BuiltinObjectType =
  | "wall"
  | "floor"
  | "window"
  | "door"
  | "opening"
  | "group"
  | "sofa"
  | "bed"
  | "chair"
  | "table"
  | "shelving"
  | "cabinet"
  | "desk"
  | "wardrobe"
  | "furniture"
  | "plant"
  | "flower"
  | "tree"
  | "clock"
  | "lamp"
  | "vase"
  | "decor"
  | "appliance"
  | "socket"
  | "light"
  | "smart-switch";

/** Architectural / CAD types with ready default styles. */
export const CAD_OBJECT_TYPES = [
  "wall",
  "floor",
  "window",
  "door",
  "opening",
] as const satisfies readonly BuiltinObjectType[];

/** Furniture type stubs (white placeholder styles). */
export const FURNITURE_OBJECT_TYPES = [
  "sofa",
  "bed",
  "chair",
  "table",
  "shelving",
  "cabinet",
  "desk",
  "wardrobe",
  "furniture",
] as const satisfies readonly BuiltinObjectType[];

/** Decor / prop type stubs (no special rules). */
export const DECOR_OBJECT_TYPES = [
  "plant",
  "flower",
  "tree",
  "clock",
  "lamp",
  "vase",
  "decor",
  "appliance",
  "socket",
  "light",
  "smart-switch",
] as const satisfies readonly BuiltinObjectType[];

export const BUILTIN_OBJECT_TYPES = [
  ...CAD_OBJECT_TYPES,
  "group",
  ...FURNITURE_OBJECT_TYPES,
  ...DECOR_OBJECT_TYPES,
] as const satisfies readonly BuiltinObjectType[];

import { defaultObjectRegistry } from "./object.js";

let registered = false;

/** Register built-in type stubs once (no create/validate rules). */
export function registerBuiltinObjectTypes() {
  if (registered) return;
  registered = true;
  for (const type of BUILTIN_OBJECT_TYPES) {
    if (!defaultObjectRegistry.has(type)) {
      defaultObjectRegistry.register({ type });
    }
  }
}

registerBuiltinObjectTypes();
