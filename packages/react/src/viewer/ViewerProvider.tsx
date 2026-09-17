"use client";

import { fork, type Scope } from "effector";
import { Provider } from "effector-react";
import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";

import type { PlanaDocument } from "@plana/core";

import { $document } from "../model/scene";
import { $settings, readStoredSettings } from "../model/settings";

const ViewerContext = createContext<Scope | null>(null);

export function useViewerScope() {
  const scope = useContext(ViewerContext);
  if (!scope) throw new Error("ViewerProvider is required");
  return scope;
}

export type ViewerProviderProps = {
  document: PlanaDocument;
  children: ReactNode;
};

export function ViewerProvider({ document, children }: ViewerProviderProps) {
  const initial = useRef(document);
  const stored = useRef(readStoredSettings());
  const scope = useMemo(
    () => fork({ values: [[$document, initial.current], [$settings, stored.current]] }),
    [],
  );
  return (
    <ViewerContext.Provider value={scope}>
      <Provider value={scope}>{children}</Provider>
    </ViewerContext.Provider>
  );
}
