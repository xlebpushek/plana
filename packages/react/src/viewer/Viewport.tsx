"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUnit } from "effector-react";

import { ContextMenu, type ContextMenuState } from "../editor/ContextMenu";
import { PlanaRenderer } from "../engine/PlanaRenderer";
import {
  $document,
  $frameTick,
  $selectedId,
  $selectedIds,
  $zoomPercent,
  requestZoom,
  selectId,
  setZoomPercent,
} from "../model/scene";
import { $settings } from "../model/settings";
import { useViewerScope } from "./ViewerProvider";
import { ZoomHud } from "./controls";

export function Viewport({ className }: { className?: string }) {
  useViewerScope();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PlanaRenderer | null>(null);
  const document = useUnit($document);
  const selectedIds = useUnit($selectedIds);
  const selectedId = useUnit($selectedId);
  const frameTick = useUnit($frameTick);
  const onSelect = useUnit(selectId);
  const settings = useUnit($settings);
  const zoomCommand = useUnit(requestZoom);
  const publishZoom = useUnit(setZoomPercent);
  const zoomPercent = useUnit($zoomPercent);
  const [menu, setMenu] = useState<ContextMenuState>(null);

  const syncZoom = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    publishZoom(renderer.getZoomPercent());
  }, [publishZoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new PlanaRenderer(canvas);
    rendererRef.current = renderer;
    renderer.setSelectHandler((id) => onSelect(id));
    renderer.setViewChangeHandler(syncZoom);

    const observer = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      renderer.resize(rect.width, rect.height);
    });
    observer.observe(canvas);
    const rect = canvas.getBoundingClientRect();
    renderer.resize(rect.width, rect.height);

    return () => {
      observer.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [onSelect, syncZoom]);

  useEffect(() => {
    rendererRef.current?.setSettings(settings);
  }, [settings]);

  useEffect(() => {
    rendererRef.current?.setDocument(document);
    syncZoom();
  }, [document, syncZoom]);

  useEffect(() => {
    rendererRef.current?.setSelection({
      selectedIds,
      activeId: selectedId ?? undefined,
    });
  }, [selectedIds, selectedId]);

  useEffect(() => {
    if (!frameTick) return;
    rendererRef.current?.frameDocument();
    syncZoom();
  }, [frameTick, syncZoom]);

  useEffect(() => {
    return requestZoom.watch((kind) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      if (kind === "fit") renderer.frameDocument();
      else renderer.zoomBy(kind === "in" ? 0.82 : 1.22);
      syncZoom();
    });
  }, [syncZoom]);

  return (
    <div className={["plana-viewer", className].filter(Boolean).join(" ")}>
      <canvas
        ref={canvasRef}
        className="plana-viewer__canvas"
        onContextMenu={(event) => {
          event.preventDefault();
          const renderer = rendererRef.current;
          const id = renderer?.pickObjectAt(event.clientX, event.clientY);
          onSelect(id);
          setMenu({ x: event.clientX, y: event.clientY });
        }}
      />
      <ZoomHud
        percent={zoomPercent}
        onIn={() => zoomCommand("in")}
        onOut={() => zoomCommand("out")}
        onFit={() => zoomCommand("fit")}
      />
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  );
}
