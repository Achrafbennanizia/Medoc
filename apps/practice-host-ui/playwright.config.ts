import { defineConfig } from "@playwright/test";

const baseURL = process.env.MEDOC_VITE_URL ?? "http://127.0.0.1:5173";
const lanServer = process.env.MEDOC_LAN_URL ?? "https://127.0.0.1:8787";
const useWebServer = process.env.MEDOC_SKIP_WEB_SERVER !== "1";

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
    webServer: useWebServer
        ? {
              command: "npm run dev -w medoc -- --host 127.0.0.1 --port 5173",
              url: baseURL,
              reuseExistingServer: true,
              timeout: 180_000,
          }
        : undefined,
});
