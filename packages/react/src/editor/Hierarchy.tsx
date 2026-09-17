"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUnit } from "effector-react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { ObjectId, PlanaObject } from "@plana/core";

import { ContextMenu, type ContextMenuState } from "./ContextMenu";
import { $document, $selectedId, $selectedIds, selectId } from "../model/scene";
import { useEditor } from "./context";
import { useViewerScope } from "../viewer/ViewerProvider";

function objectName(object: PlanaObject) {
  return String(object.metadata?.name ?? object.id);
}

function initialCollapsed(document: { root: ObjectId; objects: Record<string, PlanaObject> }) {
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

export function Hierarchy({ className }: { className?: string }) {
  useViewerScope();
  useEditor();
  const document = useUnit($document);
  const selectedId = useUnit($selectedId);
  const selectedIds = useUnit($selectedIds);
  const select = useUnit(selectId);
  const treeRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<ObjectId>>(() => initialCollapsed(document));
  const [menu, setMenu] = useState<ContextMenuState>(null);

  const rows = useMemo(() => {
    const list: Array<{ object: PlanaObject; depth: number; childCount: number }> = [];
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

  return (
    <aside className={["plana-panel plana-panel--left", className].filter(Boolean).join(" ")}>
      <div className="plana-panel__title">Hierarchy</div>
      <div className="plana-tree" ref={treeRef}>
        {rows.map(({ object, depth, childCount }) => {
          const isSelected = selectedId === object.id;
          const inSelection = !isSelected && selectedIds.includes(object.id);
          const isCollapsed = collapsed.has(object.id);
          return (
            <div key={object.id} className="plana-tree-row" data-object-id={object.id}>
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
                  onClick={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(object.id)) next.delete(object.id);
                      else next.add(object.id);
                      return next;
                    })
                  }
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
                onClick={() => select(object.id)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  select(object.id);
                  setMenu({ x: event.clientX, y: event.clientY });
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
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </aside>
  );
}
