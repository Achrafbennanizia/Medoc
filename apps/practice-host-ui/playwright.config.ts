import { defineConfig } from "@playwright/test";

const useA11yPreviewServer = process.env.MEDOC_A11Y_WEB_SERVER === "1";
const previewHost = process.env.MEDOC_A11Y_HOST ?? "127.0.0.1";
const previewPort = process.env.MEDOC_A11Y_PORT ?? "4173";
const baseURL =
    process.env.MEDOC_VITE_URL ??
    (useA11yPreviewServer ? `http://${previewHost}:${previewPort}` : "http://127.0.0.1:5173");
const lanServer = process.env.MEDOC_LAN_URL ?? "https://127.0.0.1:8787";

export default defineConfig({
    testDir: "./e2e-playwright",
    timeout: 60_000,
    retries: 0,
    webServer: useA11yPreviewServer
        ? {
              command: `npm run build -w medoc && npm run preview -w medoc -- --host ${previewHost} --port ${previewPort}`,
              url: `http://${previewHost}:${previewPort}`,
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
