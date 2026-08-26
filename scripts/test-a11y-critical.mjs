import { once } from "node:events";
import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const previewHost = process.env.A11Y_PREVIEW_HOST ?? "127.0.0.1";
const previewPort = process.env.A11Y_PREVIEW_PORT ?? "4173";
const baseUrl = process.env.A11Y_BASE_URL ?? `http://${previewHost}:${previewPort}`;
const targetPath = process.env.A11Y_TARGET_PATH ?? "/";
const targetUrl = new URL(targetPath, `${baseUrl}/`).toString();

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const preview = spawn(
    npmCommand,
    ["run", "preview", "--", "--host", previewHost, "--port", previewPort, "--strictPort"],
    { stdio: "inherit", cwd: process.cwd(), env: process.env },
);

const stopPreview = async () => {
    if (preview.exitCode !== null) {
        return;
    }
    preview.kill("SIGTERM");
    await Promise.race([once(preview, "exit"), delay(5_000)]);
};

const waitForPreview = async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        if (preview.exitCode !== null) {
            throw new Error(`Preview server exited before scan (exit code ${preview.exitCode}).`);
        }
        try {
            const response = await fetch(baseUrl, { redirect: "manual" });
            if (response.status >= 200 && response.status < 500) {
                return;
            }
        } catch {
            // Wait and retry until the preview server is reachable.
        }
        await delay(1_000);
    }
    throw new Error(`Timed out waiting for preview server at ${baseUrl}.`);
};

try {
    await waitForPreview();

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60_000 });

    const report = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

    const criticalViolations = report.violations.filter((violation) => violation.impact === "critical");

    if (criticalViolations.length > 0) {
        console.error("Critical WCAG 2.1 A/AA accessibility violations detected:");
        for (const violation of criticalViolations) {
            const targets = violation.nodes.map((node) => node.target.join(" ")).join(" | ");
            console.error(`- ${violation.id}: ${violation.help}`);
            console.error(`  Impact: ${violation.impact}`);
            console.error(`  Help URL: ${violation.helpUrl}`);
            console.error(`  Targets: ${targets}`);
        }
        process.exitCode = 1;
    } else {
        console.log("No critical WCAG 2.1 A/AA accessibility violations detected.");
    }

    await browser.close();
} catch (error) {
    console.error("Accessibility scan failed to execute:", error);
    process.exitCode = 1;
} finally {
    await stopPreview();
}

if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
}
