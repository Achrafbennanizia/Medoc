import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "..", "dist");
const host = "127.0.0.1";
const port = Number(process.env.A11Y_PORT || 4173);
const baseUrl = `http://${host}:${port}`;

const mimeTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml; charset=utf-8"
};

async function existingFile(filePath) {
    try {
        const details = await stat(filePath);
        return details.isFile();
    } catch {
        return false;
    }
}

async function resolveResponsePath(requestPath) {
    const cleanPath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
    const absolutePath = path.resolve(distDir, cleanPath);

    if (!absolutePath.startsWith(distDir)) {
        return path.resolve(distDir, "index.html");
    }

    if (await existingFile(absolutePath)) {
        return absolutePath;
    }

    return path.resolve(distDir, "index.html");
}

function contentTypeFor(filePath) {
    const ext = path.extname(filePath);
    return mimeTypes[ext] || "application/octet-stream";
}

async function startServer() {
    const server = createServer(async (req, res) => {
        try {
            const requestPath = new URL(req.url || "/", baseUrl).pathname;
            const filePath = await resolveResponsePath(requestPath);
            const body = await readFile(filePath);
            res.statusCode = 200;
            res.setHeader("content-type", contentTypeFor(filePath));
            res.end(body);
        } catch (error) {
            res.statusCode = 500;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end(`a11y static server error: ${String(error)}`);
        }
    });

    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, resolve);
    });
    return server;
}

function hasWcag21AaTag(violation) {
    return violation.tags.includes("wcag2aa") || violation.tags.includes("wcag21aa");
}

async function main() {
    await stat(distDir);

    const server = await startServer();
    const browser = await chromium.launch({ headless: true });

    try {
        const page = await browser.newPage();
        await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1000);

        const report = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();

        const criticalViolations = report.violations.filter(
            (violation) => violation.impact === "critical" && hasWcag21AaTag(violation)
        );

        if (criticalViolations.length > 0) {
            console.error("Critical WCAG 2.1 AA violations found:");
            for (const violation of criticalViolations) {
                console.error(`- ${violation.id}: ${violation.help}`);
                console.error(`  ${violation.helpUrl}`);
                for (const node of violation.nodes) {
                    console.error(`  target: ${node.target.join(", ")}`);
                    if (node.failureSummary) {
                        console.error(`  summary: ${node.failureSummary.trim()}`);
                    }
                }
            }
            process.exitCode = 1;
            return;
        }

        console.log("No critical WCAG 2.1 AA violations found.");
    } finally {
        await browser.close();
        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
}

main().catch((error) => {
    console.error("a11y test failed:", error);
    process.exitCode = 1;
});
