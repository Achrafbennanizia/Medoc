import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);

const axeSourcePath = require.resolve("axe-core/axe.min.js");
const distDir = path.resolve(process.cwd(), "dist");
const port = Number(process.env.MEDOC_A11Y_PORT || "4173");
const url = `http://127.0.0.1:${port}`;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(targetUrl) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
        try {
            const response = await fetch(targetUrl);
            if (response.ok) {
                return;
            }
        } catch {
            // Server not ready yet.
        }
        await sleep(500);
    }
    throw new Error(`Timed out waiting for preview server at ${targetUrl}`);
}

async function stopServer(server) {
    if (server.exitCode !== null) {
        return;
    }
    server.kill("SIGTERM");
    await Promise.race([once(server, "close"), sleep(5000)]);
    if (server.exitCode === null) {
        server.kill("SIGKILL");
        await once(server, "close");
    }
}

async function run() {
    await access(distDir);
    const server = spawn("python3", ["-m", "http.server", String(port), "--directory", distDir], {
        stdio: "inherit",
    });

    let browser;
    try {
        await waitForServer(url);

        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "networkidle" });

        const axeSource = await readFile(axeSourcePath, "utf8");
        await page.addScriptTag({ content: axeSource });

        const results = await page.evaluate(async () => {
            return window.axe.run(document, {
                runOnly: {
                    type: "tag",
                    values: ["wcag2a", "wcag2aa"],
                },
            });
        });

        const criticalViolations = results.violations.filter((violation) => violation.impact === "critical");
        if (criticalViolations.length > 0) {
            console.error(`Found ${criticalViolations.length} critical WCAG 2.1 AA violation(s):`);
            for (const violation of criticalViolations) {
                console.error(`- ${violation.id}: ${violation.help}`);
                console.error(`  ${violation.helpUrl}`);
                console.error(`  impacted nodes: ${violation.nodes.length}`);
            }
            process.exitCode = 1;
            return;
        }

        console.log(`No critical WCAG 2.1 AA violations found (total violations: ${results.violations.length}).`);
    } finally {
        if (browser) {
            await browser.close();
        }
        await stopServer(server);
    }
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
