import { useEffect, useRef } from "react";

import type { ObjectId, PlanaDocument } from "@plana/core";
import { PlanaRenderer } from "@plana/renderer";

export type PlanaViewerProps = {
  document: PlanaDocument;
  selectedIds?: ObjectId[];
  activeId?: ObjectId;
  className?: string;
  onSelect?: (id?: ObjectId) => void;
};

export function PlanaViewer({
  document,
  selectedIds = [],
  activeId,
  className,
  onSelect,
}: PlanaViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PlanaRenderer | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new PlanaRenderer(canvas);
    rendererRef.current = renderer;
    renderer.setSelectHandler((id) => onSelectRef.current?.(id));

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
  }, []);

  useEffect(() => {
    rendererRef.current?.setDocument(document);
  }, [document]);

  useEffect(() => {
    rendererRef.current?.setSelection({ selectedIds, activeId });
  }, [selectedIds, activeId]);

  return (
    <div className={["plana-viewer", className].filter(Boolean).join(" ")}>
      <canvas ref={canvasRef} className="plana-viewer__canvas" />
    </div>
  );
}
