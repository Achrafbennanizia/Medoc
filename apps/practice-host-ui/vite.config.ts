/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/** In-memory command queue so screenshot scripts can drive the Tauri webview (same-origin). */
function medocCaptureBridge(): Plugin {
    let pending: Record<string, unknown> | null = null;
    const acks = new Map<string, Record<string, unknown>>();
    let lastHello = 0;

    const readJson = (req: IncomingMessage): Promise<Record<string, unknown>> =>
        new Promise((resolve) => {
            const chunks: Buffer[] = [];
            req.on("data", (c) => chunks.push(c as Buffer));
            req.on("end", () => {
                try {
                    resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>);
                } catch {
                    resolve({});
                }
            });
        });

    const json = (res: ServerResponse, code: number, body: unknown) => {
        const raw = JSON.stringify(body);
        res.statusCode = code;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(raw);
    };

    return {
        name: "medoc-capture-bridge",
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const url = req.url?.split("?")[0] ?? "";
                if (!url.startsWith("/__medoc_capture")) return next();
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                res.setHeader("Access-Control-Allow-Headers", "Content-Type");
                if (req.method === "OPTIONS") {
                    res.statusCode = 204;
                    res.end();
                    return;
                }
                if (url === "/__medoc_capture/hello" && req.method === "POST") {
                    lastHello = Date.now();
                    json(res, 200, { ok: true, lastHello });
                    return;
                }
                if (url === "/__medoc_capture/status" && req.method === "GET") {
                    json(res, 200, { ok: true, lastHello, ageMs: lastHello ? Date.now() - lastHello : null });
                    return;
                }
                if (url === "/__medoc_capture/enqueue" && req.method === "POST") {
                    const body = await readJson(req);
                    pending = body;
                    json(res, 200, { ok: true });
                    return;
                }
                if (url === "/__medoc_capture/cmd" && req.method === "GET") {
                    const body = pending;
                    pending = null;
                    json(res, 200, body ?? {});
                    return;
                }
                if (url === "/__medoc_capture/ack" && req.method === "POST") {
                    const body = await readJson(req);
                    const id = typeof body.id === "string" ? body.id : "";
                    if (id) acks.set(id, body);
                    json(res, 200, { ok: true });
                    return;
                }
                if (url.startsWith("/__medoc_capture/result") && req.method === "GET") {
                    const id = new URL(req.url ?? "", "http://127.0.0.1").searchParams.get("id") ?? "";
                    const hit = acks.get(id);
                    if (!hit) {
                        res.statusCode = 204;
                        res.end();
                        return;
                    }
                    acks.delete(id);
                    json(res, 200, hit);
                    return;
                }
                json(res, 404, { ok: false });
            });
        },
    };
}

const pkg = JSON.parse(readFileSync(path.join(__dirname, "package.json"), "utf-8")) as { version: string };

const host = process.env.TAURI_DEV_HOST;
const root = __dirname;

/** Path aliases — tiered packages first, app shell last. */
const medocAliases = [
    { find: "@/lib/mac-window-drag", replacement: path.resolve(root, "src/platform/mac-window-drag.ts") },
    { find: "@/lib/desktop-window-controls", replacement: path.resolve(root, "src/platform/desktop-window-controls.ts") },
    { find: "@/lib/chart-attachments", replacement: path.resolve(root, "src/platform/chart-attachments.ts") },
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
    plugins: [react(), medocCaptureBridge()],
    // Relative URLs so the Tauri webview can load JS/CSS from the embedded dist.
    base: "./",
    define: {
        "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
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
                        "src/lib/**/*.test.ts",
                        "src/lib/**/*.test.tsx",
                    ],
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
                        "../../packages/shared/src/lib/receipt-export-flow.test.ts",
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
                            "../../packages/shared/src/lib/receipt-export-flow.ts",
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
