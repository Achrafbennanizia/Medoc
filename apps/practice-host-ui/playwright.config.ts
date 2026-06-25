import { defineConfig } from "@playwright/test";

const uiGeometryE2e = process.env.MEDOC_UI_GEOMETRY_E2E === "1";
const baseURL = process.env.MEDOC_VITE_URL ?? (uiGeometryE2e ? "http://127.0.0.1:4173" : "http://127.0.0.1:5173");
const lanServer = process.env.MEDOC_LAN_URL ?? "https://127.0.0.1:8787";

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
    webServer: uiGeometryE2e
        ? {
              command:
                  "VITE_E2E_BYPASS_ONBOARDING=1 npm run build && VITE_E2E_BYPASS_ONBOARDING=1 npm run preview -- --host 127.0.0.1 --port 4173",
              url: "http://127.0.0.1:4173",
              timeout: 240_000,
              reuseExistingServer: true,
          }
        : undefined,
});
