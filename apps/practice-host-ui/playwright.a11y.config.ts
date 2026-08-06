import { defineConfig } from "@playwright/test";

const baseURL = process.env.MEDOC_A11Y_BASE_URL ?? "http://127.0.0.1:4173";

export default defineConfig({
    testDir: "./e2e-playwright",
    testMatch: /a11y\.critical\.spec\.ts/,
    timeout: 60_000,
    retries: 0,
    use: {
        baseURL,
        trace: "off",
    },
    webServer: {
        command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4173",
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: false,
    },
    projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
