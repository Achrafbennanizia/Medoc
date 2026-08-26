import http from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");
const distDir = path.join(appRoot, "dist");
const host = "127.0.0.1";
const port = Number(process.env.MEDOC_A11Y_PORT ?? 4173);
const require = createRequire(import.meta.url);
const axeSourcePath = require.resolve("axe-core/axe.min.js");

const MIME_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".webp": "image/webp",
};

function contentTypeFor(filePath) {
    return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

async function fileExists(filePath) {
    try {
        const info = await stat(filePath);
        return info.isFile();
    } catch {
        return false;
    }
}

async function resolveRequestPath(urlPathname) {
    const decodedPath = decodeURIComponent(urlPathname);
    const sanitizedPath = decodedPath.replace(/^\/+/, "");
    const candidate = path.join(distDir, sanitizedPath);
    if (await fileExists(candidate)) {
        return candidate;
    }

    if (await fileExists(path.join(candidate, "index.html"))) {
        return path.join(candidate, "index.html");
    }

    return path.join(distDir, "index.html");
}

function serveFile(res, filePath) {
    res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
    const stream = createReadStream(filePath);
    stream.on("error", (error) => {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(`Failed to read ${filePath}: ${error.message}`);
    });
    stream.pipe(res);
}

async function startStaticServer() {
    const server = http.createServer(async (req, res) => {
        try {
            if (!req.url) {
                res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
                res.end("Bad request.");
                return;
            }
            const url = new URL(req.url, `http://${host}:${port}`);
            const filePath = await resolveRequestPath(url.pathname);
            serveFile(res, filePath);
        } catch (error) {
            res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
            res.end(`Static server error: ${error.message}`);
        }
    });

    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => resolve());
    });

    return server;
}

function reportCriticalViolations(violations) {
    console.error(`Detected ${violations.length} critical accessibility violation(s):`);
    for (const violation of violations) {
        console.error(`- [${violation.id}] ${violation.help}`);
        for (const node of violation.nodes) {
            const target = node.target.join(" ");
            console.error(`  selector: ${target}`);
            if (node.failureSummary) {
                console.error(`  summary: ${node.failureSummary.trim()}`);
            }
        }
    }
}

async function main() {
    const distStat = await stat(distDir).catch(() => null);
    if (!distStat?.isDirectory()) {
        throw new Error(`Build output not found at ${distDir}. Run "npm run build" first.`);
    }

    const server = await startStaticServer();
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(`http://${host}:${port}`, { waitUntil: "networkidle" });

        const axeSource = await readFile(axeSourcePath, "utf8");
        await page.addScriptTag({ content: axeSource });

        const results = await page.evaluate(async () => {
            return globalThis.axe.run(document, {
                runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
            });
        });

        const criticalViolations = results.violations.filter((violation) => violation.impact === "critical");
        if (criticalViolations.length > 0) {
            reportCriticalViolations(criticalViolations);
            process.exitCode = 1;
            return;
        }

        console.log("No critical WCAG 2.1 A/AA accessibility violations were found.");
    } finally {
        if (browser) {
            await browser.close();
        }
        await new Promise((resolve) => server.close(() => resolve()));
    }
}

main().catch((error) => {
    console.error(`a11y critical check failed: ${error.message}`);
    process.exit(1);
});
