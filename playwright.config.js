import { defineConfig } from "@playwright/test";

// Uses the Chrome already on the machine, so no browser download. Reuses a running dev server when there is one.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  fullyParallel: true,
  workers: 3,
  reporter: "list",
  use: { baseURL: "http://localhost:5180", channel: "chrome", headless: true },
  webServer: [
    { command: "npx vite --port 5180 --strictPort", url: "http://localhost:5180", reuseExistingServer: true, timeout: 60_000 },
    { command: "npm run build && npx vite preview --port 5181 --strictPort", url: "http://localhost:5181", reuseExistingServer: true, timeout: 180_000 },
  ],
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
  ],
});
