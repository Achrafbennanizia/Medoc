import { defineConfig } from "@playwright/test";

const defaultBaseUrl = "http://127.0.0.1:4173";
const baseURL = process.env.MEDOC_VITE_URL ?? defaultBaseUrl;
const lanServer = process.env.MEDOC_LAN_URL ?? "https://127.0.0.1:8787";
const managePreviewServer = !process.env.MEDOC_VITE_URL;

export default defineConfig({
    testDir: "./e2e-playwright",
    timeout: 60_000,
    retries: 0,
    use: {
        baseURL,
        ignoreHTTPSErrors: true,
        trace: "on-first-retry",
    },
    projects: [{ name: "chromium", use: { browserName: "chromium" } }],
    metadata: { medocLanUrl: lanServer },
    webServer: managePreviewServer
        ? {
              command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4173",
              port: 4173,
              timeout: 240_000,
              reuseExistingServer: true,
          }
        : undefined,
});
