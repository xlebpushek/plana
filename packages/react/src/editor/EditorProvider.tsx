"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useUnit } from "effector-react";

import { deleteSelected, redo, undo } from "../model/scene";
import { useViewerScope } from "../viewer/ViewerProvider";

const EditorContext = createContext(false);

export function useEditor() {
  if (!useContext(EditorContext)) throw new Error("EditorProvider is required");
}

export function EditorProvider({ children }: { children: ReactNode }) {
  useViewerScope();
  const runUndo = useUnit(undo);
  const runRedo = useUnit(redo);
  const runDelete = useUnit(deleteSelected);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        runUndo();
        return;
      }
      if (
        mod &&
        (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey))
      ) {
        event.preventDefault();
        runRedo();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        runDelete();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runDelete, runRedo, runUndo]);

  return <EditorContext.Provider value={true}>{children}</EditorContext.Provider>;
}
