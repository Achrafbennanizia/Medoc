import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const HOST = "127.0.0.1";
const PORT = 4173;
const APP_URL = `http://${HOST}:${PORT}/`;

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

async function waitForPreview(url, timeoutMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        try {
            const response = await fetch(url, { method: "GET" });
            if (response.ok) {
                return;
            }
        } catch {
            // preview server is not ready yet
        }
        await delay(500);
    }
    throw new Error(`Timed out waiting for preview server at ${url}`);
}

function printViolations(violations) {
    for (const violation of violations) {
        console.error(`\n[${violation.impact}] ${violation.id}: ${violation.help}`);
        console.error(`  ${violation.helpUrl}`);
        for (const node of violation.nodes) {
            console.error(`  target: ${node.target.join(", ")}`);
            if (node.failureSummary) {
                console.error(`  summary: ${node.failureSummary.trim()}`);
            }
        }
    }
}

let previewServer;
let browser;
let browserContext;

try {
    await access("dist");

    previewServer = spawn(
        npmCommand,
        ["run", "preview", "--", "--host", HOST, "--port", String(PORT), "--strictPort"],
        {
            env: process.env,
            stdio: ["ignore", "pipe", "pipe"],
            detached: true,
        },
    );

    previewServer.stdout.on("data", (chunk) => process.stdout.write(chunk));
    previewServer.stderr.on("data", (chunk) => process.stderr.write(chunk));

    await waitForPreview(APP_URL, 60_000);

    browser = await chromium.launch({ headless: true });
    browserContext = await browser.newContext();
    const page = await browserContext.newPage();
    await page.goto(APP_URL, { waitUntil: "networkidle" });

    const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

    const criticalViolations = results.violations.filter(
        (violation) => violation.impact === "critical",
    );

    if (criticalViolations.length > 0) {
        console.error(
            `Found ${criticalViolations.length} critical WCAG 2.1 A/AA violation(s).`,
        );
        printViolations(criticalViolations);
        process.exitCode = 1;
    } else {
        console.log("No critical WCAG 2.1 A/AA violations found.");
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
} finally {
    if (browserContext) {
        await browserContext.close();
    }

    if (browser) {
        await browser.close();
    }

    if (previewServer?.pid) {
        try {
            process.kill(-previewServer.pid, "SIGTERM");
            await delay(1_000);
            process.kill(-previewServer.pid, "SIGKILL");
        } catch {
            // Process group already exited.
        }
    }
}
