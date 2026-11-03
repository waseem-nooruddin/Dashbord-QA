/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the app from /Dashbord-QA/; Vercel (VERCEL=1 at build time) and dev serve it from /.
export default defineConfig(({ command }) => ({
  base: command === "build" && !process.env.VERCEL ? "/Dashbord-QA/" : "/",
  plugins: [react()],
  test: { include: ["tests/**/*.test.ts"] },
}));
