"use client";

import { useUnit } from "effector-react";

import { eulerDegFromQuat, quatFromEulerDeg, updateObject } from "@plana/core";

import { $document, $selectedId, commitDocument } from "../model/scene";
import { useEditor } from "./EditorProvider";
import { useViewerScope } from "../viewer/ViewerProvider";

function objectName(object: { metadata?: Record<string, unknown>; id: string }) {
  return String(object.metadata?.name ?? object.id);
}

export function Inspector({ className }: { className?: string }) {
  useViewerScope();
  useEditor();
  const document = useUnit($document);
  const selectedId = useUnit($selectedId);
  const commit = useUnit(commitDocument);
  const selected = selectedId ? document.objects[selectedId] : undefined;
  const euler = selected ? eulerDegFromQuat(selected.transform.rotation) : [0, 0, 0];

  return (
    <aside className={["plana-panel plana-panel--right", className].filter(Boolean).join(" ")}>
      <div className="plana-panel__title">Inspector</div>
      {selected ? (
        <div className="plana-inspector">
          <label>
            Name
            <input
              value={objectName(selected)}
              onChange={(event) =>
                commit(
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
                commit(
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
                    const position = [...selected.transform.position] as [number, number, number];
                    position[index] = Number(event.target.value);
                    commit(
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
                    commit(
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
                          commit(
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
                      commit(
                        updateObject(document, selected.id, {
                          geometry: { ...geo, thickness: Number(event.target.value) },
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
                      commit(
                        updateObject(document, selected.id, {
                          geometry: { ...geo, height: { start: h, end: h } },
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
                      commit(
                        updateObject(document, selected.id, {
                          geometry: { ...geo, baseZ: Number(event.target.value) },
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
  );
}
