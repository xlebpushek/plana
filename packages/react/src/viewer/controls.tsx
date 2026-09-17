"use client";

import { Crosshair } from "lucide-react";
import { useUnit } from "effector-react";

import { frameScene } from "../model/scene";
import { $settings } from "../model/settings";
import { useViewerScope } from "./ViewerProvider";

export function FrameButton() {
  useViewerScope();
  const frame = useUnit(frameScene);
  return (
    <button
      type="button"
      className="plana-icon-btn"
      title="Center camera on the plan"
      aria-label="Center camera"
      onClick={() => frame()}
    >
      <Crosshair size={17} strokeWidth={1.8} />
    </button>
  );
}

export function ViewHint() {
  useViewerScope();
  const settings = useUnit($settings);
  if (!settings.canvas.showHint) return null;
  return (
    <div className="plana-hint">
      <span className="plana-hint-desktop">Orbit · pan · zoom · right-click</span>
      <span className="plana-hint-mobile">1 finger orbit · pinch zoom · tap select</span>
    </div>
  );
}

export function ZoomHud({
  percent,
  onIn,
  onOut,
  onFit,
}: {
  percent: number;
  onIn: () => void;
  onOut: () => void;
  onFit: () => void;
}) {
  return (
    <div className="plana-zoom">
      <button type="button" title="Zoom out" aria-label="Zoom out" onClick={onOut}>
        −
      </button>
      <button type="button" title="Fit to view" aria-label="Fit to view" onClick={onFit}>
        {percent}%
      </button>
      <button type="button" title="Zoom in" aria-label="Zoom in" onClick={onIn}>
        +
      </button>
    </div>
  );
}
