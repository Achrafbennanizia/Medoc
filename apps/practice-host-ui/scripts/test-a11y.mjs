import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const axeScriptPath = require.resolve("axe-core/axe.min.js");

const distDir = path.resolve(process.cwd(), "dist");
if (!existsSync(distDir)) {
    console.error("A11y check requires a production build. Run `npm run build` first.");
    process.exit(1);
}

const port = Number(process.env.A11Y_PORT ?? "4173");
const host = "127.0.0.1";
const baseUrl = `http://${host}:${port}`;
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

const preview = spawn(
    npxCommand,
    ["vite", "preview", "--host", host, "--strictPort", "--port", String(port)],
    {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
    },
);

let previewStderr = "";
preview.stdout.on("data", (chunk) => process.stdout.write(chunk));
preview.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    previewStderr += text;
    process.stderr.write(text);
});

const stopPreview = () => {
    if (!preview.killed) {
        preview.kill("SIGTERM");
    }
};

const waitForPreview = async () => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        try {
            const response = await fetch(baseUrl, { redirect: "manual" });
            if (response.status >= 200 && response.status < 500) {
                return;
            }
        } catch {
            // Preview is not ready yet.
        }
        await sleep(500);
    }
    throw new Error(
        `Timed out waiting for vite preview at ${baseUrl}. Last stderr:\n${previewStderr}`,
    );
};

let browser;
try {
    await waitForPreview();

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.addScriptTag({ path: axeScriptPath });

    const results = await page.evaluate(async () => {
        return await window.axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
        });
    });
    const criticalViolations = results.violations.filter(
        (violation) => violation.impact === "critical",
    );

    if (criticalViolations.length > 0) {
        console.error("Critical WCAG 2.1 A/AA violations found:");
        for (const violation of criticalViolations) {
            console.error(`- [${violation.id}] ${violation.help}`);
            for (const node of violation.nodes) {
                const target = Array.isArray(node.target) ? node.target.join(" | ") : String(node.target);
                console.error(`    target: ${target}`);
            }
        }
        process.exit(1);
    }

    console.log(
        `A11y check passed: ${results.violations.length} total WCAG 2.1 A/AA violations, 0 critical.`,
    );
} finally {
    if (browser) {
        await browser.close().catch(() => {});
    }
    stopPreview();
}
