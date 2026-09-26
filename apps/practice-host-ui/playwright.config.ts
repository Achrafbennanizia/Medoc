import { defineConfig } from "@playwright/test";

const baseURL = process.env.MEDOC_VITE_URL ?? "http://127.0.0.1:5173";
const lanServer = process.env.MEDOC_LAN_URL ?? "https://127.0.0.1:8787";
const shouldManageWebServer = !process.env.MEDOC_VITE_URL;

export default defineConfig({
    testDir: "./e2e-playwright",
    timeout: 60_000,
    retries: 0,
    webServer: shouldManageWebServer
        ? {
              command: "npm run dev -- --host 127.0.0.1 --port 5173",
              url: baseURL,
              timeout: 120_000,
              reuseExistingServer: true,
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
