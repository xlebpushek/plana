"use client";

import { Crosshair } from "lucide-react";
import { useUnit } from "effector-react";

import { frameScene } from "../model/scene";
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
  return (
    <div className="plana-hint">
      <span className="plana-hint-desktop">Orbit · pan · zoom · click</span>
      <span className="plana-hint-mobile">1 finger orbit · pinch zoom · tap select</span>
    </div>
  );
}
