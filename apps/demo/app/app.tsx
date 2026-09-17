"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";

import type { PlanaDocument } from "@plana/core";
import {
  CreateObjectButton,
  EditorProvider,
  FrameButton,
  Hierarchy,
  HistoryButtons,
  ImportExportButtons,
  Inspector,
  SettingsButton,
  ViewHint,
  ViewerProvider,
  Viewport,
} from "@plana/react";
import "@plana/react/styles.css";

import apartment from "../apartment.json";

const document = apartment as unknown as PlanaDocument;

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

export default function App() {
  const mobile = useIsMobile();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  useEffect(() => {
    setLeftOpen(!mobile);
    setRightOpen(!mobile);
  }, [mobile]);

  return (
    <ViewerProvider document={document}>
      <EditorProvider>
        <div
          className={[
            "plana-editor",
            mobile ? "is-mobile" : "is-desktop",
            leftOpen ? "left-open" : "",
            rightOpen ? "right-open" : "",
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
                <span className="plana-subtitle">Demo</span>
              </div>
            </div>
            <div className="plana-actions">
              <HistoryButtons />
              <span className="plana-sep" />
              <FrameButton />
              <ImportExportButtons />
              <span className="plana-sep" />
              <SettingsButton />
            </div>
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
              <Hierarchy className={leftOpen ? "is-open" : "is-collapsed"} />
            )}
            {mobile && (leftOpen || rightOpen) && (
              <button
                type="button"
                className="plana-backdrop"
                aria-label="Close"
                onClick={() => {
                  setLeftOpen(false);
                  setRightOpen(false);
                }}
              />
            )}
            <main className="plana-viewport">
              <Viewport />
              <ViewHint />
              <CreateObjectButton />
            </main>
            {(rightOpen || !mobile) && (
              <Inspector className={rightOpen ? "is-open" : "is-collapsed"} />
            )}
          </div>
        </div>
      </EditorProvider>
    </ViewerProvider>
  );
}
