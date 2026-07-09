import AxeBuilder from "@axe-core/playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const host = process.env.MEDOC_A11Y_HOST ?? "127.0.0.1";
const port = Number(process.env.MEDOC_A11Y_PORT ?? "4173");
const baseUrl = `http://${host}:${port}`;

function startPreviewServer() {
    return spawn("npm", ["run", "preview", "--", "--host", host, "--port", String(port), "--strictPort"], {
        stdio: "inherit",
        env: process.env,
    });
}

async function waitForServer(url, previewServer, timeoutMs = 120_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (previewServer.exitCode !== null) {
            throw new Error(`Preview server exited early with code ${previewServer.exitCode}.`);
        }
        try {
            const response = await fetch(url, { redirect: "manual" });
            if (response.ok) {
                return;
            }
            if (response.status === 404) {
                throw new Error("Preview server returned 404. Run `npm run build` before `npm run test:a11y`.");
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes("Preview server returned 404")) {
                throw error;
            }
            // Retry until timeout.
        }
        await delay(1_000);
    }
    throw new Error(`Timed out waiting for preview server at ${url}.`);
}

async function stopPreviewServer(previewServer) {
    if (previewServer.exitCode !== null) {
        return;
    }

    previewServer.kill("SIGTERM");
    const killTimeout = delay(10_000).then(() => {
        if (previewServer.exitCode === null) {
            previewServer.kill("SIGKILL");
        }
    });
    await Promise.race([once(previewServer, "exit"), killTimeout]);
}

function printCriticalViolations(violations) {
    console.error(`Found ${violations.length} critical WCAG 2.1 AA violations:`);
    for (const violation of violations) {
        console.error(`- [${violation.id}] ${violation.help}`);
        console.error(`  Help: ${violation.helpUrl}`);
        for (const node of violation.nodes.slice(0, 5)) {
            const target = Array.isArray(node.target) ? node.target.join(", ") : String(node.target);
            console.error(`  Target: ${target}`);
            console.error(`  Failure: ${node.failureSummary ?? "No failure summary provided."}`);
        }
    }
}

async function runA11yCheck() {
    const previewServer = startPreviewServer();
    let browser;
    try {
        await waitForServer(baseUrl, previewServer);
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        const criticalViolations = results.violations.filter((violation) => violation.impact === "critical");
        if (criticalViolations.length > 0) {
            printCriticalViolations(criticalViolations);
            throw new Error("Accessibility check failed due to critical violations.");
        }

        console.log("Accessibility check passed: no critical WCAG 2.1 AA violations found.");
    } finally {
        if (browser) {
            await browser.close();
        }
        await stopPreviewServer(previewServer);
    }
}

runA11yCheck().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
