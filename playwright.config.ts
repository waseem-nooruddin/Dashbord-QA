import { defineConfig, devices } from "@playwright/test";

// Runs against the dev server in demo mode with the synthetic fixture (no Supabase, no login).
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:5191" },
  webServer: {
    command: "npx vite --port 5191 --strictPort",
    url: "http://localhost:5191",
    // Placeholder client values: demo mode never calls Supabase.
    env: { VITE_DEMO: "synthetic", VITE_SUPABASE_URL: "http://localhost:54321", VITE_SUPABASE_PUBLISHABLE_KEY: "demo" },
    reuseExistingServer: false,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
});
