#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const previewHost = process.env.A11Y_PREVIEW_HOST ?? "127.0.0.1";
const previewPort = process.env.A11Y_PREVIEW_PORT ?? String(4600 + Math.floor(Math.random() * 300));
const targetUrl = process.env.A11Y_TARGET_URL ?? `http://${previewHost}:${previewPort}`;
const viteExec =
    process.platform === "win32"
        ? path.resolve("node_modules", ".bin", "vite.cmd")
        : path.resolve("node_modules", ".bin", "vite");

async function waitForServer(url, previewProcess, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (previewProcess?.exitCode !== null && previewProcess?.exitCode !== 0) {
            throw new Error(`Preview process exited before ${url} became available (exit ${previewProcess.exitCode})`);
        }
        try {
            const response = await fetch(url, { method: "GET" });
            if (response.status < 500) {
                return;
            }
        } catch {
            // Retry until timeout.
        }
        await delay(500);
    }
    throw new Error(`Timed out waiting for ${url}`);
}

async function runAxeAudit(url) {
    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(url, { waitUntil: "networkidle" });
        const report = await new AxeBuilder({ page }).withTags(["wcag21aa"]).analyze();
        await context.close();
        return report;
    } finally {
        await browser.close();
    }
}

async function stopPreview(previewProcess) {
    if (!previewProcess || previewProcess.exitCode !== null) {
        return;
    }
    if (process.platform === "win32") {
        previewProcess.kill("SIGTERM");
    } else if (previewProcess.pid) {
        process.kill(-previewProcess.pid, "SIGTERM");
    } else {
        previewProcess.kill("SIGTERM");
    }
    await delay(1000);
    if (previewProcess.exitCode === null) {
        if (process.platform === "win32") {
            previewProcess.kill("SIGKILL");
        } else if (previewProcess.pid) {
            process.kill(-previewProcess.pid, "SIGKILL");
        } else {
            previewProcess.kill("SIGKILL");
        }
    }
}

let preview;
try {
    preview = spawn(
        viteExec,
        ["preview", "--host", previewHost, "--port", previewPort, "--strictPort"],
        { stdio: "inherit", env: process.env, detached: process.platform !== "win32" },
    );

    await waitForServer(targetUrl, preview);
    const report = await runAxeAudit(targetUrl);
    const critical = report.violations.filter((violation) => violation?.impact === "critical");

    if (critical.length > 0) {
        console.error(`Critical WCAG 2.1 AA violations: ${critical.length}`);
        for (const violation of critical) {
            const nodes = Array.isArray(violation.nodes) ? violation.nodes.length : 0;
            console.error(`- ${violation.id} (${nodes} nodes): ${violation.help ?? "no help text"}`);
            if (violation.helpUrl) {
                console.error(`  ${violation.helpUrl}`);
            }
        }
        process.exit(1);
    }
    console.log("axe-core check passed: no critical WCAG 2.1 AA violations.");
} finally {
    await stopPreview(preview);
}
