import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const host = process.env.MEDOC_A11Y_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.MEDOC_A11Y_PORT ?? "4173", 10);
const baseUrl = `http://${host}:${port}`;
const timeoutMs = Number.parseInt(process.env.MEDOC_A11Y_TIMEOUT_MS ?? "60000", 10);

function npmCommand() {
    return process.platform === "win32" ? "npm.cmd" : "npm";
}

function terminatePreview(previewProcess) {
    if (!previewProcess || previewProcess.killed) {
        return;
    }
    previewProcess.kill("SIGTERM");
}

async function waitForServer(url, maxWaitMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < maxWaitMs) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return;
            }
        } catch {
            // Retry until the preview server is ready.
        }
        await delay(1000);
    }
    throw new Error(`Timed out waiting for ${url} after ${maxWaitMs}ms`);
}

async function main() {
    const previewProcess = spawn(
        npmCommand(),
        ["run", "preview", "--", "--host", host, "--port", String(port), "--strictPort"],
        {
            stdio: "inherit",
            env: process.env,
        },
    );

    process.on("exit", () => terminatePreview(previewProcess));
    process.on("SIGINT", () => {
        terminatePreview(previewProcess);
        process.exit(130);
    });
    process.on("SIGTERM", () => {
        terminatePreview(previewProcess);
        process.exit(143);
    });

    let browser;
    try {
        await waitForServer(baseUrl, timeoutMs);

        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(baseUrl, { waitUntil: "networkidle" });

        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        const criticalViolations = violations.filter((violation) => violation.impact === "critical");

        if (criticalViolations.length > 0) {
            console.error(`Found ${criticalViolations.length} critical accessibility violation(s):`);
            for (const violation of criticalViolations) {
                console.error(`- [${violation.id}] ${violation.help}`);
                for (const node of violation.nodes) {
                    console.error(`  target: ${node.target.join(", ")}`);
                }
            }
            process.exitCode = 1;
            return;
        }

        console.log("No critical WCAG 2.1 AA accessibility violations found.");
    } finally {
        if (browser) {
            await browser.close();
        }
        terminatePreview(previewProcess);
    }
}

await main();
