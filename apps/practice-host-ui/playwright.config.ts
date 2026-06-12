import { defineConfig } from "@playwright/test";

const baseURL = process.env.MEDOC_VITE_URL ?? "http://127.0.0.1:5173";
const lanServer = process.env.MEDOC_LAN_URL ?? "https://127.0.0.1:8787";
const geometryEnabled = process.env.MEDOC_UI_GEOMETRY === "1";

export default defineConfig({
    testDir: "./e2e-playwright",
    timeout: 60_000,
    retries: 0,
    use: {
        baseURL,
        ignoreHTTPSErrors: true,
        trace: "on-first-retry",
    },
    webServer: geometryEnabled
        ? {
            command: "npm run build && npm run preview -- --host 127.0.0.1 --port 5173",
            url: baseURL,
            reuseExistingServer: !process.env.CI,
            timeout: 240_000,
        }
        : undefined,
    projects: [{ name: "chromium", use: { browserName: "chromium" } }],
    metadata: { medocLanUrl: lanServer },
});
