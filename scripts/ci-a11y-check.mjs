import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const webDir = path.join(repoRoot, "apps", "practice-host-ui");
const distIndexPath = path.join(webDir, "dist", "index.html");

const host = "127.0.0.1";
const port = Number(process.env.MEDOC_A11Y_PORT ?? "4173");
const previewUrl = `http://${host}:${port}`;
const previewTimeoutMs = 60_000;

async function waitForPreviewServer() {
    const deadline = Date.now() + previewTimeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(previewUrl, { method: "GET" });
            if (response.ok) {
                return;
            }
        } catch {
            // Server still starting.
        }
        await delay(500);
    }
    throw new Error(`Timed out waiting for preview server at ${previewUrl}`);
}

function startPreviewProcess() {
    const vitePackagePath = require.resolve("vite/package.json", { paths: [webDir] });
    const viteCliPath = path.join(path.dirname(vitePackagePath), "bin", "vite.js");
    const args = [viteCliPath, "preview", "--host", host, "--port", String(port), "--strictPort"];
    const env = { ...process.env, CI: "1" };

    return spawn(process.execPath, args, {
        cwd: webDir,
        env,
        stdio: ["ignore", "pipe", "pipe"],
    });
}

async function stopProcess(child) {
    if (!child || child.killed || child.exitCode !== null || child.signalCode !== null) {
        return;
    }

    child.kill("SIGTERM");
    const stopped = await Promise.race([
        new Promise((resolve) => child.once("exit", () => resolve(true))),
        delay(5_000).then(() => false),
    ]);

    if (!stopped) {
        child.kill("SIGKILL");
        if (child.exitCode === null && child.signalCode === null) {
            await new Promise((resolve) => child.once("exit", () => resolve(true)));
        }
    }
}

function logViolations(violations) {
    for (const violation of violations) {
        console.error(`- [${violation.impact ?? "unknown"}] ${violation.id}: ${violation.description}`);
        for (const node of violation.nodes) {
            console.error(`  target: ${node.target.join(", ")}`);
            console.error(`  summary: ${node.failureSummary?.trim() ?? "No summary."}`);
        }
    }
}

async function main() {
    await access(distIndexPath, fsConstants.R_OK);

    const preview = startPreviewProcess();
    let previewLogs = "";
    preview.stdout?.on("data", (chunk) => {
        previewLogs += chunk.toString();
    });
    preview.stderr?.on("data", (chunk) => {
        previewLogs += chunk.toString();
    });

    let browser;
    try {
        await waitForPreviewServer();

        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(previewUrl, { waitUntil: "networkidle" });
        await page.waitForLoadState("domcontentloaded");

        const axePath = require.resolve("axe-core/axe.min.js");
        await page.addScriptTag({ path: axePath });

        const result = await page.evaluate(async () => {
            return await globalThis.axe.run(document, {
                runOnly: {
                    type: "tag",
                    values: ["wcag2a", "wcag2aa"],
                },
                resultTypes: ["violations"],
            });
        });

        const criticalViolations = result.violations.filter((violation) => violation.impact === "critical");
        if (criticalViolations.length > 0) {
            console.error(`Found ${criticalViolations.length} critical WCAG 2.1 A/AA axe violation(s).`);
            logViolations(criticalViolations);
            process.exitCode = 1;
            return;
        }

        console.log("A11y check passed: no critical WCAG 2.1 A/AA axe violations detected.");
    } finally {
        if (browser) {
            await browser.close();
        }
        await stopProcess(preview);

        if (process.exitCode && previewLogs.trim().length > 0) {
            console.error("--- preview logs ---");
            console.error(previewLogs.trim());
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
