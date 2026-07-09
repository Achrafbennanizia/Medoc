import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const PREVIEW_HOST = process.env.A11Y_PREVIEW_HOST ?? "127.0.0.1";
const PREVIEW_PORT = process.env.A11Y_PREVIEW_PORT ?? "4173";
const BASE_URL = process.env.A11Y_BASE_URL ?? `http://${PREVIEW_HOST}:${PREVIEW_PORT}`;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const require = createRequire(import.meta.url);

function stopPreview(previewProcess) {
    if (!previewProcess || previewProcess.killed || previewProcess.exitCode !== null) {
        return;
    }
    previewProcess.kill("SIGTERM");
}

async function waitForPreviewReady(previewProcess, timeoutMs = 30_000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        if (previewProcess.exitCode !== null) {
            throw new Error(`vite preview exited early with code ${previewProcess.exitCode}`);
        }
        try {
            const response = await fetch(BASE_URL, { redirect: "manual" });
            if (response.status >= 200 && response.status < 500) {
                return;
            }
        } catch {
            // ignore connection errors while waiting for preview startup
        }
        await delay(500);
    }
    throw new Error(`Timed out waiting for vite preview at ${BASE_URL}`);
}

let previewProcess;
let browser;

try {
    previewProcess = spawn(
        npmCommand,
        ["exec", "vite", "preview", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT, "--strictPort"],
        { stdio: "inherit" },
    );

    await waitForPreviewReady(previewProcess);

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    const axeSourcePath = require.resolve("axe-core/axe.min.js");
    const axeSource = await readFile(axeSourcePath, "utf8");
    await page.addScriptTag({ content: axeSource });

    const results = await page.evaluate(async () => {
        return await window.axe.run(document, {
            runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa"],
            },
        });
    });

    const criticalViolations = results.violations.filter((violation) => violation.impact === "critical");
    if (criticalViolations.length > 0) {
        console.error("Critical WCAG 2.1 A/AA violations detected:");
        console.error(JSON.stringify(criticalViolations, null, 2));
        process.exitCode = 1;
    } else {
        console.log("A11y check passed: no critical WCAG 2.1 A/AA violations.");
    }
} finally {
    if (browser) {
        await browser.close();
    }
    stopPreview(previewProcess);
}

if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
}
