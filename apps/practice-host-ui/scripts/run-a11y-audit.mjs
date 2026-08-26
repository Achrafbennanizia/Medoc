import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";

import { chromium } from "playwright";

const require = createRequire(import.meta.url);

const PREVIEW_HOST = process.env.A11Y_PREVIEW_HOST ?? "127.0.0.1";
const PREVIEW_PORT = process.env.A11Y_PREVIEW_PORT ?? "4173";
const PREVIEW_URL = `http://${PREVIEW_HOST}:${PREVIEW_PORT}`;

function resolvePackageManager() {
    const explicit = process.env.A11Y_PACKAGE_MANAGER?.trim();
    if (explicit) return explicit;

    const userAgent = process.env.npm_config_user_agent ?? "";
    if (userAgent.startsWith("pnpm/")) return "pnpm";
    if (userAgent.startsWith("yarn/")) return "yarn";
    return "npm";
}

function previewCommand(packageManager) {
    if (packageManager === "pnpm") {
        return {
            command: "pnpm",
            args: ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT, "--strictPort"],
        };
    }
    if (packageManager === "yarn") {
        return {
            command: "yarn",
            args: ["run", "preview", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT, "--strictPort"],
        };
    }
    return {
        command: "npm",
        args: ["run", "preview", "--", "--host", PREVIEW_HOST, "--port", PREVIEW_PORT, "--strictPort"],
    };
}

async function waitForPreviewServer(previewProcess, timeoutMs = 45_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (previewProcess.exitCode !== null) {
            throw new Error(`vite preview exited early with code ${previewProcess.exitCode}`);
        }
        try {
            const response = await fetch(PREVIEW_URL, { redirect: "manual" });
            if (response.ok || response.status === 302 || response.status === 304) {
                return;
            }
        } catch {
            // keep polling
        }
        await sleep(500);
    }
    throw new Error(`Timed out waiting for vite preview at ${PREVIEW_URL}`);
}

function printCriticalViolation(violation) {
    console.error(`\n[critical] ${violation.id}: ${violation.help}`);
    console.error(`  Impact: ${violation.impact}`);
    console.error(`  Help URL: ${violation.helpUrl}`);
    for (const node of violation.nodes) {
        const target = node.target.join(" | ");
        console.error(`  Target: ${target}`);
        if (node.failureSummary) {
            console.error(`  Failure: ${node.failureSummary.trim()}`);
        }
    }
}

let previewProcess;

try {
    const packageManager = resolvePackageManager();
    const { command, args } = previewCommand(packageManager);
    console.log(`Using ${packageManager} to start preview server.`);

    previewProcess = spawn(
        command,
        args,
        {
            cwd: process.cwd(),
            env: process.env,
            stdio: ["ignore", "pipe", "pipe"],
        },
    );
    previewProcess.stdout.on("data", (chunk) => process.stdout.write(chunk));
    previewProcess.stderr.on("data", (chunk) => process.stderr.write(chunk));

    await waitForPreviewServer(previewProcess);

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(PREVIEW_URL, { waitUntil: "networkidle" });

    const axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
    await page.addScriptTag({ content: axeSource });

    const axeResult = await page.evaluate(async () =>
        window.axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
            resultTypes: ["violations"],
        }),
    );

    await browser.close();

    const criticalViolations = axeResult.violations.filter((violation) => violation.impact === "critical");

    if (criticalViolations.length > 0) {
        console.error(`Found ${criticalViolations.length} critical WCAG 2.1 A/AA axe violations.`);
        for (const violation of criticalViolations) {
            printCriticalViolation(violation);
        }
        process.exitCode = 1;
    } else {
        console.log("No critical WCAG 2.1 A/AA axe violations detected.");
    }
} finally {
    if (previewProcess && previewProcess.exitCode === null) {
        previewProcess.kill("SIGTERM");
        await Promise.race([once(previewProcess, "exit"), sleep(5_000)]);
        if (previewProcess.exitCode === null) {
            previewProcess.kill("SIGKILL");
        }
    }
}
