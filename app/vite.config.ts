/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const pkg = JSON.parse(readFileSync(path.join(__dirname, "package.json"), "utf-8")) as { version: string };

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
    plugins: [react()],
    define: {
        "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
    },
    test: {
        setupFiles: ["./src/vitest-setup.ts"],
        passWithNoTests: false,
        projects: [
            {
                extends: true,
                test: {
                    name: "node",
                    environment: "node",
                    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
                    exclude: ["src/**/*.smoke.test.ts", "src/**/*.smoke.test.tsx"],
                },
            },
            {
                extends: true,
                test: {
                    name: "smoke",
                    environment: "jsdom",
                    include: ["src/**/*.smoke.test.ts", "src/**/*.smoke.test.tsx"],
                },
            },
        ],
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
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
