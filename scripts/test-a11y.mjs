#!/usr/bin/env node

import { createServer } from "node:http";
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);

const HOST = "127.0.0.1";
const PORT = Number(process.env.MEDOC_A11Y_PORT ?? 4173);
const DIST_DIR = resolve(process.cwd(), "apps/practice-host-ui/dist");
const INDEX_FILE = join(DIST_DIR, "index.html");
const SCAN_URL = `http://${HOST}:${PORT}/`;
const WCAG_TAGS = ["wcag2a", "wcag2aa"];

/** @type {Record<string, string>} */
const MIME_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
};

const mimeTypeFor = (filePath) => MIME_TYPES[extname(filePath)] ?? "application/octet-stream";

const toFsPath = (requestUrlPath) => {
    const decoded = decodeURIComponent(requestUrlPath.split("?")[0]);
    const relative = decoded === "/" ? "index.html" : decoded.replace(/^[/\\]+/, "");
    const normalized = normalize(relative).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
    return join(DIST_DIR, normalized);
};

const startStaticServer = async () => {
    const server = createServer(async (req, res) => {
        if (!req.url) {
            res.writeHead(400);
            res.end("Bad request");
            return;
        }

        let filePath = toFsPath(req.url);
        try {
            const stat = await fs.stat(filePath);
            if (stat.isDirectory()) {
                filePath = join(filePath, "index.html");
            }
        } catch {
            filePath = INDEX_FILE;
        }

        try {
            const body = await fs.readFile(filePath);
            res.writeHead(200, { "content-type": mimeTypeFor(filePath) });
            res.end(body);
        } catch (error) {
            res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
            res.end(`Failed to serve ${filePath}: ${String(error)}`);
        }
    });

    await new Promise((resolvePromise, rejectPromise) => {
        server.once("error", rejectPromise);
        server.listen(PORT, HOST, () => resolvePromise());
    });
    return server;
};

const assertBuildExists = async () => {
    try {
        await fs.access(INDEX_FILE);
    } catch {
        throw new Error(
            "Built UI not found at apps/practice-host-ui/dist/index.html. Run the web build before a11y checks.",
        );
    }
};

const readAxeSource = async () => {
    const axePath = require.resolve("axe-core/axe.min.js");
    return fs.readFile(axePath, "utf8");
};

const formatViolation = (violation) => {
    const targets = violation.nodes
        .flatMap((node) => node.target)
        .slice(0, 5)
        .map((target) => `  - ${target}`)
        .join("\n");

    return [
        `Rule: ${violation.id}`,
        `Impact: ${violation.impact ?? "unknown"}`,
        `Help: ${violation.help}`,
        `URL: ${violation.helpUrl}`,
        targets ? `Targets:\n${targets}` : "Targets: (none)",
    ].join("\n");
};

const main = async () => {
    await assertBuildExists();
    const axeSource = await readAxeSource();

    const server = await startStaticServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(SCAN_URL, { waitUntil: "networkidle" });
        await page.addScriptTag({ content: axeSource });

        const result = await page.evaluate(async (tags) => {
            // @ts-expect-error axe is injected at runtime.
            return window.axe.run(document, {
                runOnly: { type: "tag", values: tags },
            });
        }, WCAG_TAGS);

        const criticalViolations = result.violations.filter(
            (violation) => violation.impact === "critical",
        );

        if (criticalViolations.length > 0) {
            console.error(
                `Critical WCAG 2.1 A/AA violations found (${criticalViolations.length}):`,
            );
            for (const violation of criticalViolations) {
                console.error("\n" + formatViolation(violation));
            }
            process.exitCode = 1;
            return;
        }

        console.log(
            `axe-core scan passed: ${result.violations.length} total violations, 0 critical.`,
        );
    } finally {
        await page.close();
        await browser.close();
        await new Promise((resolvePromise) => server.close(() => resolvePromise()));
    }
};

main().catch((error) => {
    console.error(`a11y check failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
});
