"use client";

import { useState } from "react";

import type { PlanaDocument } from "@plana/core";
import { PlanaEditor, createApartmentDocument } from "@plana/editor";
import "@plana/editor/styles.css";
import "@plana/viewer/styles.css";

export default function Editor() {
  const [document, setDocument] = useState<PlanaDocument>(() => createApartmentDocument());
  return <PlanaEditor document={document} onChange={setDocument} />;
}
