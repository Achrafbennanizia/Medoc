import { createServer } from "node:http";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import axeCore from "axe-core";

const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.MEDOC_A11Y_PORT ?? "4173", 10);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(__dirname, "..");
const distRoot = path.join(uiRoot, "dist");
const indexPath = path.join(distRoot, "index.html");

const MIME_TYPES = new Map([
    [".css", "text/css; charset=utf-8"],
    [".html", "text/html; charset=utf-8"],
    [".ico", "image/x-icon"],
    [".js", "application/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".map", "application/json; charset=utf-8"],
    [".png", "image/png"],
    [".svg", "image/svg+xml"],
    [".txt", "text/plain; charset=utf-8"],
    [".woff", "font/woff"],
    [".woff2", "font/woff2"],
]);

function contentTypeFor(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES.get(ext) ?? "application/octet-stream";
}

async function fileExists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function resolveStaticPath(urlPathname) {
    const rawPath = urlPathname === "/" ? "/index.html" : urlPathname;
    const normalizedPath = path
        .normalize(rawPath)
        .replace(/^(\.\.(\/|\\|$))+/, "");
    const absolutePath = path.resolve(distRoot, `.${normalizedPath}`);
    if (!absolutePath.startsWith(distRoot)) {
        return null;
    }

    if (await fileExists(absolutePath)) {
        const metadata = await stat(absolutePath);
        if (metadata.isFile()) {
            return absolutePath;
        }
    }

    return indexPath;
}

function formatViolation(violation) {
    const impacted = violation.nodes.slice(0, 5).map((node) => node.target.join(" "));
    return [
        `- [${violation.impact}] ${violation.id}: ${violation.help}`,
        `  Help: ${violation.helpUrl}`,
        `  Targets: ${impacted.length > 0 ? impacted.join(" | ") : "(none reported)"}`,
    ].join("\n");
}

async function run() {
    if (!(await fileExists(indexPath))) {
        throw new Error(
            `Built UI not found at ${indexPath}. Run "npm run build -w medoc" before test:a11y.`,
        );
    }

    const server = createServer(async (request, response) => {
        try {
            const requestUrl = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);
            const resolvedPath = await resolveStaticPath(requestUrl.pathname);
            if (!resolvedPath) {
                response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
                response.end("Forbidden");
                return;
            }

            const body = await readFile(resolvedPath);
            response.writeHead(200, {
                "content-type": contentTypeFor(resolvedPath),
                "cache-control": "no-cache",
            });
            response.end(body);
        } catch (error) {
            response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
            response.end(`a11y server error: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(PORT, HOST, () => resolve());
    });

    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        const pageErrors = [];
        page.on("pageerror", (error) => {
            pageErrors.push(error.message);
        });

        await page.goto(`http://${HOST}:${PORT}`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("#root", { state: "attached" });
        await page.waitForTimeout(1500);

        const renderedNodeCount = await page.locator("#root *").count();
        if (renderedNodeCount === 0) {
            throw new Error("No rendered UI nodes were detected under #root; refusing to run a11y gate.");
        }

        await page.addScriptTag({ content: axeCore.source });
        const results = await page.evaluate(async () => {
            return window.axe.run(document, {
                resultTypes: ["violations"],
                runOnly: {
                    type: "tag",
                    values: ["wcag2a", "wcag2aa"],
                },
            });
        });

        if (pageErrors.length > 0) {
            console.warn("Observed page errors during a11y scan:");
            for (const message of pageErrors) {
                console.warn(`- ${message}`);
            }
        }

        const criticalViolations = results.violations.filter(
            (violation) => violation.impact === "critical",
        );

        if (criticalViolations.length > 0) {
            console.error(
                `Found ${criticalViolations.length} critical WCAG 2.1 A/AA axe violation(s):`,
            );
            for (const violation of criticalViolations) {
                console.error(formatViolation(violation));
            }
            process.exitCode = 1;
            return;
        }

        console.log(
            `A11y critical gate passed: 0 critical WCAG 2.1 A/AA violations across ${results.violations.length} total violations.`,
        );
    } finally {
        if (browser) {
            await browser.close();
        }
        await new Promise((resolve) => {
            server.close(() => resolve());
        });
    }
}

run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
