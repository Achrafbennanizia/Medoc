import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import process from "node:process";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PREVIEW_HOST = "127.0.0.1";
const PREVIEW_PORT = 4173;
const BASE_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}`;
const TARGET_URL = `${BASE_URL}/login`;
const SERVER_READY_TIMEOUT_MS = 90_000;

function npmCommand() {
    return process.platform === "win32" ? "npm.cmd" : "npm";
}

function startPreviewServer() {
    const child = spawn(
        npmCommand(),
        ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", String(PREVIEW_PORT)],
        {
            cwd: process.cwd(),
            env: { ...process.env, BROWSER: "none" },
            stdio: ["ignore", "pipe", "pipe"],
        },
    );

    child.stdout?.on("data", (chunk) => {
        process.stdout.write(`[preview] ${chunk}`);
    });
    child.stderr?.on("data", (chunk) => {
        process.stderr.write(`[preview] ${chunk}`);
    });

    return child;
}

async function waitForServerReady(url, child, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`Preview server exited early with code ${child.exitCode}.`);
        }
        try {
            const response = await fetch(url, { redirect: "manual" });
            if (response.status >= 200 && response.status < 500) {
                return;
            }
        } catch {
            // server not ready yet
        }
        await delay(1000);
    }
    throw new Error(`Timed out waiting for preview server at ${url}`);
}

async function stopPreviewServer(child) {
    if (!child || child.exitCode !== null) {
        return;
    }

    child.kill("SIGTERM");
    const timeout = setTimeout(() => {
        if (child.exitCode === null) {
            child.kill("SIGKILL");
        }
    }, 5000);

    await new Promise((resolve) => child.once("exit", resolve));
    clearTimeout(timeout);
}

function filterCriticalWcagAaViolations(results) {
    return results.violations.filter((violation) => {
        const aaTag = violation.tags.some((tag) => tag === "wcag2aa" || tag === "wcag21aa");
        return aaTag && violation.impact === "critical";
    });
}

function printViolations(violations) {
    for (const violation of violations) {
        console.error(`\n[critical] ${violation.id}: ${violation.help}`);
        console.error(`- impact: ${violation.impact}`);
        console.error(`- help URL: ${violation.helpUrl}`);
        for (const node of violation.nodes) {
            const targets = node.target.join(", ");
            console.error(`  - target: ${targets}`);
            if (node.failureSummary) {
                console.error(`    summary: ${node.failureSummary.trim()}`);
            }
        }
    }
}

async function run() {
    const previewServer = startPreviewServer();
    let browser;

    try {
        await waitForServerReady(BASE_URL, previewServer, SERVER_READY_TIMEOUT_MS);

        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(TARGET_URL, { waitUntil: "networkidle" });

        const results = await new AxeBuilder({ page })
            .withTags(["wcag2aa", "wcag21aa"])
            .analyze();

        const criticalViolations = filterCriticalWcagAaViolations(results);
        if (criticalViolations.length > 0) {
            printViolations(criticalViolations);
            throw new Error(
                `Found ${criticalViolations.length} critical WCAG 2.1 AA accessibility violation(s).`,
            );
        }

        console.log("Accessibility check passed: no critical WCAG 2.1 AA violations.");
    } finally {
        if (browser) {
            await browser.close();
        }
        await stopPreviewServer(previewServer);
    }
}

run().catch((error) => {
    console.error(error?.message ?? error);
    process.exit(1);
});
