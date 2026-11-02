/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the app from /Dashbord-QA/
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/Dashbord-QA/" : "/",
  plugins: [react()],
  test: { include: ["tests/**/*.test.ts"] },
}));
