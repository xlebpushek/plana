"use client";

import { useEffect, type ReactNode } from "react";
import { useUnit } from "effector-react";

import { EditorContext } from "./context";
import { SettingsModal, applyEditorChrome } from "./Settings";
import { deleteSelected, frameScene, nudgeSelected, redo, undo } from "../model/scene";
import {
  $settings,
  $settingsOpen,
  eventMatchesShortcut,
  openSettings,
  patchSettings,
} from "../model/settings";
import { useViewerScope } from "../viewer/ViewerProvider";

export function EditorProvider({ children }: { children: ReactNode }) {
  useViewerScope();
  const runUndo = useUnit(undo);
  const runRedo = useUnit(redo);
  const runDelete = useUnit(deleteSelected);
  const runFrame = useUnit(frameScene);
  const runNudge = useUnit(nudgeSelected);
  const settings = useUnit($settings);
  const settingsOpen = useUnit($settingsOpen);
  const setOpen = useUnit(openSettings);
  const patch = useUnit(patchSettings);

  useEffect(() => {
    applyEditorChrome(document.querySelector(".plana-editor"), settings);
  }, [settings]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing) return;
      const map = settings.shortcuts;
      if (eventMatchesShortcut(event, map.settings)) {
        event.preventDefault();
        setOpen(!settingsOpen);
        return;
      }
      if (settingsOpen) return;
      if (eventMatchesShortcut(event, map.undo)) {
        event.preventDefault();
        runUndo();
        return;
      }
      if (eventMatchesShortcut(event, map.redo)) {
        event.preventDefault();
        runRedo();
        return;
      }
      if (eventMatchesShortcut(event, map.delete)) {
        event.preventDefault();
        runDelete();
        return;
      }
      if (eventMatchesShortcut(event, map.frame)) {
        event.preventDefault();
        runFrame();
        return;
      }
      if (eventMatchesShortcut(event, map.grid)) {
        event.preventDefault();
        patch({ canvas: { showGrid: !settings.canvas.showGrid } });
        return;
      }
      if (eventMatchesShortcut(event, map.hatch)) {
        event.preventDefault();
        patch({ hatch: { world: { enabled: !settings.hatch.world.enabled } } });
        return;
      }
      if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? settings.canvas.nudgeShiftMm : settings.canvas.nudgeMm;
        const delta = { dx: 0, dy: 0, dz: 0 };
        if (event.key === "ArrowLeft") delta.dx = -step;
        if (event.key === "ArrowRight") delta.dx = step;
        if (event.key === "ArrowUp") delta.dy = step;
        if (event.key === "ArrowDown") delta.dy = -step;
        if (settings.canvas.snapToGrid) {
          const g = 100;
          delta.dx = Math.round(delta.dx / g) * g || Math.sign(delta.dx) * g;
          delta.dy = Math.round(delta.dy / g) * g || Math.sign(delta.dy) * g;
        }
        runNudge(delta);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [patch, runDelete, runFrame, runNudge, runRedo, runUndo, setOpen, settings, settingsOpen]);

  return (
    <EditorContext.Provider value={true}>
      {children}
      <SettingsModal />
    </EditorContext.Provider>
  );
}
