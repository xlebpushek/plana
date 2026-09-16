import { useEffect, useMemo, useState } from "react";

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

function useIsMobile(breakpoint = 900) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [breakpoint]);
  return mobile;
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

  const mobile = useIsMobile();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [selectedIds, setSelectedIds] = useState<ObjectId[]>([]);
  const selectedId = selectedIds[0];
  const selected = selectedId ? document.objects[selectedId] : undefined;

  useEffect(() => {
    if (mobile) {
      setLeftOpen(false);
      setRightOpen(false);
    } else {
      setLeftOpen(true);
      setRightOpen(true);
    }
  }, [mobile]);

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
      transform: { ...identityTransform(), position: [0, 0, 0] },
      geometry: { type: "box", size },
      metadata: { name: type },
    });
    setDocument(next);
    setSelectedIds([id]);
    if (mobile) setRightOpen(true);
  };

  const selectObject = (id?: ObjectId) => {
    setSelectedIds(id ? [id] : []);
    if (mobile && id) {
      setRightOpen(true);
      setLeftOpen(false);
    }
  };

  const euler = selected ? eulerDegFromQuat(selected.transform.rotation) : [0, 0, 0];

  return (
    <div
      className={[
        "plana-editor",
        mobile ? "is-mobile" : "is-desktop",
        leftOpen ? "left-open" : "",
        rightOpen ? "right-open" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="plana-topbar">
        <div className="plana-brand">
          <button
            type="button"
            className="plana-icon-btn"
            aria-label="Toggle hierarchy"
            onClick={() => setLeftOpen((v) => !v)}
          >
            ☰
          </button>
          <div className="plana-brand-text">
            <span className="plana-mark">Plana</span>
            <span className="plana-subtitle">Apartment · 33 m²</span>
          </div>
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
          <button type="button" onClick={() => addFurniture("smart-switch", [80, 30, 120])}>
            Switch
          </button>
          <div className="plana-sep" />
          <button
            type="button"
            className="plana-btn-danger"
            disabled={!selectedId || selectedId === document.root}
            onClick={() => {
              if (!selectedId) return;
              setDocument(removeObject(document, selectedId));
              setSelectedIds([]);
            }}
          >
            Delete
          </button>
          <button type="button" className="plana-btn-primary" onClick={exportJson}>
            Export
          </button>
        </div>

        <button
          type="button"
          className="plana-icon-btn"
          aria-label="Toggle inspector"
          onClick={() => setRightOpen((v) => !v)}
        >
          ≡
        </button>
      </header>

      <div className="plana-layout">
        {(leftOpen || !mobile) && (
          <aside className={`plana-panel plana-panel--left ${leftOpen ? "is-open" : "is-collapsed"}`}>
            <div className="plana-panel__title">
              <span>Hierarchy</span>
              {mobile && (
                <button type="button" className="plana-icon-btn" onClick={() => setLeftOpen(false)}>
                  ✕
                </button>
              )}
            </div>
            <div className="plana-tree">
              {rows.map(({ object, depth }) => (
                <button
                  key={object.id}
                  type="button"
                  className={selectedIds.includes(object.id) ? "is-active" : undefined}
                  style={{ paddingLeft: 10 + depth * 12 }}
                  onClick={() => selectObject(object.id)}
                >
                  <span className="plana-type">{object.type}</span>
                  <span className="plana-tree-name">{objectName(object)}</span>
                </button>
              ))}
            </div>
          </aside>
        )}

        {mobile && leftOpen && (
          <button type="button" className="plana-backdrop" aria-label="Close" onClick={() => setLeftOpen(false)} />
        )}

        <main className="plana-viewport">
          <PlanaViewer
            document={document}
            selectedIds={selectedIds}
            activeId={selectedId}
            onSelect={selectObject}
          />
          <div className="plana-hint">
            <span className="plana-hint-desktop">Orbit · pan · zoom · click to select</span>
            <span className="plana-hint-mobile">1 finger orbit · pinch zoom · tap select</span>
          </div>
        </main>

        {mobile && rightOpen && (
          <button type="button" className="plana-backdrop" aria-label="Close" onClick={() => setRightOpen(false)} />
        )}

        {(rightOpen || !mobile) && (
          <aside className={`plana-panel plana-panel--right ${rightOpen ? "is-open" : "is-collapsed"}`}>
            <div className="plana-panel__title">
              <span>Inspector</span>
              {mobile && (
                <button type="button" className="plana-icon-btn" onClick={() => setRightOpen(false)}>
                  ✕
                </button>
              )}
            </div>
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
                <div className="plana-section-label">Position (mm)</div>
                <div className="plana-grid3">
                  {(["X", "Y", "Z"] as const).map((axis, index) => (
                    <label key={axis}>
                      {axis}
                      <input
                        type="number"
                        inputMode="numeric"
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
                <div className="plana-section-label">Rotation (°)</div>
                <div className="plana-grid3">
                  {(["X", "Y", "Z"] as const).map((axis, index) => (
                    <label key={axis}>
                      {axis}
                      <input
                        type="number"
                        inputMode="numeric"
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
                  <>
                    <div className="plana-section-label">Size (mm)</div>
                    <div className="plana-grid3">
                      {(["W", "D", "H"] as const).map((axis, index) => {
                        const geo = selected.geometry;
                        if (geo?.type !== "box") return null;
                        return (
                          <label key={axis}>
                            {axis}
                            <input
                              type="number"
                              inputMode="numeric"
                              value={Math.round(geo.size[index])}
                              onChange={(event) => {
                                const size = [...geo.size] as [number, number, number];
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
                  </>
                )}
              </div>
            ) : (
              <p className="plana-muted">Select an object to edit properties.</p>
            )}
          </aside>
        )}
      </div>

      <footer className="plana-statusbar">
        <span>mm</span>
        <span>{Object.keys(document.objects).length} objects</span>
        <span className="plana-status-selected">{selected ? objectName(selected) : "nothing selected"}</span>
      </footer>
    </div>
  );
}
