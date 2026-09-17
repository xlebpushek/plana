"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useUnit } from "effector-react";
import { Settings as SettingsIcon, X } from "lucide-react";

import {
  $settings,
  $settingsOpen,
  HATCH_TYPES,
  SHORTCUT_META,
  defaultHatchRule,
  formatShortcut,
  openSettings,
  patchSettings,
  resetSettings,
  shortcutFromEvent,
  type HatchRule,
  type ProjectSettings,
  type ThemeId,
} from "../model/settings";
import { useEditor } from "./context";
import { useViewerScope } from "../viewer/ViewerProvider";

const NAV = [
  { id: "appearance", label: "Appearance", hint: "Theme & chrome" },
  { id: "canvas", label: "Canvas", hint: "Grid, zoom, nudge" },
  { id: "hatch", label: "Hatch", hint: "World & type fills" },
  { id: "shortcuts", label: "Shortcuts", hint: "Keyboard" },
] as const;

type NavId = (typeof NAV)[number]["id"];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="plana-set-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function HatchFields({
  rule,
  onChange,
}: {
  rule: HatchRule;
  onChange: (patch: Partial<HatchRule>) => void;
}) {
  const hex = `#${[rule.color.r, rule.color.g, rule.color.b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  return (
    <div className="plana-set-stack">
      <Field label="Enabled">
        <input type="checkbox" checked={rule.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} />
      </Field>
      <Field label="Pattern">
        <select
          value={rule.pattern}
          onChange={(e) => onChange({ pattern: e.target.value as HatchRule["pattern"] })}
        >
          <option value="lines">Lines</option>
          <option value="cross">Cross</option>
          <option value="dots">Dots</option>
        </select>
      </Field>
      <Field label="Angle">
        <input
          type="number"
          value={rule.angle}
          onChange={(e) => onChange({ angle: Number(e.target.value) })}
        />
      </Field>
      <Field label="Spacing (mm)">
        <input
          type="number"
          min={10}
          value={rule.spacing}
          onChange={(e) => onChange({ spacing: Math.max(10, Number(e.target.value)) })}
        />
      </Field>
      <Field label="Line weight">
        <input
          type="number"
          min={0}
          step={0.1}
          value={rule.width}
          onChange={(e) => onChange({ width: Number(e.target.value) })}
        />
      </Field>
      <Field label="Inherit object color">
        <input
          type="checkbox"
          checked={rule.inheritColor}
          onChange={(e) => onChange({ inheritColor: e.target.checked })}
        />
      </Field>
      <Field label="Color">
        <input
          type="color"
          disabled={rule.inheritColor}
          value={hex}
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              color: {
                r: Number.parseInt(v.slice(1, 3), 16),
                g: Number.parseInt(v.slice(3, 5), 16),
                b: Number.parseInt(v.slice(5, 7), 16),
                a: 1,
              },
            });
          }}
        />
      </Field>
    </div>
  );
}

export function SettingsButton() {
  useViewerScope();
  useEditor();
  const open = useUnit(openSettings);
  const settings = useUnit($settings);
  return (
    <button
      type="button"
      className="plana-icon-btn"
      title={`Settings (${formatShortcut(settings.shortcuts.settings)})`}
      aria-label="Settings"
      onClick={() => open(true)}
    >
      <SettingsIcon size={17} strokeWidth={1.8} />
    </button>
  );
}

export function SettingsModal() {
  useViewerScope();
  useEditor();
  const opened = useUnit($settingsOpen);
  const settings = useUnit($settings);
  const setOpen = useUnit(openSettings);
  const patch = useUnit(patchSettings);
  const reset = useUnit(resetSettings);
  const [section, setSection] = useState<NavId>("appearance");
  const [hatchType, setHatchType] = useState<string>("wall");
  const [capturing, setCapturing] = useState<string | null>(null);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setCapturing(null);
        return;
      }
      const binding = shortcutFromEvent(event);
      if (!binding) return;
      patch({ shortcuts: { [capturing]: binding } });
      setCapturing(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturing, patch]);

  if (!opened) return null;

  const typeRule = settings.hatch.types[hatchType] ?? { ...defaultHatchRule(), enabled: false };

  return (
    <div className="plana-set-overlay" role="presentation" onClick={() => setOpen(false)}>
      <div
        className="plana-set-dialog"
        role="dialog"
        aria-labelledby="plana-settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="plana-set-head">
          <div>
            <div id="plana-settings-title" className="plana-set-title">
              Preferences
            </div>
            <div className="plana-set-sub">Project-wide editor settings</div>
          </div>
          <button type="button" className="plana-icon-btn" aria-label="Close" onClick={() => setOpen(false)}>
            <X size={16} strokeWidth={1.8} />
          </button>
        </header>
        <div className="plana-set-body">
          <nav className="plana-set-nav">
            {NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={section === item.id ? "is-active" : ""}
                onClick={() => setSection(item.id)}
              >
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </button>
            ))}
          </nav>
          <div className="plana-set-main">
            {section === "appearance" && (
              <>
                <h3>Theme</h3>
                <div className="plana-set-row">
                  {(["dark", "light", "midnight"] as ThemeId[]).map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      className={`plana-set-chip ${settings.appearance.theme === theme ? "is-active" : ""}`}
                      onClick={() => patch({ appearance: { theme } })}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
                <Field label="Accent">
                  <input
                    type="color"
                    value={settings.appearance.accent}
                    onChange={(e) => patch({ appearance: { accent: e.target.value } })}
                  />
                </Field>
                <Field label="UI scale">
                  <input
                    type="range"
                    min={0.85}
                    max={1.25}
                    step={0.05}
                    value={settings.appearance.uiScale}
                    onChange={(e) => patch({ appearance: { uiScale: Number(e.target.value) } })}
                  />
                  <span>{Math.round(settings.appearance.uiScale * 100)}%</span>
                </Field>
              </>
            )}
            {section === "canvas" && (
              <>
                <h3>Viewport</h3>
                <Field label="Show grid">
                  <input
                    type="checkbox"
                    checked={settings.canvas.showGrid}
                    onChange={(e) => patch({ canvas: { showGrid: e.target.checked } })}
                  />
                </Field>
                <Field label="Show axes">
                  <input
                    type="checkbox"
                    checked={settings.canvas.showAxes}
                    onChange={(e) => patch({ canvas: { showAxes: e.target.checked } })}
                  />
                </Field>
                <Field label="Show hint">
                  <input
                    type="checkbox"
                    checked={settings.canvas.showHint}
                    onChange={(e) => patch({ canvas: { showHint: e.target.checked } })}
                  />
                </Field>
                <Field label="Background">
                  <input
                    type="color"
                    value={settings.canvas.background}
                    onChange={(e) => patch({ canvas: { background: e.target.value } })}
                  />
                </Field>
                <Field label="Grid size">
                  <input
                    type="number"
                    min={4}
                    value={settings.canvas.gridSize}
                    onChange={(e) => patch({ canvas: { gridSize: Number(e.target.value) } })}
                  />
                </Field>
                <h3>Navigation</h3>
                <Field label="Zoom step">
                  <input
                    type="range"
                    min={0.3}
                    max={3}
                    step={0.1}
                    value={settings.canvas.zoomSpeed}
                    onChange={(e) => patch({ canvas: { zoomSpeed: Number(e.target.value) } })}
                  />
                  <span>{settings.canvas.zoomSpeed.toFixed(1)}×</span>
                </Field>
                <Field label="Orbit speed">
                  <input
                    type="range"
                    min={0.3}
                    max={3}
                    step={0.1}
                    value={settings.canvas.rotateSpeed}
                    onChange={(e) => patch({ canvas: { rotateSpeed: Number(e.target.value) } })}
                  />
                </Field>
                <Field label="Pan speed">
                  <input
                    type="range"
                    min={0.3}
                    max={3}
                    step={0.1}
                    value={settings.canvas.panSpeed}
                    onChange={(e) => patch({ canvas: { panSpeed: Number(e.target.value) } })}
                  />
                </Field>
                <Field label="Inertia">
                  <input
                    type="checkbox"
                    checked={settings.canvas.damping}
                    onChange={(e) => patch({ canvas: { damping: e.target.checked } })}
                  />
                </Field>
                <h3>Positioning</h3>
                <Field label="Snap to grid">
                  <input
                    type="checkbox"
                    checked={settings.canvas.snapToGrid}
                    onChange={(e) => patch({ canvas: { snapToGrid: e.target.checked } })}
                  />
                </Field>
                <Field label="Nudge (mm)">
                  <input
                    type="number"
                    min={0.1}
                    value={settings.canvas.nudgeMm}
                    onChange={(e) => patch({ canvas: { nudgeMm: Number(e.target.value) } })}
                  />
                </Field>
                <Field label="Shift nudge (mm)">
                  <input
                    type="number"
                    min={1}
                    value={settings.canvas.nudgeShiftMm}
                    onChange={(e) => patch({ canvas: { nudgeShiftMm: Number(e.target.value) } })}
                  />
                </Field>
              </>
            )}
            {section === "hatch" && (
              <>
                <h3>All types</h3>
                <p className="plana-set-note">
                  World hatch applies to every object unless a type override is on.
                </p>
                <HatchFields
                  rule={settings.hatch.world}
                  onChange={(next) => patch({ hatch: { world: next } })}
                />
                <h3>By type</h3>
                <div className="plana-set-row wrap">
                  {HATCH_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`plana-set-chip ${hatchType === type ? "is-active" : ""} ${settings.hatch.types[type]?.enabled ? "is-on" : ""}`}
                      onClick={() => setHatchType(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <HatchFields
                  rule={typeRule}
                  onChange={(next) =>
                    patch({
                      hatch: {
                        types: {
                          [hatchType]: { ...typeRule, ...next },
                        },
                      },
                    })
                  }
                />
              </>
            )}
            {section === "shortcuts" && (
              <>
                <h3>Keyboard</h3>
                <p className="plana-set-note">Click a row, then press the new combination.</p>
                {SHORTCUT_META.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`plana-set-bind ${capturing === item.id ? "is-active" : ""}`}
                    onClick={() => setCapturing(item.id)}
                  >
                    <span>
                      <strong>{item.label}</strong>
                      <em>{item.group}</em>
                    </span>
                    <kbd>{capturing === item.id ? "Press keys…" : formatShortcut(settings.shortcuts[item.id])}</kbd>
                  </button>
                ))}
              </>
            )}
            <button type="button" className="plana-set-reset" onClick={() => reset()}>
              Reset to defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function applyEditorChrome(root: HTMLElement | null, settings: ProjectSettings) {
  if (!root) return;
  root.dataset.theme = settings.appearance.theme;
  root.style.setProperty("--ui-scale", String(settings.appearance.uiScale));
  root.style.setProperty("--ring", settings.appearance.accent);
  root.style.fontSize = `${13 * settings.appearance.uiScale}px`;
}
