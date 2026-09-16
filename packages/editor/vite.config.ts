import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: path.resolve(__dirname, "dev"),
  base: "/plana/",
  plugins: [react()],
  resolve: {
    alias: {
      "@plana/core": path.resolve(__dirname, "../core/src/index.ts"),
      "@plana/renderer": path.resolve(__dirname, "../renderer/src/index.ts"),
      "@plana/viewer": path.resolve(__dirname, "../viewer/src/index.ts"),
      "@plana/editor": path.resolve(__dirname, "./src/index.ts"),
      "@plana/viewer/styles.css": path.resolve(__dirname, "../viewer/src/styles.css"),
      "@plana/editor/styles.css": path.resolve(__dirname, "./src/styles.css"),
    },
  },
  server: { host: "0.0.0.0", port: 5173 },
  preview: { host: "0.0.0.0", port: 4173 },
  build: {
    outDir: path.resolve(__dirname, "dev-dist"),
    emptyOutDir: true,
  },
});
