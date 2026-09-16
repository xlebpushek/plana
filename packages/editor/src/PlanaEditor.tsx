import { useEffect, useMemo, useRef, useState } from "react";

import {
  addObject,
  createDocument,
  createId,
  eulerDegFromQuat,
  identityTransform,
  quatFromEulerDeg,
  removeObject,
  serializePretty,
  deserialize,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<ObjectId[]>([]);
  const selectedId = selectedIds[0];
  const selected = selectedId ? document.objects[selectedId] : undefined;

  useEffect(() => {
    if (mobile) {
      setLeftOpen(false);
      setRightOpen(false);
      setMenuOpen(false);
    } else {
      setLeftOpen(true);
      setRightOpen(true);
      setMenuOpen(false);
    }
  }, [mobile]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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

  const addPrimitive = (kind: "box" | "wall" | "cylinder" | "group") => {
    const id = createId(kind);
    if (kind === "group") {
      setDocument(
        addObject(document, {
          id,
          type: "group",
          transform: identityTransform(),
          children: [],
          metadata: { name: id },
        }),
      );
      setSelectedIds([id]);
      return;
    }
    if (kind === "wall") {
      setDocument(
        addObject(document, {
          id,
          type: "wall",
          transform: identityTransform(),
          geometry: {
            type: "wall",
            path: {
              type: "polyline",
              points: [
                [0, 0, 0],
                [2000, 0, 0],
              ],
              closed: false,
            },
            thickness: 150,
            height: { start: 2700, end: 2700 },
            baseZ: 0,
          },
          metadata: { name: id },
        }),
      );
      setSelectedIds([id]);
      return;
    }
    if (kind === "cylinder") {
      setDocument(
        addObject(document, {
          id,
          type: "object",
          transform: { ...identityTransform(), position: [0, 0, 0] },
          geometry: { type: "cylinder", radius: 200, height: 800, radialSegments: 24 },
          metadata: { name: id },
        }),
      );
      setSelectedIds([id]);
      return;
    }
    setDocument(
      addObject(document, {
        id,
        type: "object",
        transform: { ...identityTransform(), position: [0, 0, 0] },
        geometry: { type: "box", size: [1000, 1000, 1000] },
        metadata: { name: id },
      }),
    );
    setSelectedIds([id]);
  };

  const selectObject = (id?: ObjectId) => {
    setSelectedIds(id ? [id] : []);
  };

  const deleteSelected = () => {
    if (!selectedId || selectedId === document.root) return;
    setDocument(removeObject(document, selectedId));
    setSelectedIds([]);
  };

  const importFile = async (file: File) => {
    const text = await file.text();
    setDocument(deserialize(text));
    setSelectedIds([]);
  };

  const closeDrawers = () => {
    setLeftOpen(false);
    setRightOpen(false);
    setMenuOpen(false);
  };

  const euler = selected ? eulerDegFromQuat(selected.transform.rotation) : [0, 0, 0];

  const toolActions = (
    <>
      <button
        type="button"
        onClick={() => {
          addPrimitive("box");
          setMenuOpen(false);
        }}
      >
        Box
      </button>
      <button
        type="button"
        onClick={() => {
          addPrimitive("wall");
          setMenuOpen(false);
        }}
      >
        Wall
      </button>
      <button
        type="button"
        onClick={() => {
          addPrimitive("cylinder");
          setMenuOpen(false);
        }}
      >
        Cylinder
      </button>
      <button
        type="button"
        onClick={() => {
          addPrimitive("group");
          setMenuOpen(false);
        }}
      >
        Group
      </button>
      <div className="plana-sep" />
      <button
        type="button"
        className="plana-btn-danger"
        disabled={!selectedId || selectedId === document.root}
        onClick={() => {
          deleteSelected();
          setMenuOpen(false);
        }}
      >
        Delete
      </button>
      <label className="plana-file-btn">
        Import
        <input
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            await importFile(file);
            setMenuOpen(false);
            event.target.value = "";
          }}
        />
      </label>
      <button
        type="button"
        className="plana-btn-primary"
        onClick={() => {
          exportJson();
          setMenuOpen(false);
        }}
      >
        Export
      </button>
    </>
  );

  return (
    <div
      className={[
        "plana-editor",
        mobile ? "is-mobile" : "is-desktop",
        leftOpen ? "left-open" : "",
        rightOpen ? "right-open" : "",
        menuOpen ? "menu-open" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="plana-topbar">
        <div className="plana-topbar-start">
          <button
            type="button"
            className={`plana-icon-btn ${leftOpen ? "is-active" : ""}`}
            aria-label="Hierarchy"
            aria-pressed={leftOpen}
            onClick={() => {
              setLeftOpen((v) => !v);
              if (mobile) {
                setRightOpen(false);
                setMenuOpen(false);
              }
            }}
          >
            <span className="plana-ico" aria-hidden>
              ☰
            </span>
          </button>
          <div className="plana-brand-text">
            <span className="plana-mark">Plana</span>
            <span className="plana-subtitle">Scene editor</span>
          </div>
        </div>

        <div className="plana-toolbar plana-toolbar--desktop">{toolActions}</div>

        <div className="plana-topbar-end" ref={menuRef}>
          <button
            type="button"
            className={`plana-icon-btn plana-menu-btn ${menuOpen ? "is-active" : ""}`}
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen((v) => !v);
              if (mobile) {
                setLeftOpen(false);
                setRightOpen(false);
              }
            }}
          >
            <span className="plana-ico" aria-hidden>
              ···
            </span>
          </button>
          {menuOpen && <div className="plana-menu-sheet">{toolActions}</div>}
          <button
            type="button"
            className={`plana-icon-btn ${rightOpen ? "is-active" : ""}`}
            aria-label="Inspector"
            aria-pressed={rightOpen}
            onClick={() => {
              setRightOpen((v) => !v);
              if (mobile) {
                setLeftOpen(false);
                setMenuOpen(false);
              }
            }}
          >
            <span className="plana-ico" aria-hidden>
              ≡
            </span>
          </button>
        </div>
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
                  onClick={() => {
                    selectObject(object.id);
                    if (mobile) setLeftOpen(false);
                  }}
                >
                  <span className="plana-type">{object.type}</span>
                  <span className="plana-tree-name">{objectName(object)}</span>
                </button>
              ))}
            </div>
          </aside>
        )}

        {mobile && (leftOpen || rightOpen) && (
          <button type="button" className="plana-backdrop" aria-label="Close" onClick={closeDrawers} />
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
                  <input
                    value={selected.type}
                    onChange={(event) =>
                      setDocument(
                        updateObject(document, selected.id, {
                          type: event.target.value || "object",
                        }),
                      )
                    }
                  />
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
        <span className="plana-status-count">{Object.keys(document.objects).length} objects</span>
        <span className="plana-status-selected">{selected ? objectName(selected) : "nothing selected"}</span>
      </footer>
    </div>
  );
}
