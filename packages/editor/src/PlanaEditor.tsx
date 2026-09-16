import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  hitTest,
  listChildren,
  parseDocument,
  renderScene,
  screenToWorld,
  serializeDocument,
  type PlanaDocument,
  type SceneObject,
} from "@plana/viewer";

import {
  createEllipseAt,
  createRectAt,
  deleteObjects,
  groupObjects,
  moveObjects,
  reorderObject,
  updateObject,
  updateStyle,
  type EditorTool,
} from "./operations";

export type PlanaEditorProps = {
  document: PlanaDocument;
  onChange: (document: PlanaDocument) => void;
  className?: string;
};

type DragState =
  | { kind: "pan"; x: number; y: number; camX: number; camY: number }
  | { kind: "move"; x: number; y: number; ids: string[] }
  | { kind: "create"; tool: "rect" | "ellipse"; x: number; y: number; sx: number; sy: number };

function flattenTree(doc: PlanaDocument): Array<SceneObject & { depth: number }> {
  const rows: Array<SceneObject & { depth: number }> = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const obj of listChildren(doc, parentId)) {
      rows.push({ ...obj, depth });
      if (obj.type === "group") walk(obj.id, depth + 1);
    }
  };
  walk(null, 0);
  return rows;
}

export function PlanaEditor({ document: doc, onChange, className }: PlanaEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<EditorTool>("select");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const dragRef = useRef<DragState | null>(null);
  const spaceRef = useRef(false);

  const selected = selectedIds.length === 1 ? doc.objects[selectedIds[0]] : undefined;
  const tree = useMemo(() => flattenTree(doc), [doc]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderScene(ctx, doc, rect.width, rect.height, {
      selectedIds,
      mode: "edit",
      showGrid: true,
    });

    const drag = dragRef.current;
    if (drag?.kind === "create") {
      const x = Math.min(drag.x, drag.sx);
      const y = Math.min(drag.y, drag.sy);
      const width = Math.abs(drag.sx - drag.x);
      const height = Math.abs(drag.sy - drag.y);
      ctx.save();
      ctx.translate(rect.width / 2, rect.height / 2);
      ctx.scale(doc.camera.zoom, doc.camera.zoom);
      ctx.translate(-doc.camera.x, -doc.camera.y);
      ctx.strokeStyle = "#2563eb";
      ctx.setLineDash([6, 4]);
      if (drag.tool === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(x, y, width, height);
      }
      ctx.restore();
    }
  }, [doc, selectedIds]);

  useEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => paint());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paint]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") spaceRef.current = true;
      if (event.key === "v" || event.key === "V") setTool("select");
      if (event.key === "h" || event.key === "H") setTool("pan");
      if (event.key === "r" || event.key === "R") setTool("rect");
      if (event.key === "o" || event.key === "O") setTool("ellipse");
      if (event.key === "Escape") setSelectedIds([]);
      if ((event.key === "Delete" || event.key === "Backspace") && selectedIds.length) {
        const target = event.target as HTMLElement | null;
        if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
        onChange(deleteObjects(doc, selectedIds));
        setSelectedIds([]);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "g") {
        event.preventDefault();
        if (selectedIds.length >= 2) {
          const next = groupObjects(doc, selectedIds);
          onChange(next);
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") spaceRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [doc, onChange, selectedIds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const nextZoom = Math.min(8, Math.max(0.15, doc.camera.zoom * zoomFactor));
      const before = screenToWorld(
        doc.camera,
        event.clientX - rect.left,
        event.clientY - rect.top,
        rect.width,
        rect.height,
      );
      const camera = { ...doc.camera, zoom: nextZoom };
      const after = screenToWorld(
        camera,
        event.clientX - rect.left,
        event.clientY - rect.top,
        rect.width,
        rect.height,
      );
      camera.x += before.x - after.x;
      camera.y += before.y - after.y;
      onChange({ ...doc, camera });
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [doc, onChange]);

  const toWorld = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return screenToWorld(doc.camera, clientX - rect.left, clientY - rect.top, rect.width, rect.height);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    const world = toWorld(event.clientX, event.clientY);
    setPointer(world);

    const panMode = tool === "pan" || spaceRef.current || event.button === 1;
    if (panMode) {
      dragRef.current = {
        kind: "pan",
        x: event.clientX,
        y: event.clientY,
        camX: doc.camera.x,
        camY: doc.camera.y,
      };
      return;
    }

    if (tool === "rect" || tool === "ellipse") {
      dragRef.current = {
        kind: "create",
        tool,
        x: world.x,
        y: world.y,
        sx: world.x,
        sy: world.y,
      };
      paint();
      return;
    }

    const id = hitTest(doc, world.x, world.y);
    if (id) {
      const nextSelected = event.shiftKey
        ? selectedIds.includes(id)
          ? selectedIds.filter((item) => item !== id)
          : [...selectedIds, id]
        : selectedIds.includes(id)
          ? selectedIds
          : [id];
      setSelectedIds(nextSelected);
      dragRef.current = { kind: "move", x: world.x, y: world.y, ids: nextSelected };
    } else {
      setSelectedIds([]);
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const world = toWorld(event.clientX, event.clientY);
    setPointer(world);
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.kind === "pan") {
      const dx = (event.clientX - drag.x) / doc.camera.zoom;
      const dy = (event.clientY - drag.y) / doc.camera.zoom;
      onChange({
        ...doc,
        camera: { ...doc.camera, x: drag.camX - dx, y: drag.camY - dy },
      });
      return;
    }

    if (drag.kind === "move") {
      const dx = world.x - drag.x;
      const dy = world.y - drag.y;
      drag.x = world.x;
      drag.y = world.y;
      onChange(moveObjects(doc, drag.ids, dx, dy));
      return;
    }

    if (drag.kind === "create") {
      drag.sx = world.x;
      drag.sy = world.y;
      paint();
    }
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.kind === "create") {
      const x = Math.min(drag.x, drag.sx);
      const y = Math.min(drag.y, drag.sy);
      const width = Math.abs(drag.sx - drag.x);
      const height = Math.abs(drag.sy - drag.y);
      if (width < 4 && height < 4) return;
      const result =
        drag.tool === "rect"
          ? createRectAt(doc, x, y, width, height)
          : createEllipseAt(doc, x, y, width, height);
      onChange(result.document);
      setSelectedIds([result.id]);
      setTool("select");
    }
  };

  const exportJson = () => {
    const blob = new Blob([serializeDocument(doc)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.name.replace(/\s+/g, "-").toLowerCase() || "plana"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    const text = await file.text();
    onChange(parseDocument(text));
    setSelectedIds([]);
  };

  return (
    <div className={["plana-editor", className].filter(Boolean).join(" ")}>
      <header className="plana-toolbar">
        <div className="plana-brand">
          <span className="plana-logo">Plana</span>
          <input
            className="plana-doc-name"
            value={doc.name}
            onChange={(event) => onChange({ ...doc, name: event.target.value })}
          />
        </div>
        <div className="plana-tools">
          {(
            [
              ["select", "Select (V)"],
              ["pan", "Pan (H)"],
              ["rect", "Rect (R)"],
              ["ellipse", "Ellipse (O)"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tool === id ? "is-active" : undefined}
              onClick={() => setTool(id)}
              title={label}
            >
              {id}
            </button>
          ))}
          <button
            type="button"
            disabled={selectedIds.length < 2}
            onClick={() => onChange(groupObjects(doc, selectedIds))}
          >
            Group
          </button>
          <button
            type="button"
            disabled={!selectedIds.length}
            onClick={() => {
              onChange(deleteObjects(doc, selectedIds));
              setSelectedIds([]);
            }}
          >
            Delete
          </button>
        </div>
        <div className="plana-actions">
          <label className="plana-file">
            Import
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importJson(file);
                event.target.value = "";
              }}
            />
          </label>
          <button type="button" onClick={exportJson}>
            Export
          </button>
        </div>
      </header>

      <div className="plana-body">
        <aside className="plana-panel plana-left">
          <div className="plana-panel-title">Objects</div>
          <div className="plana-tree">
            {tree.map((obj) => (
              <button
                key={obj.id}
                type="button"
                className={selectedIds.includes(obj.id) ? "is-active" : undefined}
                style={{ paddingLeft: 10 + obj.depth * 14 }}
                onClick={(event) => {
                  if (event.shiftKey) {
                    setSelectedIds((prev) =>
                      prev.includes(obj.id) ? prev.filter((id) => id !== obj.id) : [...prev, obj.id],
                    );
                  } else {
                    setSelectedIds([obj.id]);
                  }
                }}
              >
                <span className="plana-type">{obj.type}</span>
                <span>{obj.name}</span>
              </button>
            ))}
            {!tree.length && <p className="plana-muted">No objects yet</p>}
          </div>
        </aside>

        <main className="plana-viewport">
          <canvas
            ref={canvasRef}
            className="plana-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onContextMenu={(event) => event.preventDefault()}
            style={{
              cursor:
                tool === "pan" || spaceRef.current
                  ? "grab"
                  : tool === "select"
                    ? "default"
                    : "crosshair",
            }}
          />
        </main>

        <aside className="plana-panel plana-right">
          <div className="plana-panel-title">Inspector</div>
          {selected ? (
            <div className="plana-inspector">
              <label>
                Name
                <input
                  value={selected.name}
                  onChange={(event) => onChange(updateObject(doc, selected.id, { name: event.target.value }))}
                />
              </label>
              <div className="plana-grid2">
                <label>
                  X
                  <input
                    type="number"
                    value={Math.round(selected.transform.x)}
                    onChange={(event) =>
                      onChange(
                        updateObject(doc, selected.id, {
                          transform: { ...selected.transform, x: Number(event.target.value) },
                        }),
                      )
                    }
                  />
                </label>
                <label>
                  Y
                  <input
                    type="number"
                    value={Math.round(selected.transform.y)}
                    onChange={(event) =>
                      onChange(
                        updateObject(doc, selected.id, {
                          transform: { ...selected.transform, y: Number(event.target.value) },
                        }),
                      )
                    }
                  />
                </label>
              </div>
              {(selected.type === "rect" || selected.type === "ellipse") && (
                <div className="plana-grid2">
                  <label>
                    W
                    <input
                      type="number"
                      value={Math.round(selected.width)}
                      onChange={(event) =>
                        onChange(updateObject(doc, selected.id, { width: Number(event.target.value) }))
                      }
                    />
                  </label>
                  <label>
                    H
                    <input
                      type="number"
                      value={Math.round(selected.height)}
                      onChange={(event) =>
                        onChange(updateObject(doc, selected.id, { height: Number(event.target.value) }))
                      }
                    />
                  </label>
                </div>
              )}
              <label>
                Fill
                <input
                  type="color"
                  value={toHex(selected.style.fill)}
                  onChange={(event) => onChange(updateStyle(doc, selected.id, { fill: event.target.value }))}
                />
              </label>
              <label>
                Stroke
                <input
                  type="color"
                  value={toHex(selected.style.stroke)}
                  onChange={(event) => onChange(updateStyle(doc, selected.id, { stroke: event.target.value }))}
                />
              </label>
              <div className="plana-row">
                <button type="button" onClick={() => onChange(reorderObject(doc, selected.id, "up"))}>
                  Bring forward
                </button>
                <button type="button" onClick={() => onChange(reorderObject(doc, selected.id, "down"))}>
                  Send back
                </button>
              </div>
            </div>
          ) : (
            <p className="plana-muted">
              {selectedIds.length > 1
                ? `${selectedIds.length} objects selected`
                : "Select an object to edit properties"}
            </p>
          )}
        </aside>
      </div>

      <footer className="plana-status">
        <span>Tool: {tool}</span>
        <span>
          x {pointer.x.toFixed(0)} · y {pointer.y.toFixed(0)}
        </span>
        <span>Zoom {(doc.camera.zoom * 100).toFixed(0)}%</span>
        <span>{Object.keys(doc.objects).length} objects</span>
      </footer>
    </div>
  );
}

function toHex(color: string): string {
  if (color.startsWith("#") && color.length === 7) return color;
  return "#a1a1aa";
}
