import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";
import axeCore from "axe-core";

const targetUrl = process.env.A11Y_TARGET_URL ?? "http://127.0.0.1:4173";
const waitTimeoutMs = Number.parseInt(process.env.A11Y_SERVER_WAIT_MS ?? "60000", 10);
const wcagTags = ["wcag2a", "wcag2aa"];

async function waitForServer(url, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url, { redirect: "manual" });
            if (response.status >= 200 && response.status < 500) {
                return;
            }
        } catch {
            // Preview server is still starting.
        }
        await delay(1000);
    }
    throw new Error(`Timed out waiting for preview server at ${url}`);
}

function printViolation(violation) {
    console.error(`- ${violation.id} (${violation.impact ?? "unknown"})`);
    console.error(`  ${violation.help}`);
    console.error(`  ${violation.helpUrl}`);
    for (const node of violation.nodes.slice(0, 3)) {
        console.error(`  selector: ${node.target.join(" | ")}`);
        if (node.failureSummary) {
            console.error(`  ${node.failureSummary.trim()}`);
        }
    }
}

async function run() {
    await waitForServer(targetUrl, waitTimeoutMs);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
        await page.goto(targetUrl, { waitUntil: "networkidle" });
        await page.addScriptTag({ content: axeCore.source });

        const results = await page.evaluate(async (tags) => {
            return await window.axe.run(document, {
                runOnly: { type: "tag", values: tags },
            });
        }, wcagTags);

        const criticalViolations = results.violations.filter(
            (violation) => violation.impact === "critical"
        );

        if (criticalViolations.length > 0) {
            console.error(
                `Critical WCAG 2.1 AA violations: ${criticalViolations.length}`
            );
            for (const violation of criticalViolations) {
                printViolation(violation);
            }
            process.exitCode = 1;
            return;
        }

        console.log(
            `No critical WCAG 2.1 AA violations found at ${targetUrl} (total violations: ${results.violations.length}).`
        );
    } finally {
        await browser.close();
    }
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
