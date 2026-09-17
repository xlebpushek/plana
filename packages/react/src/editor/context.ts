"use client";

import { createContext, useContext } from "react";

export const EditorContext = createContext(false);

export function useEditor() {
  if (!useContext(EditorContext)) throw new Error("EditorProvider is required");
}
