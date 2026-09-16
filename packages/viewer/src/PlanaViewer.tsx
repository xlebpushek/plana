import { useEffect, useRef } from "react";

import { renderScene, screenToWorld } from "./canvas";
import { hitTest, type PlanaDocument } from "./model";

export type PlanaViewerProps = {
  document: PlanaDocument;
  selectedIds?: string[];
  className?: string;
  interactive?: boolean;
  onSelect?: (id: string | undefined, event: PointerEvent) => void;
  onCameraChange?: (camera: PlanaDocument["camera"]) => void;
};

export function PlanaViewer({
  document: doc,
  selectedIds = [],
  className,
  interactive = true,
  onSelect,
  onCameraChange,
}: PlanaViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef(doc);
  const selectedRef = useRef(selectedIds);
  const panRef = useRef<{ x: number; y: number; camX: number; camY: number } | null>(null);

  docRef.current = doc;
  selectedRef.current = selectedIds;

  const paint = () => {
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
    renderScene(ctx, docRef.current, rect.width, rect.height, {
      selectedIds: selectedRef.current,
      mode: "view",
      showGrid: true,
    });
  };

  useEffect(() => {
    paint();
  }, [doc, selectedIds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => paint());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!interactive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const current = docRef.current;
      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const nextZoom = Math.min(8, Math.max(0.15, current.camera.zoom * zoomFactor));
      const before = screenToWorld(
        current.camera,
        event.clientX - rect.left,
        event.clientY - rect.top,
        rect.width,
        rect.height,
      );
      const camera = { ...current.camera, zoom: nextZoom };
      const after = screenToWorld(
        camera,
        event.clientX - rect.left,
        event.clientY - rect.top,
        rect.width,
        rect.height,
      );
      camera.x += before.x - after.x;
      camera.y += before.y - after.y;
      onCameraChange?.(camera);
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [interactive, onCameraChange]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "block", cursor: interactive ? "grab" : "default", touchAction: "none" }}
      onPointerDown={(event) => {
        if (!interactive) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;

        if (event.button === 1 || event.button === 2 || event.shiftKey) {
          panRef.current = {
            x: event.clientX,
            y: event.clientY,
            camX: doc.camera.x,
            camY: doc.camera.y,
          };
          canvas.setPointerCapture(event.pointerId);
          return;
        }

        const world = screenToWorld(doc.camera, localX, localY, rect.width, rect.height);
        const id = hitTest(doc, world.x, world.y);
        onSelect?.(id, event.nativeEvent);
      }}
      onPointerMove={(event) => {
        if (!panRef.current || !onCameraChange) return;
        const dx = (event.clientX - panRef.current.x) / doc.camera.zoom;
        const dy = (event.clientY - panRef.current.y) / doc.camera.zoom;
        onCameraChange({
          ...doc.camera,
          x: panRef.current.camX - dx,
          y: panRef.current.camY - dy,
        });
      }}
      onPointerUp={(event) => {
        panRef.current = null;
        canvasRef.current?.releasePointerCapture(event.pointerId);
      }}
      onContextMenu={(event) => event.preventDefault()}
    />
  );
}
