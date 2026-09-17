import { rgba, type Color } from "@plana/core";
import { createEvent, createStore } from "effector";

export const HATCH_TYPES = [
  "wall",
  "floor",
  "door",
  "window",
  "opening",
  "furniture",
  "cabinet",
  "appliance",
  "table",
  "chair",
  "bed",
  "desk",
  "shelving",
  "plant",
  "decor",
] as const;

export type HatchType = (typeof HATCH_TYPES)[number];
export type HatchPattern = "lines" | "cross" | "dots";
export type ThemeId = "dark" | "light" | "midnight";

export type HatchRule = {
  enabled: boolean;
  inheritColor: boolean;
  color: Color;
  spacing: number;
  angle: number;
  width: number;
  pattern: HatchPattern;
};

export type ShortcutAction = "undo" | "redo" | "delete" | "frame" | "settings" | "grid" | "hatch";

export type ProjectSettings = {
  appearance: {
    theme: ThemeId;
    accent: string;
    uiScale: number;
  };
  canvas: {
    showGrid: boolean;
    gridSize: number;
    gridDivisions: number;
    showAxes: boolean;
    showHint: boolean;
    background: string;
    zoomSpeed: number;
    rotateSpeed: number;
    panSpeed: number;
    damping: boolean;
    snapToGrid: boolean;
    nudgeMm: number;
    nudgeShiftMm: number;
  };
  hatch: {
    world: HatchRule;
    types: Partial<Record<string, HatchRule>>;
  };
  shortcuts: Record<ShortcutAction, string>;
};

export const SHORTCUT_META: { id: ShortcutAction; label: string; group: string }[] = [
  { id: "undo", label: "Undo", group: "Edit" },
  { id: "redo", label: "Redo", group: "Edit" },
  { id: "delete", label: "Delete", group: "Edit" },
  { id: "frame", label: "Frame plan", group: "View" },
  { id: "grid", label: "Toggle grid", group: "View" },
  { id: "hatch", label: "Toggle world hatch", group: "View" },
  { id: "settings", label: "Open settings", group: "Window" },
];

export function defaultHatchRule(): HatchRule {
  return {
    enabled: false,
    inheritColor: true,
    color: rgba(228, 228, 231, 1),
    spacing: 120,
    angle: 45,
    width: 1,
    pattern: "lines",
  };
}

export function defaultSettings(): ProjectSettings {
  return {
    appearance: {
      theme: "dark",
      accent: "#a1a1aa",
      uiScale: 1,
    },
    canvas: {
      showGrid: true,
      gridSize: 20,
      gridDivisions: 40,
      showAxes: false,
      showHint: true,
      background: "#09090b",
      zoomSpeed: 1,
      rotateSpeed: 1,
      panSpeed: 1,
      damping: true,
      snapToGrid: false,
      nudgeMm: 1,
      nudgeShiftMm: 10,
    },
    hatch: {
      world: defaultHatchRule(),
      types: {},
    },
    shortcuts: {
      undo: "mod+z",
      redo: "mod+shift+z",
      delete: "delete",
      frame: "f",
      settings: "mod+,",
      grid: "mod+'",
      hatch: "mod+h",
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function mergeSettings(base: ProjectSettings, patch: unknown): ProjectSettings {
  if (!isRecord(patch)) return base;
  const next: ProjectSettings = structuredClone(base);
  if (isRecord(patch.appearance)) Object.assign(next.appearance, patch.appearance);
  if (isRecord(patch.canvas)) Object.assign(next.canvas, patch.canvas);
  if (isRecord(patch.hatch)) {
    if (isRecord(patch.hatch.world)) Object.assign(next.hatch.world, patch.hatch.world);
    if (isRecord(patch.hatch.types)) {
      next.hatch.types = { ...next.hatch.types };
      for (const [type, rule] of Object.entries(patch.hatch.types)) {
        if (!isRecord(rule)) continue;
        next.hatch.types[type] = { ...(next.hatch.types[type] ?? defaultHatchRule()), ...rule } as HatchRule;
      }
    }
  }
  if (isRecord(patch.shortcuts)) Object.assign(next.shortcuts, patch.shortcuts);
  return next;
}

export function hatchRuleForType(settings: ProjectSettings, type: string): HatchRule | null {
  const override = settings.hatch.types[type];
  if (override?.enabled) return override;
  return settings.hatch.world.enabled ? settings.hatch.world : null;
}

const STORAGE_KEY = "plana.project-settings";

export function readStoredSettings(): ProjectSettings {
  if (typeof localStorage === "undefined") return defaultSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? mergeSettings(defaultSettings(), JSON.parse(raw)) : defaultSettings();
  } catch {
    return defaultSettings();
  }
}

function persist(settings: ProjectSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota */
  }
}

export const patchSettings = createEvent<unknown>();
export const resetSettings = createEvent();
export const openSettings = createEvent<boolean | void>();

export const $settings = createStore<ProjectSettings>(defaultSettings())
  .on(patchSettings, (state, patch) => {
    const next = mergeSettings(state, patch);
    persist(next);
    return next;
  })
  .on(resetSettings, () => {
    const next = defaultSettings();
    persist(next);
    return next;
  });

export const $settingsOpen = createStore(false).on(openSettings, (open, value) =>
  value === undefined ? !open : value,
);

export function eventMatchesShortcut(event: KeyboardEvent, binding: string) {
  const parts = binding.toLowerCase().split("+").map((part) => part.trim());
  const key = parts.pop() ?? "";
  const wantMod = parts.includes("mod") || parts.includes("ctrl") || parts.includes("meta");
  const wantShift = parts.includes("shift");
  const wantAlt = parts.includes("alt");
  const eventMod = event.metaKey || event.ctrlKey;
  if (wantMod !== eventMod) return false;
  if (wantShift !== event.shiftKey) return false;
  if (wantAlt !== event.altKey) return false;
  const pressed = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();
  if (key === "delete") return event.key === "Delete" || event.key === "Backspace";
  if (key === "comma" || key === ",") return event.key === ",";
  if (key === "'" || key === "quote") return event.key === "'";
  return pressed === key || event.code.toLowerCase() === `key${key}`;
}

export function formatShortcut(binding: string) {
  return binding
    .split("+")
    .map((part) => {
      if (part === "mod") return "Ctrl";
      if (part === "shift") return "Shift";
      if (part === "alt") return "Alt";
      if (part === "delete") return "Del";
      return part.length === 1 ? part.toUpperCase() : part;
    })
    .join(" + ");
}

export function shortcutFromEvent(event: KeyboardEvent) {
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push("mod");
  if (event.shiftKey) parts.push("shift");
  if (event.altKey) parts.push("alt");
  const key = event.key === " " ? "space" : event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();
  if (["control", "meta", "shift", "alt"].includes(key)) return null;
  parts.push(key === "backspace" ? "delete" : key);
  return parts.join("+");
}
