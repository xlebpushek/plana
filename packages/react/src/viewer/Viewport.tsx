"use client";

import { useEffect, useRef } from "react";
import { useUnit } from "effector-react";

import { PlanaRenderer } from "../engine/PlanaRenderer";
import { $document, $frameTick, $selectedId, $selectedIds, selectId } from "../model/scene";
import { $settings } from "../model/settings";
import { useViewerScope } from "./ViewerProvider";

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new PlanaRenderer(canvas);
    rendererRef.current = renderer;
    renderer.setSelectHandler((id) => onSelect(id));

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
  }, [onSelect]);

  useEffect(() => {
    rendererRef.current?.setSettings(settings);
  }, [settings]);

  useEffect(() => {
    rendererRef.current?.setDocument(document);
  }, [document]);

  useEffect(() => {
    rendererRef.current?.setSelection({
      selectedIds,
      activeId: selectedId ?? undefined,
    });
  }, [selectedIds, selectedId]);

  useEffect(() => {
    if (!frameTick) return;
    rendererRef.current?.frameDocument();
  }, [frameTick]);

  return (
    <div className={["plana-viewer", className].filter(Boolean).join(" ")}>
      <canvas ref={canvasRef} className="plana-viewer__canvas" />
    </div>
  );
}
