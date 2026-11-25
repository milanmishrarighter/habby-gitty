import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the bundle loads from inside the Android app.
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
});
