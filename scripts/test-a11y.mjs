import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import process from "node:process";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const host = process.env.A11Y_HOST ?? "127.0.0.1";
const port = process.env.A11Y_PORT ?? "4173";
const baseUrl = `http://${host}:${port}`;
const routesToCheck = ["/"];
const serverStartupTimeoutMs = 30_000;
const serverPollIntervalMs = 500;
const distDir = join(process.cwd(), "dist");

const MIME_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
};

async function waitForServer(url, timeoutMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        try {
            const response = await fetch(url, { redirect: "manual" });
            if (response.status >= 200 && response.status < 500) {
                return;
            }
        } catch {
            // Preview server is not ready yet.
        }
        await delay(serverPollIntervalMs);
    }
    throw new Error(`Timed out waiting for preview server at ${url}`);
}

async function readStaticFile(pathname) {
    const requested = pathname === "/" ? "index.html" : pathname.slice(1);
    const normalizedPath = normalize(join(distDir, requested));
    if (!normalizedPath.startsWith(distDir)) {
        throw new Error("Path traversal blocked");
    }
    try {
        return await readFile(normalizedPath);
    } catch {
        // SPA fallback for deep links.
        return readFile(join(distDir, "index.html"));
    }
}

async function run() {
    const server = createServer(async (req, res) => {
        try {
            const requestUrl = new URL(req.url ?? "/", baseUrl);
            const body = await readStaticFile(requestUrl.pathname);
            const ext = extname(requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname);
            res.statusCode = 200;
            res.setHeader("content-type", MIME_TYPES[ext] ?? "application/octet-stream");
            res.end(body);
        } catch (error) {
            res.statusCode = 500;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end(`a11y static server error: ${String(error)}`);
        }
    });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(Number(port), host, resolve);
    });

    let browser;
    let context;
    let criticalViolations = [];

    try {
        await waitForServer(baseUrl, serverStartupTimeoutMs);
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext();
        const page = await context.newPage();

        for (const route of routesToCheck) {
            const targetUrl = `${baseUrl}${route}`;
            await page.goto(targetUrl, { waitUntil: "networkidle" });

            const results = await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa"])
                .analyze();

            const routeCriticals = results.violations
                .filter((violation) => violation.impact === "critical")
                .map((violation) => ({ route, violation }));
            criticalViolations = criticalViolations.concat(routeCriticals);
        }
    } finally {
        if (context) {
            await context.close();
        }
        if (browser) {
            await browser.close();
        }
        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) reject(error);
                else resolve();
            });
        });
    }

    if (criticalViolations.length > 0) {
        console.error("Critical WCAG 2.1 A/AA violations detected by axe-core:");
        for (const { route, violation } of criticalViolations) {
            console.error(`- [${route}] ${violation.id}: ${violation.help}`);
            console.error(`  Help URL: ${violation.helpUrl}`);
            for (const node of violation.nodes) {
                console.error(`  Node: ${node.target.join(", ")}`);
                if (node.failureSummary) {
                    console.error(`    ${node.failureSummary.replace(/\n/g, " ").trim()}`);
                }
            }
        }
        process.exitCode = 1;
        return;
    }

    console.log("No critical WCAG 2.1 A/AA violations were found by axe-core.");
}

run().catch((error) => {
    console.error(`a11y check failed: ${error.message}`);
    process.exitCode = 1;
});
