import { defineConfig } from "@playwright/test";

const baseURL = process.env.MEDOC_VITE_URL ?? "http://127.0.0.1:5173";
const lanServer = process.env.MEDOC_LAN_URL ?? "https://127.0.0.1:8787";
const usePreviewServer = process.env.MEDOC_PLAYWRIGHT_USE_PREVIEW === "1";

export default defineConfig({
    testDir: "./e2e-playwright",
    timeout: 60_000,
    retries: 0,
    webServer: usePreviewServer
        ? {
              command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
              port: 4173,
              reuseExistingServer: !process.env.CI,
              timeout: 120_000,
          }
        : undefined,
    use: {
        baseURL,
        ignoreHTTPSErrors: true,
        trace: "on-first-retry",
    },
    projects: [{ name: "chromium", use: { browserName: "chromium" } }],
    metadata: { medocLanUrl: lanServer },
});
