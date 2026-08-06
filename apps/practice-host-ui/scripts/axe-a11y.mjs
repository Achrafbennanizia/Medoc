import { spawn } from "node:child_process";
import { once } from "node:events";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const HOST = "127.0.0.1";
const PORT = Number(process.env.A11Y_PORT || 4173);
const BASE_URL = process.env.A11Y_BASE_URL || `http://${HOST}:${PORT}`;
const SERVER_TIMEOUT_MS = 45_000;
const ROUTES_TO_SCAN = ["/login", "/"];

async function waitForPreviewServer(url, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url, { redirect: "manual" });
            if (response.status >= 200 && response.status < 500) {
                return;
            }
        } catch {
            // Retry until timeout while the preview server starts.
        }
        await sleep(500);
    }

    throw new Error(`Timed out waiting for preview server at ${url}`);
}

function logCriticalViolation(route, violation) {
    console.error(`\n[critical] route=${route} id=${violation.id}`);
    console.error(`description: ${violation.description}`);
    console.error(`help: ${violation.help}`);
    for (const node of violation.nodes) {
        console.error(`  target: ${node.target.join(" -> ")}`);
        console.error(`  summary: ${node.failureSummary || "n/a"}`);
    }
}

async function runAccessibilityAudit(browser) {
    const page = await browser.newPage();
    let criticalCount = 0;

    for (const route of ROUTES_TO_SCAN) {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
        const criticalViolations = results.violations.filter((violation) => violation.impact === "critical");

        if (criticalViolations.length === 0) {
            console.log(`[a11y] ${route}: no critical WCAG 2.1 AA violations`);
            continue;
        }

        for (const violation of criticalViolations) {
            logCriticalViolation(route, violation);
        }
        criticalCount += criticalViolations.length;
    }

    await page.close();

    if (criticalCount > 0) {
        console.error(`\nFound ${criticalCount} critical accessibility violation(s).`);
        return 1;
    }

    console.log("\nAccessibility audit passed: 0 critical violations detected.");
    return 0;
}

async function main() {
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    const previewServer = spawn(
        npmCommand,
        ["run", "preview", "--", "--host", HOST, "--port", String(PORT)],
        {
            stdio: "inherit",
            env: process.env,
        },
    );

    let browser;
    try {
        await waitForPreviewServer(`${BASE_URL}/login`, SERVER_TIMEOUT_MS);
        browser = await chromium.launch({ headless: true });
        const exitCode = await runAccessibilityAudit(browser);
        process.exit(exitCode);
    } finally {
        if (browser) {
            await browser.close();
        }

        if (previewServer.exitCode === null && !previewServer.killed) {
            previewServer.kill("SIGTERM");
            await Promise.race([once(previewServer, "exit"), sleep(5_000)]);
            if (previewServer.exitCode === null && !previewServer.killed) {
                previewServer.kill("SIGKILL");
            }
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
