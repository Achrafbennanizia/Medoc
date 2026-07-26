import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const PREVIEW_PORT = process.env.MEDOC_A11Y_PORT ?? "4173";
const PREVIEW_HOST = process.env.MEDOC_A11Y_HOST ?? "127.0.0.1";
const PREVIEW_URL = process.env.MEDOC_A11Y_URL ?? `http://${PREVIEW_HOST}:${PREVIEW_PORT}`;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "../apps/practice-host-ui");

function startPreview() {
    const child = spawn(
        "npm",
        ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT, "--strictPort"],
        { cwd: appDir, stdio: ["ignore", "pipe", "pipe"] },
    );
    return child;
}

async function waitForPreview(child) {
    let ready = false;
    const readyPatterns = [`http://${PREVIEW_HOST}:${PREVIEW_PORT}`, "Local:"];

    const onOutput = (chunk) => {
        const text = chunk.toString();
        process.stdout.write(text);
        if (readyPatterns.some((pattern) => text.includes(pattern))) {
            ready = true;
        }
    };

    child.stdout.on("data", onOutput);
    child.stderr.on("data", onOutput);

    for (let i = 0; i < 80; i += 1) {
        if (ready) return;
        if (child.exitCode !== null) {
            throw new Error(`Preview server exited early with code ${child.exitCode}.`);
        }
        await sleep(250);
    }

    throw new Error("Timed out waiting for the preview server to become ready.");
}

async function stopPreview(child) {
    if (child.exitCode !== null) return;
    child.kill("SIGTERM");
    for (let i = 0; i < 20; i += 1) {
        if (child.exitCode !== null) return;
        await sleep(100);
    }
    child.kill("SIGKILL");
}

function printCriticalViolations(violations) {
    console.error(`Found ${violations.length} critical WCAG 2.1 A/AA axe-core violation(s).`);
    for (const violation of violations) {
        console.error(`\n- ${violation.id}: ${violation.help}`);
        console.error(`  Help URL: ${violation.helpUrl}`);
        for (const node of violation.nodes) {
            console.error(`  Selector: ${node.target.join(", ")}`);
            console.error(`  Failure summary: ${node.failureSummary ?? "n/a"}`);
        }
    }
}

async function runA11yCheck() {
    const preview = startPreview();
    let browser;

    try {
        await waitForPreview(preview);

        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(PREVIEW_URL, { waitUntil: "networkidle" });

        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .analyze();

        const criticalViolations = results.violations.filter(
            (violation) => violation.impact === "critical",
        );

        if (criticalViolations.length > 0) {
            printCriticalViolations(criticalViolations);
            process.exitCode = 1;
            return;
        }

        console.log("A11y check passed: no critical WCAG 2.1 A/AA violations found.");
    } finally {
        if (browser) {
            await browser.close();
        }
        await stopPreview(preview);
    }
}

await runA11yCheck();
