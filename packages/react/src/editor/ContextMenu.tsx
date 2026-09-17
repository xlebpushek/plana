"use client";

import { useEffect } from "react";
import { useUnit } from "effector-react";
import {
  ClipboardPaste,
  Copy,
  Frame,
  Scissors,
  Settings,
  SquareStack,
  Trash2,
} from "lucide-react";

import {
  $clipboard,
  $document,
  $selectedId,
  copySelected,
  cutSelected,
  deleteSelected,
  duplicateSelected,
  frameScene,
  pasteClipboard,
} from "../model/scene";
import { $settings, formatShortcut, openSettings } from "../model/settings";

export type ContextMenuState = { x: number; y: number } | null;

export function ContextMenu({
  menu,
  onClose,
}: {
  menu: ContextMenuState;
  onClose: () => void;
}) {
  const document = useUnit($document);
  const selectedId = useUnit($selectedId);
  const clipboard = useUnit($clipboard);
  const shortcuts = useUnit($settings).shortcuts;
  const runCopy = useUnit(copySelected);
  const runCut = useUnit(cutSelected);
  const runPaste = useUnit(pasteClipboard);
  const runDuplicate = useUnit(duplicateSelected);
  const runDelete = useUnit(deleteSelected);
  const runFrame = useUnit(frameScene);
  const setSettings = useUnit(openSettings);

  useEffect(() => {
    if (!menu) return;
    const close = () => onClose();
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [menu, onClose]);

  if (!menu) return null;
  const canEdit = Boolean(selectedId && selectedId !== document.root);

  const run = (fn: () => void) => (event: { preventDefault: () => void; stopPropagation: () => void }) => {
    event.preventDefault();
    event.stopPropagation();
    fn();
    onClose();
  };

  return (
    <div
      className="plana-context"
      style={{ left: menu.x, top: menu.y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button type="button" disabled={!canEdit} onClick={run(() => runDuplicate())}>
        <SquareStack size={14} strokeWidth={1.8} />
        Duplicate
        <span>{formatShortcut(shortcuts.duplicate)}</span>
      </button>
      <button type="button" disabled={!canEdit} onClick={run(() => runCopy())}>
        <Copy size={14} strokeWidth={1.8} />
        Copy
        <span>{formatShortcut(shortcuts.copy)}</span>
      </button>
      <button type="button" disabled={!clipboard} onClick={run(() => runPaste())}>
        <ClipboardPaste size={14} strokeWidth={1.8} />
        Paste
        <span>{formatShortcut(shortcuts.paste)}</span>
      </button>
      <button type="button" disabled={!canEdit} onClick={run(() => runCut())}>
        <Scissors size={14} strokeWidth={1.8} />
        Cut
        <span>{formatShortcut(shortcuts.cut)}</span>
      </button>
      <button type="button" disabled={!canEdit} onClick={run(() => runDelete())}>
        <Trash2 size={14} strokeWidth={1.8} />
        Delete
        <span>{formatShortcut(shortcuts.delete)}</span>
      </button>
      <div className="plana-context-sep" />
      <button type="button" onClick={run(() => runFrame())}>
        <Frame size={14} strokeWidth={1.8} />
        Frame
        <span>{formatShortcut(shortcuts.frame)}</span>
      </button>
      <button type="button" onClick={run(() => setSettings(true))}>
        <Settings size={14} strokeWidth={1.8} />
        Settings
        <span>{formatShortcut(shortcuts.settings)}</span>
      </button>
    </div>
  );
}
