import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@plana/viewer/styles.css": path.resolve(__dirname, "../../packages/viewer/src/styles.css"),
      "@plana/editor/styles.css": path.resolve(__dirname, "../../packages/editor/src/styles.css"),
      "@plana/viewer": path.resolve(__dirname, "../../packages/viewer/src/index.ts"),
      "@plana/editor": path.resolve(__dirname, "../../packages/editor/src/index.ts"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
});
