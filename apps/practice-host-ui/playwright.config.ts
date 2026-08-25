import { defineConfig } from "@playwright/test";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const baseURL = process.env.MEDOC_VITE_URL ?? "http://127.0.0.1:5173";
const lanServer = process.env.MEDOC_LAN_URL ?? "https://127.0.0.1:8787";
const configDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    testDir: "./e2e-playwright",
    timeout: 60_000,
    retries: 0,
    webServer: {
        command: "npm run dev -- --host 127.0.0.1 --port 5173",
        cwd: configDir,
        reuseExistingServer: true,
        timeout: 120_000,
        url: baseURL,
    },
    use: {
        baseURL,
        ignoreHTTPSErrors: true,
        trace: "on-first-retry",
    },
    projects: [{ name: "chromium", use: { browserName: "chromium" } }],
    metadata: { medocLanUrl: lanServer },
});
