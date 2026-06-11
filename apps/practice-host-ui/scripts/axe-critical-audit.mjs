import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";
import axe from "axe-core";

const HOST = process.env.MEDOC_A11Y_HOST ?? "127.0.0.1";
const PORT = process.env.MEDOC_A11Y_PORT ?? "4173";
const TARGET_PATH = process.env.MEDOC_A11Y_PATH ?? "/login";
const TARGET_URL = `http://${HOST}:${PORT}${TARGET_PATH}`;

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21aa"];

async function waitForServer(url, timeoutMs = 30_000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        try {
            const response = await fetch(url, { redirect: "manual" });
            if (response.status > 0) return;
        } catch {
            // Server is not ready yet.
        }
        await delay(500);
    }
    throw new Error(`Timed out waiting for preview server at ${url}`);
}

async function stopProcess(child) {
    if (!child || child.exitCode !== null) return;
    await new Promise((resolve) => {
        const timer = setTimeout(() => {
            child.kill("SIGKILL");
        }, 5_000);
        child.once("exit", () => {
            clearTimeout(timer);
            resolve();
        });
        child.kill("SIGTERM");
    });
}

function formatCriticalViolations(violations) {
    return violations
        .map((violation) => {
            const nodes = violation.nodes
                .map((node) => `    - ${node.target.join(" ")}`)
                .join("\n");
            return `- ${violation.id}: ${violation.description}\n  help: ${violation.helpUrl}\n${nodes}`;
        })
        .join("\n");
}

async function runAudit() {
    const preview = spawn(
        "npm",
        ["run", "preview", "--", "--host", HOST, "--port", PORT, "--strictPort"],
        { stdio: "inherit", env: process.env },
    );

    let browser;
    try {
        await waitForServer(TARGET_URL);
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(TARGET_URL, { waitUntil: "networkidle" });
        await page.addScriptTag({ content: axe.source });

        const results = await page.evaluate(async (tags) => {
            return window.axe.run(document, {
                runOnly: { type: "tag", values: tags },
            });
        }, WCAG_TAGS);

        const critical = results.violations.filter((violation) => violation.impact === "critical");
        if (critical.length > 0) {
            const rendered = formatCriticalViolations(critical);
            throw new Error(`Critical WCAG violations found:\n${rendered}`);
        }

        // Keep output concise and machine-readable in CI logs.
        console.log(`A11Y_OK critical=0 checked_tags=${WCAG_TAGS.join(",")} url=${TARGET_URL}`);
    } finally {
        await browser?.close();
        await stopProcess(preview);
    }
}

runAudit().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
