import { defineConfig } from "@playwright/test";

const baseURL = process.env.MEDOC_VITE_URL ?? "http://127.0.0.1:4173";
const lanServer = process.env.MEDOC_LAN_URL ?? "https://127.0.0.1:8787";
const runUiE2E = process.env.MEDOC_UI_E2E === "1";

export default defineConfig({
    testDir: "./e2e-playwright",
    timeout: 60_000,
    retries: 0,
    webServer: runUiE2E
        ? {
            command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4173",
            url: baseURL,
            reuseExistingServer: !process.env.CI,
            timeout: 180_000,
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
