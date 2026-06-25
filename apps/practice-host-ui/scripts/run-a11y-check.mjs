import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const axeScriptPath = require.resolve("axe-core/axe.min.js");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");

const host = "127.0.0.1";
const port = Number.parseInt(process.env.A11Y_PORT ?? "4174", 10);
const routes = (process.env.A11Y_ROUTES ?? "/")
    .split(",")
    .map((route) => route.trim())
    .filter(Boolean);

function contentTypeFor(filePath) {
    if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
    if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
    if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
    if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
    if (filePath.endsWith(".svg")) return "image/svg+xml";
    if (filePath.endsWith(".png")) return "image/png";
    if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
    if (filePath.endsWith(".ico")) return "image/x-icon";
    return "application/octet-stream";
}

async function ensureDistBuildExists() {
    try {
        const info = await stat(distDir);
        if (!info.isDirectory()) {
            throw new Error(`Expected dist directory at ${distDir}, found non-directory.`);
        }
    } catch (error) {
        throw new Error(
            `Missing built UI at ${distDir}. Run "npm run build -w medoc" before test:a11y.`,
            { cause: error },
        );
    }
}

async function startStaticServer() {
    const server = createServer(async (request, response) => {
        try {
            const rawUrl = request.url ?? "/";
            const pathname = decodeURIComponent(rawUrl.split("?")[0]);
            const normalizedPath = pathname === "/" ? "/index.html" : pathname;
            const candidatePath = path.resolve(distDir, `.${normalizedPath}`);

            let filePath = candidatePath;
            if (!filePath.startsWith(distDir)) {
                response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
                response.end("Invalid request path.");
                return;
            }

            try {
                const fileStats = await stat(filePath);
                if (fileStats.isDirectory()) {
                    filePath = path.join(filePath, "index.html");
                }
            } catch {
                // SPA fallback for client-side routes.
                filePath = path.join(distDir, "index.html");
            }

            const body = await readFile(filePath);
            response.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
            response.end(body);
        } catch (error) {
            response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
            response.end(`Failed to serve static asset: ${String(error)}`);
        }
    });

    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, resolve);
    });

    return server;
}

async function runAxeChecks() {
    await ensureDistBuildExists();
    const server = await startStaticServer();
    const browser = await chromium.launch({ headless: true });
    const failures = [];

    try {
        for (const route of routes) {
            const page = await browser.newPage();
            const targetUrl = `http://${host}:${port}${route}`;
            await page.goto(targetUrl, { waitUntil: "networkidle" });
            await page.addScriptTag({ path: axeScriptPath });

            const result = await page.evaluate(async () => {
                return await globalThis.axe.run(document, {
                    runOnly: {
                        type: "tag",
                        values: ["wcag2a", "wcag2aa", "wcag21aa"],
                    },
                });
            });

            const criticalViolations = result.violations.filter(
                (violation) => violation.impact === "critical",
            );

            if (criticalViolations.length > 0) {
                failures.push({ route, criticalViolations });
            }

            await page.close();
        }
    } finally {
        await browser.close();
        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }

    if (failures.length > 0) {
        console.error("Critical WCAG 2.1 A/AA violations found:");
        for (const failure of failures) {
            console.error(`\nRoute: ${failure.route}`);
            for (const violation of failure.criticalViolations) {
                console.error(`- [${violation.id}] ${violation.help}`);
                console.error(`  ${violation.helpUrl}`);
                for (const node of violation.nodes) {
                    console.error(`  selector: ${node.target.join(" ")}`);
                }
            }
        }
        process.exit(1);
    }

    console.log(`axe-core passed: no critical WCAG 2.1 A/AA violations on ${routes.length} route(s).`);
}

await runAxeChecks();
