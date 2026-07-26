/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const pkg = JSON.parse(readFileSync(path.join(__dirname, "package.json"), "utf-8")) as { version: string };

const host = process.env.TAURI_DEV_HOST;
const root = __dirname;

/** Path aliases — tiered packages first, app shell last. */
const medocAliases = [
    { find: "@/lib/mac-window-drag", replacement: path.resolve(root, "src/platform/mac-window-drag.ts") },
    { find: "@/lib/desktop-window-controls", replacement: path.resolve(root, "src/platform/desktop-window-controls.ts") },
    { find: "@/lib/akte-anlagen", replacement: path.resolve(root, "src/platform/akte-anlagen.ts") },
    {
        find: "@/lib/native-app-menu-bridge",
        replacement: path.resolve(root, "src/platform/native-app-menu-bridge.ts"),
    },
    { find: "@/lib", replacement: path.resolve(root, "../../packages/shared/src/lib") },
    { find: "@/models", replacement: path.resolve(root, "../../packages/shared/src/models") },
    { find: "@/views/components/ui", replacement: path.resolve(root, "../../packages/ui/src") },
    { find: "@/systems/practice-host", replacement: path.resolve(root, "../../packages/app/practice-host/src") },
    { find: "@/systems/lan/adapters", replacement: path.resolve(root, "src/systems/lan/adapters") },
    { find: "@/systems/lan", replacement: path.resolve(root, "../../packages/server/lan/src") },
    {
        find: "@/systems/company-portal/adapters",
        replacement: path.resolve(root, "src/systems/company-portal/adapters"),
    },
    { find: "@/systems/company-portal", replacement: path.resolve(root, "../../packages/server/company/src") },
    { find: "@medoc/shared", replacement: path.resolve(root, "../../packages/shared/src") },
    { find: "#shared-locales", replacement: path.resolve(root, "../../packages/shared/locales") },
    { find: "@medoc/ui", replacement: path.resolve(root, "../../packages/ui/src") },
    { find: "@medoc/system-practice", replacement: path.resolve(root, "../../packages/app/practice-host/src") },
    { find: "@medoc/system-lan", replacement: path.resolve(root, "../../packages/server/lan/src") },
    { find: "@medoc/system-company", replacement: path.resolve(root, "../../packages/server/company/src") },
    { find: "@", replacement: path.resolve(root, "src") },
];

export default defineConfig(async () => ({
    plugins: [react()],
    define: {
        "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
    },
    build: {
        rollupOptions: {
            input: {
                main: path.resolve(root, "index.html"),
                geometryFixture: path.resolve(root, "geometry-fixture.html"),
            },
        },
    },
    test: {
        setupFiles: ["./src/vitest-setup.ts"],
        passWithNoTests: false,
        coverage: {
            provider: "v8",
            reporter: ["text-summary", "lcov"],
            reportsDirectory: "./coverage",
            include: ["src/**/*.{ts,tsx}", "../../packages/**/src/**/*.{ts,tsx}"],
            exclude: [
                "**/*.test.{ts,tsx}",
                "**/*.smoke.test.{ts,tsx}",
                "**/*.generated.{ts,tsx}",
                "src/vitest-setup.ts",
                "src/main.tsx",
            ],
        },
        projects: [
            {
                extends: true,
                test: {
                    name: "node",
                    environment: "node",
                    include: [
                        "src/**/*.test.ts",
                        "src/**/*.test.tsx",
                        "../../packages/**/*.test.ts",
                        "../../packages/**/*.test.tsx",
                    ],
                    exclude: [
                        "**/*.smoke.test.ts",
                        "**/*.smoke.test.tsx",
                        "src/lib/**/*.test.ts",
                        "src/lib/**/*.test.tsx",
                    ],
                },
            },
            {
                extends: true,
                test: {
                    name: "smoke",
                    environment: "jsdom",
                    include: ["**/*.smoke.test.ts", "**/*.smoke.test.tsx"],
                },
            },
            {
                extends: true,
                test: {
                    name: "mvp-unit",
                    environment: "node",
                    include: [
                        "../../packages/app/practice-host/src/controllers/sync.controller.test.ts",
                        "../../packages/app/practice-host/src/controllers/pairing.controller.test.ts",
                        "../../packages/server/lan/src/controllers/pairing-scan.controller.test.ts",
                        "../../packages/shared/src/lib/deployment-config.test.ts",
                        "../../packages/shared/src/lib/quittung-export-flow.test.ts",
                    ],
                    coverage: {
                        provider: "v8",
                        reporter: ["text-summary", "lcov"],
                        reportsDirectory: "./coverage/mvp-unit",
                        include: [
                            "../../packages/app/practice-host/src/controllers/sync.controller.ts",
                            "../../packages/app/practice-host/src/controllers/pairing.controller.ts",
                            "../../packages/server/lan/src/controllers/pairing-scan.controller.ts",
                            "../../packages/app/practice-host/src/lib/deployment-config.ts",
                            "../../packages/shared/src/lib/quittung-export-flow.ts",
                        ],
                        thresholds: {
                            lines: 100,
                            functions: 100,
                            statements: 100,
                            branches: 100,
                        },
                    },
                },
            },
        ],
    },
    resolve: {
        alias: medocAliases,
    },
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? { protocol: "ws", host, port: 1421 }
            : undefined,
        watch: {
            ignored: ["**/src-tauri/**"],
        },
    },
}));
