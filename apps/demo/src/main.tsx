import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { PlanaEditor } from "@plana/editor";
import { cloneDocument, PlanaViewer, type PlanaDocument } from "@plana/viewer";

import { createApartmentSample } from "./sample";

import "@plana/editor/styles.css";
import "./app.css";

type Mode = "editor" | "viewer";

function App() {
  const initial = useMemo(() => createApartmentSample(), []);
  const [doc, setDoc] = useState<PlanaDocument>(initial);
  const [mode, setMode] = useState<Mode>("editor");
  const [selectedId, setSelectedId] = useState<string | undefined>("living");

  return (
    <div className="app">
      <div className="app-switcher">
        <button
          type="button"
          className={mode === "editor" ? "is-active" : undefined}
          onClick={() => setMode("editor")}
        >
          Editor
        </button>
        <button
          type="button"
          className={mode === "viewer" ? "is-active" : undefined}
          onClick={() => setMode("viewer")}
        >
          Viewer
        </button>
        <button type="button" onClick={() => setDoc(createApartmentSample())}>
          Reset sample
        </button>
      </div>

      {mode === "editor" ? (
        <PlanaEditor document={doc} onChange={setDoc} />
      ) : (
        <div className="viewer-shell">
          <header className="viewer-header">
            <strong>Plana Viewer</strong>
            <span>{doc.name}</span>
            <span className="muted">pan: Shift/RMB · zoom: wheel · click to focus</span>
          </header>
          <PlanaViewer
            className="viewer-canvas"
            document={doc}
            selectedIds={selectedId ? [selectedId] : []}
            onSelect={(id) => setSelectedId(id)}
            onCameraChange={(camera) => setDoc((current) => ({ ...cloneDocument(current), camera }))}
          />
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
