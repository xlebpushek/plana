"use client";

import { useRef, useState } from "react";
import { useUnit } from "effector-react";
import {
  Box as BoxIcon,
  BrickWall,
  Copy,
  Cylinder as CylinderIcon,
  Download,
  Folder,
  Plus,
  Redo2,
  SquareStack,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";

import { serializePretty } from "@plana/core";

import {
  $canRedo,
  $canUndo,
  $document,
  $selectedId,
  addPrimitive,
  copySelected,
  deleteSelected,
  duplicateSelected,
  importJson,
  redo,
  undo,
} from "../model/scene";
import { useEditor } from "./context";
import { useViewerScope } from "../viewer/ViewerProvider";

export function HistoryButtons() {
  useViewerScope();
  useEditor();
  const canUndo = useUnit($canUndo);
  const canRedo = useUnit($canRedo);
  const selectedId = useUnit($selectedId);
  const document = useUnit($document);
  const runUndo = useUnit(undo);
  const runRedo = useUnit(redo);
  const runDelete = useUnit(deleteSelected);
  const runDuplicate = useUnit(duplicateSelected);
  const runCopy = useUnit(copySelected);

  return (
    <>
      <button
        type="button"
        className="plana-icon-btn"
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        onClick={() => runUndo()}
      >
        <Undo2 size={17} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className="plana-icon-btn"
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
        onClick={() => runRedo()}
      >
        <Redo2 size={17} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className="plana-icon-btn"
        disabled={!selectedId || selectedId === document.root}
        title="Duplicate (Ctrl+D)"
        aria-label="Duplicate"
        onClick={() => runDuplicate()}
      >
        <SquareStack size={17} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className="plana-icon-btn"
        disabled={!selectedId || selectedId === document.root}
        title="Copy (Ctrl+C)"
        aria-label="Copy"
        onClick={() => runCopy()}
      >
        <Copy size={17} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className="plana-icon-btn plana-icon-btn--danger"
        disabled={!selectedId || selectedId === document.root}
        title="Delete (Del)"
        aria-label="Delete"
        onClick={() => runDelete()}
      >
        <Trash2 size={17} strokeWidth={1.8} />
      </button>
    </>
  );
}

export function ImportExportButtons() {
  useViewerScope();
  useEditor();
  const document = useUnit($document);
  const runImport = useUnit(importJson);

  const exportJson = () => {
    const blob = new Blob([serializePretty(document)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = "plana-scene.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <label className="plana-icon-btn" title="Import JSON">
        <Upload size={17} strokeWidth={1.8} />
        <input
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            runImport(await file.text());
            event.target.value = "";
          }}
        />
      </label>
      <button
        type="button"
        className="plana-icon-btn"
        title="Export JSON"
        aria-label="Export"
        onClick={exportJson}
      >
        <Download size={17} strokeWidth={1.8} />
      </button>
    </>
  );
}

export function CreateObjectButton() {
  useViewerScope();
  useEditor();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const add = useUnit(addPrimitive);

  return (
    <div className="plana-create" ref={rootRef}>
      {open && (
        <div className="plana-create-sheet">
          <button type="button" onClick={() => { add("box"); setOpen(false); }}>
            <BoxIcon size={16} strokeWidth={1.8} />
            Box
          </button>
          <button type="button" onClick={() => { add("wall"); setOpen(false); }}>
            <BrickWall size={16} strokeWidth={1.8} />
            Wall
          </button>
          <button type="button" onClick={() => { add("cylinder"); setOpen(false); }}>
            <CylinderIcon size={16} strokeWidth={1.8} />
            Cylinder
          </button>
          <button type="button" onClick={() => { add("group"); setOpen(false); }}>
            <Folder size={16} strokeWidth={1.8} />
            Group
          </button>
        </div>
      )}
      <button
        type="button"
        className={`plana-fab ${open ? "is-active" : ""}`}
        title="Add object"
        aria-label="Add object"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus size={20} strokeWidth={2} />
      </button>
    </div>
  );
}
