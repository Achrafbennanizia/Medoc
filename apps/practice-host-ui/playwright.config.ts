import { defineConfig } from "@playwright/test";

const baseURL = process.env.MEDOC_VITE_URL ?? "http://127.0.0.1:1420";
const lanServer = process.env.MEDOC_LAN_URL ?? "https://127.0.0.1:8787";

export default defineConfig({
    testDir: "./e2e-playwright",
    timeout: 60_000,
    retries: 0,
    webServer: {
        command: "npm run dev -- --host 127.0.0.1 --port 1420",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
    },
    use: {
        baseURL,
        ignoreHTTPSErrors: true,
        trace: "on-first-retry",
    },
    projects: [{ name: "chromium", use: { browserName: "chromium" } }],
    metadata: { medocLanUrl: lanServer },
});
