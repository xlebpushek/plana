import { createRoot } from "react-dom/client";
import { useState } from "react";

import { PlanaEditor, createApartmentDocument } from "../src/index";
import type { PlanaDocument } from "@plana/core";

import "../src/styles.css";
import "../../viewer/src/styles.css";
import "./dev.css";

function App() {
  const [document, setDocument] = useState<PlanaDocument>(() => createApartmentDocument());
  return <PlanaEditor document={document} onChange={setDocument} />;
}

createRoot(window.document.getElementById("root")!).render(<App />);
