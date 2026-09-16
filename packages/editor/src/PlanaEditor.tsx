import { useMemo, useState } from "react";

import {
  addObject,
  createDocument,
  eulerDegFromQuat,
  identityTransform,
  quatFromEulerDeg,
  removeObject,
  serializePretty,
  traverseObjects,
  updateObject,
  type ObjectId,
  type PlanaDocument,
  type PlanaObject,
} from "@plana/core";
import { PlanaViewer } from "@plana/viewer";

export type PlanaEditorProps = {
  document?: PlanaDocument;
  onChange?: (document: PlanaDocument) => void;
  className?: string;
};

function objectName(object: PlanaObject) {
  return String(object.metadata?.name ?? object.id);
}

export function PlanaEditor({
  document: controlled,
  onChange,
  className,
}: PlanaEditorProps) {
  const [internal, setInternal] = useState<PlanaDocument>(() => controlled ?? createDocument());
  const document = controlled ?? internal;
  const setDocument = (next: PlanaDocument) => {
    if (onChange) onChange(next);
    else setInternal(next);
  };

  const [selectedIds, setSelectedIds] = useState<ObjectId[]>([]);
  const selectedId = selectedIds[0];
  const selected = selectedId ? document.objects[selectedId] : undefined;

  const rows = useMemo(() => {
    const list: Array<{ object: PlanaObject; depth: number }> = [];
    traverseObjects(document, (object, depth) => {
      if (object.id === document.root) return;
      list.push({ object, depth: Math.max(0, depth - 1) });
    });
    return list;
  }, [document]);

  const exportJson = () => {
    const blob = new Blob([serializePretty(document)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = "plana-scene.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const addFurniture = (type: string, size: [number, number, number]) => {
    const id = `${type}-${Math.random().toString(36).slice(2, 7)}`;
    const next = addObject(document, {
      id,
      type,
      transform: {
        ...identityTransform(),
        position: [0, 0, 0],
      },
      geometry: { type: "box", size },
      metadata: { name: type },
    });
    setDocument(next);
    setSelectedIds([id]);
  };

  const euler = selected ? eulerDegFromQuat(selected.transform.rotation) : [0, 0, 0];

  return (
    <div className={["plana-editor", className].filter(Boolean).join(" ")}>
      <header className="plana-topbar">
        <div className="plana-brand">
          <span className="plana-mark">Plana</span>
          <span className="plana-subtitle">3D apartment planning</span>
        </div>
        <div className="plana-toolbar">
          <button type="button" onClick={() => addFurniture("sofa", [2200, 900, 750])}>
            Sofa
          </button>
          <button type="button" onClick={() => addFurniture("table", [1200, 700, 750])}>
            Table
          </button>
          <button type="button" onClick={() => addFurniture("chair", [450, 450, 900])}>
            Chair
          </button>
          <button type="button" onClick={() => addFurniture("bed", [2000, 1600, 550])}>
            Bed
          </button>
          <button
            type="button"
            onClick={() => addFurniture("smart-switch", [80, 30, 120])}
          >
            Switch
          </button>
          <div className="plana-sep" />
          <button
            type="button"
            disabled={!selectedId || selectedId === document.root}
            onClick={() => {
              if (!selectedId) return;
              setDocument(removeObject(document, selectedId));
              setSelectedIds([]);
            }}
          >
            Delete
          </button>
          <button type="button" onClick={exportJson}>
            Export JSON
          </button>
        </div>
      </header>

      <div className="plana-layout">
        <aside className="plana-panel">
          <div className="plana-panel__title">Hierarchy</div>
          <div className="plana-tree">
            {rows.map(({ object, depth }) => (
              <button
                key={object.id}
                type="button"
                className={selectedIds.includes(object.id) ? "is-active" : undefined}
                style={{ paddingLeft: 10 + depth * 12 }}
                onClick={() => setSelectedIds([object.id])}
              >
                <span className="plana-type">{object.type}</span>
                <span>{objectName(object)}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="plana-viewport">
          <PlanaViewer
            document={document}
            selectedIds={selectedIds}
            activeId={selectedId}
            onSelect={(id) => setSelectedIds(id ? [id] : [])}
          />
          <div className="plana-hint">
            Orbit · drag · scroll zoom · click to select
          </div>
        </main>

        <aside className="plana-panel plana-panel--right">
          <div className="plana-panel__title">Inspector</div>
          {selected ? (
            <div className="plana-inspector">
              <label>
                Name
                <input
                  value={objectName(selected)}
                  onChange={(event) =>
                    setDocument(
                      updateObject(document, selected.id, {
                        metadata: { ...selected.metadata, name: event.target.value },
                      }),
                    )
                  }
                />
              </label>
              <label>
                Type
                <input value={selected.type} readOnly />
              </label>
              <div className="plana-grid3">
                {(["X", "Y", "Z"] as const).map((axis, index) => (
                  <label key={axis}>
                    Pos {axis}
                    <input
                      type="number"
                      value={Math.round(selected.transform.position[index])}
                      onChange={(event) => {
                        const position = [...selected.transform.position] as [
                          number,
                          number,
                          number,
                        ];
                        position[index] = Number(event.target.value);
                        setDocument(
                          updateObject(document, selected.id, {
                            transform: { ...selected.transform, position },
                          }),
                        );
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className="plana-grid3">
                {(["X", "Y", "Z"] as const).map((axis, index) => (
                  <label key={axis}>
                    Rot {axis}
                    <input
                      type="number"
                      value={Math.round(euler[index])}
                      onChange={(event) => {
                        const next = [...euler] as [number, number, number];
                        next[index] = Number(event.target.value);
                        setDocument(
                          updateObject(document, selected.id, {
                            transform: {
                              ...selected.transform,
                              rotation: quatFromEulerDeg(next[0], next[1], next[2]),
                            },
                          }),
                        );
                      }}
                    />
                  </label>
                ))}
              </div>
              {selected.geometry?.type === "box" && (
                <div className="plana-grid3">
                  {(["W", "D", "H"] as const).map((axis, index) => {
                    const box = selected.geometry;
                    if (box?.type !== "box") return null;
                    return (
                      <label key={axis}>
                        {axis}
                        <input
                          type="number"
                          value={Math.round(box.size[index])}
                          onChange={(event) => {
                            const size = [...box.size] as [number, number, number];
                            size[index] = Number(event.target.value);
                            setDocument(
                              updateObject(document, selected.id, {
                                geometry: { type: "box", size },
                              }),
                            );
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="plana-muted">Select an object in the hierarchy or viewport.</p>
          )}
        </aside>
      </div>

      <footer className="plana-statusbar">
        <span>units: mm</span>
        <span>objects: {Object.keys(document.objects).length}</span>
        <span>selected: {selectedId ?? "—"}</span>
      </footer>
    </div>
  );
}
