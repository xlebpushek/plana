import { useEffect, useMemo, useRef, useState } from "react";

import {
  addObject,
  createBoxObject,
  createDocument,
  createId,
  createWallObject,
  eulerDegFromQuat,
  identityTransform,
  quatFromEulerDeg,
  removeObject,
  serializePretty,
  deserialize,
  updateObject,
  type ObjectId,
  type PlanaDocument,
  type PlanaObject,
} from "@plana/core";
import { PlanaViewer } from "@plana/viewer";
import {
  Box as BoxIcon,
  BrickWall,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Cylinder as CylinderIcon,
  Download,
  Folder,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";

export type PlanaEditorProps = {
  document?: PlanaDocument;
  onChange?: (document: PlanaDocument) => void;
  className?: string;
};

const HISTORY_LIMIT = 100;

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

function cloneDocument(document: PlanaDocument): PlanaDocument {
  return structuredClone(document);
}

/** Open the outermost group only, so a large scene stays readable on load. */
function initialCollapsed(document: PlanaDocument): Set<ObjectId> {
  const collapsed = new Set<ObjectId>();
  const walk = (id: ObjectId, depth: number) => {
    const object = document.objects[id];
    const children = object?.children ?? [];
    if (children.length === 0) return;
    if (depth >= 1) collapsed.add(id);
    for (const child of children) walk(child, depth + 1);
  };
  for (const child of document.objects[document.root]?.children ?? []) walk(child, 0);
  return collapsed;
}

export function PlanaEditor({
  document: controlled,
  onChange,
  className,
}: PlanaEditorProps) {
  const [internal, setInternal] = useState<PlanaDocument>(() => controlled ?? createDocument());
  const document = controlled ?? internal;
  const documentRef = useRef(document);
  documentRef.current = document;

  const pastRef = useRef<PlanaDocument[]>([]);
  const futureRef = useRef<PlanaDocument[]>([]);
  const [historyTick, setHistoryTick] = useState(0);

  const publish = (next: PlanaDocument) => {
    if (onChange) onChange(next);
    else setInternal(next);
  };

  const publishRef = useRef(publish);
  publishRef.current = publish;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  /** Commit a user edit onto the undo stack. */
  const commitDocument = (next: PlanaDocument) => {
    pastRef.current.push(cloneDocument(documentRef.current));
    if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift();
    futureRef.current = [];
    publishRef.current(next);
    setHistoryTick((n) => n + 1);
  };

  const undo = () => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current.push(cloneDocument(documentRef.current));
    publishRef.current(prev);
    setHistoryTick((n) => n + 1);
  };

  const redo = () => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(cloneDocument(documentRef.current));
    publishRef.current(next);
    setHistoryTick((n) => n + 1);
  };

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;
  void historyTick;

  const mobile = useIsMobile();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<ObjectId>>(() =>
    initialCollapsed(documentRef.current),
  );
  const [focusKey, setFocusKey] = useState(0);
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
    setAddOpen(false);
  }, [mobile]);

  useEffect(() => {
    if (!addOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!addRef.current?.contains(event.target as Node)) setAddOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAddOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [addOpen]);

  type TreeRow = { object: PlanaObject; depth: number; childCount: number };

  const rows = useMemo(() => {
    const list: TreeRow[] = [];
    const walk = (id: ObjectId, depth: number) => {
      const object = document.objects[id];
      if (!object) return;
      const children = object.children ?? [];
      if (id !== document.root) {
        list.push({ object, depth, childCount: children.length });
        if (collapsed.has(id)) return;
      }
      for (const child of children) walk(child, id === document.root ? 0 : depth + 1);
    };
    walk(document.root, 0);
    return list;
  }, [document, collapsed]);

  /** A selected group highlights its whole subtree in the viewport. */
  const viewerSelectedIds = useMemo(() => {
    if (!selectedId) return [];
    const ids: ObjectId[] = [];
    const walk = (id: ObjectId) => {
      const object = document.objects[id];
      if (!object) return;
      ids.push(id);
      for (const child of object.children ?? []) walk(child);
    };
    walk(selectedId);
    return ids;
  }, [document, selectedId]);

  const toggleCollapsed = (id: ObjectId) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Reveal and scroll to whatever the viewport selected.
  useEffect(() => {
    if (!selectedId) return;
    const ancestors: ObjectId[] = [];
    let cursor = document.objects[selectedId]?.parent;
    while (cursor) {
      ancestors.push(cursor);
      cursor = document.objects[cursor]?.parent;
    }
    if (ancestors.some((id) => collapsed.has(id))) {
      setCollapsed((prev) => {
        const next = new Set(prev);
        for (const id of ancestors) next.delete(id);
        return next;
      });
      return;
    }
    const node = treeRef.current?.querySelector(`[data-object-id="${CSS.escape(selectedId)}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [selectedId, collapsed, document]);

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
    if (kind === "group") {
      const id = createId("group");
      commitDocument(
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
      const wall = createWallObject({ name: "Wall" });
      commitDocument(addObject(document, wall));
      setSelectedIds([wall.id]);
      return;
    }
    if (kind === "cylinder") {
      const id = createId("cylinder");
      commitDocument(
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
    const box = createBoxObject();
    commitDocument(addObject(document, box));
    setSelectedIds([box.id]);
  };

  const selectObject = (id?: ObjectId) => {
    setSelectedIds(id ? [id] : []);
  };

  const deleteSelected = () => {
    const doc = documentRef.current;
    const id = selectedId;
    if (!id || id === doc.root) return;
    commitDocument(removeObject(doc, id));
    setSelectedIds([]);
  };

  const importFile = async (file: File) => {
    const text = await file.text();
    commitDocument(deserialize(text));
    setSelectedIds([]);
  };

  const closeDrawers = () => {
    setLeftOpen(false);
    setRightOpen(false);
  };

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;

      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if (
        mod &&
        (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey))
      ) {
        event.preventDefault();
        redo();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        const id = selectedIdRef.current;
        const doc = documentRef.current;
        if (!id || id === doc.root) return;
        event.preventDefault();
        commitDocument(removeObject(doc, id));
        setSelectedIds([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const euler = selected ? eulerDegFromQuat(selected.transform.rotation) : [0, 0, 0];

  const headerActions = (
    <div className="plana-actions">
      <button
        type="button"
        className="plana-icon-btn"
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        onClick={() => undo()}
      >
        <Undo2 size={17} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className="plana-icon-btn"
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
        onClick={() => redo()}
      >
        <Redo2 size={17} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className="plana-icon-btn plana-icon-btn--danger"
        disabled={!selectedId || selectedId === document.root}
        title="Delete (Del)"
        aria-label="Delete"
        onClick={() => deleteSelected()}
      >
        <Trash2 size={17} strokeWidth={1.8} />
      </button>
      <span className="plana-sep" />
      <button
        type="button"
        className="plana-icon-btn"
        title="Center camera on the plan"
        aria-label="Center camera"
        onClick={() => setFocusKey((n) => n + 1)}
      >
        <Crosshair size={17} strokeWidth={1.8} />
      </button>
      <label className="plana-icon-btn" title="Import JSON">
        <Upload size={17} strokeWidth={1.8} />
        <input
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            await importFile(file);
            event.target.value = "";
          }}
        />
      </label>
      <button
        type="button"
        className="plana-icon-btn"
        title="Export JSON"
        aria-label="Export"
        onClick={() => exportJson()}
      >
        <Download size={17} strokeWidth={1.8} />
      </button>
    </div>
  );

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
        <div className="plana-topbar-start">
          <button
            type="button"
            className={`plana-icon-btn ${leftOpen ? "is-active" : ""}`}
            title={leftOpen ? "Hide hierarchy" : "Show hierarchy"}
            aria-label="Hierarchy"
            aria-pressed={leftOpen}
            onClick={() => {
              setLeftOpen((v) => !v);
              if (mobile) setRightOpen(false);
            }}
          >
            {leftOpen ? (
              <PanelLeftClose size={18} strokeWidth={1.8} />
            ) : (
              <PanelLeftOpen size={18} strokeWidth={1.8} />
            )}
          </button>
          <div className="plana-brand-text">
            <span className="plana-mark">Plana</span>
            <span className="plana-subtitle">Scene editor</span>
          </div>
        </div>

        {headerActions}

        <div className="plana-topbar-end">
          <button
            type="button"
            className={`plana-icon-btn ${rightOpen ? "is-active" : ""}`}
            title={rightOpen ? "Hide inspector" : "Show inspector"}
            aria-label="Inspector"
            aria-pressed={rightOpen}
            onClick={() => {
              setRightOpen((v) => !v);
              if (mobile) setLeftOpen(false);
            }}
          >
            {rightOpen ? (
              <PanelRightClose size={18} strokeWidth={1.8} />
            ) : (
              <PanelRightOpen size={18} strokeWidth={1.8} />
            )}
          </button>
        </div>
      </header>

      <div className="plana-layout">
        {(leftOpen || !mobile) && (
          <aside className={`plana-panel plana-panel--left ${leftOpen ? "is-open" : "is-collapsed"}`}>
            <div className="plana-panel__title">Hierarchy</div>
            <div className="plana-tree" ref={treeRef}>
              {rows.map(({ object, depth, childCount }) => {
                const isSelected = selectedId === object.id;
                const inSelection = !isSelected && viewerSelectedIds.includes(object.id);
                const isCollapsed = collapsed.has(object.id);
                return (
                  <div
                    key={object.id}
                    className="plana-tree-row"
                    data-object-id={object.id}
                  >
                    {Array.from({ length: depth }, (_, level) => (
                      <span
                        key={level}
                        className="plana-tree-guide"
                        style={{ left: 10 + level * 13 }}
                        aria-hidden
                      />
                    ))}
                    {childCount > 0 ? (
                      <button
                        type="button"
                        className="plana-twisty"
                        style={{ marginLeft: depth * 13 }}
                        aria-label={isCollapsed ? "Expand" : "Collapse"}
                        aria-expanded={!isCollapsed}
                        onClick={() => toggleCollapsed(object.id)}
                      >
                        {isCollapsed ? (
                          <ChevronRight size={14} strokeWidth={2} />
                        ) : (
                          <ChevronDown size={14} strokeWidth={2} />
                        )}
                      </button>
                    ) : (
                      <span className="plana-twisty-spacer" style={{ marginLeft: depth * 13 }} />
                    )}
                    <button
                      type="button"
                      className={[
                        "plana-tree-item",
                        isSelected ? "is-active" : "",
                        inSelection ? "is-child" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => {
                        selectObject(object.id);
                        if (mobile) setLeftOpen(false);
                      }}
                    >
                      <span className="plana-tree-name">{objectName(object)}</span>
                      <span className="plana-type">{object.type}</span>
                      {childCount > 0 && <span className="plana-count">{childCount}</span>}
                    </button>
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {mobile && (leftOpen || rightOpen) && (
          <button type="button" className="plana-backdrop" aria-label="Close" onClick={closeDrawers} />
        )}

        <main className="plana-viewport">
          <PlanaViewer
            document={document}
            selectedIds={viewerSelectedIds}
            activeId={selectedId}
            onSelect={selectObject}
            focusKey={focusKey}
          />
          <div className="plana-hint">
            <span className="plana-hint-desktop">
              Orbit · pan · zoom · click · Ctrl+Z / Ctrl+Shift+Z · Del
            </span>
            <span className="plana-hint-mobile">1 finger orbit · pinch zoom · tap select</span>
          </div>

          <div className="plana-create" ref={addRef}>
            {addOpen && (
              <div className="plana-create-sheet">
                <button
                  type="button"
                  onClick={() => {
                    addPrimitive("box");
                    setAddOpen(false);
                  }}
                >
                  <BoxIcon size={16} strokeWidth={1.8} />
                  Box
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addPrimitive("wall");
                    setAddOpen(false);
                  }}
                >
                  <BrickWall size={16} strokeWidth={1.8} />
                  Wall
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addPrimitive("cylinder");
                    setAddOpen(false);
                  }}
                >
                  <CylinderIcon size={16} strokeWidth={1.8} />
                  Cylinder
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addPrimitive("group");
                    setAddOpen(false);
                  }}
                >
                  <Folder size={16} strokeWidth={1.8} />
                  Group
                </button>
              </div>
            )}
            <button
              type="button"
              className={`plana-fab ${addOpen ? "is-active" : ""}`}
              title="Add object"
              aria-label="Add object"
              aria-expanded={addOpen}
              onClick={() => setAddOpen((v) => !v)}
            >
              <Plus size={20} strokeWidth={2} />
            </button>
          </div>
        </main>

        {(rightOpen || !mobile) && (
          <aside className={`plana-panel plana-panel--right ${rightOpen ? "is-open" : "is-collapsed"}`}>
            <div className="plana-panel__title">Inspector</div>
            {selected ? (
              <div className="plana-inspector">
                <label>
                  Name
                  <input
                    value={objectName(selected)}
                    onChange={(event) =>
                      commitDocument(
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
                      commitDocument(
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
                          commitDocument(
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
                          commitDocument(
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
                                commitDocument(
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
                {selected.geometry?.type === "wall" && (
                  <>
                    <div className="plana-section-label">Wall (mm)</div>
                    <div className="plana-grid3">
                      <label>
                        Thick
                        <input
                          type="number"
                          inputMode="numeric"
                          value={Math.round(selected.geometry.thickness)}
                          onChange={(event) => {
                            const geo = selected.geometry;
                            if (geo?.type !== "wall") return;
                            commitDocument(
                              updateObject(document, selected.id, {
                                geometry: {
                                  ...geo,
                                  thickness: Number(event.target.value),
                                },
                              }),
                            );
                          }}
                        />
                      </label>
                      <label>
                        Height
                        <input
                          type="number"
                          inputMode="numeric"
                          value={Math.round(selected.geometry.height.start)}
                          onChange={(event) => {
                            const geo = selected.geometry;
                            if (geo?.type !== "wall") return;
                            const h = Number(event.target.value);
                            commitDocument(
                              updateObject(document, selected.id, {
                                geometry: {
                                  ...geo,
                                  height: { start: h, end: h },
                                },
                              }),
                            );
                          }}
                        />
                      </label>
                      <label>
                        Base Z
                        <input
                          type="number"
                          inputMode="numeric"
                          value={Math.round(selected.geometry.baseZ)}
                          onChange={(event) => {
                            const geo = selected.geometry;
                            if (geo?.type !== "wall") return;
                            commitDocument(
                              updateObject(document, selected.id, {
                                geometry: {
                                  ...geo,
                                  baseZ: Number(event.target.value),
                                },
                              }),
                            );
                          }}
                        />
                      </label>
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
    </div>
  );
}
