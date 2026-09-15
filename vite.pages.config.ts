/**
 * Static single-page build for GitHub Pages. No SSR, no server functions —
 * everything talks straight to Supabase from the browser.
 *
 *   VITE_PAGES_BASE=/Send/ bun run build:pages   ->  dist-pages/
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve(import.meta.dirname, "pages"),
  publicDir: path.resolve(import.meta.dirname, "public"),
  base: process.env['VITE_PAGES_BASE'] || "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist-pages"),
    emptyOutDir: true,
  },
});
