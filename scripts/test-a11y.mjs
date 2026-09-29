#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { createRequire } from "node:module";
import process from "node:process";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const axeSourcePath = require.resolve("axe-core/axe.min.js");

const previewHost = "127.0.0.1";
const previewPort = Number(process.env.MEDOC_A11Y_PORT ?? "4173");
const previewUrl = `http://${previewHost}:${previewPort}`;
const startupTimeoutMs = 60_000;

function detectPackageManager() {
    if (existsSync("pnpm-lock.yaml")) {
        return {
            command: "pnpm",
            buildArgs: ["--filter", "medoc", "run", "build"],
            previewArgs: [
                "--filter",
                "medoc",
                "run",
                "preview",
                "--",
                "--host",
                previewHost,
                "--port",
                String(previewPort),
                "--strictPort",
            ],
        };
    }

    if (existsSync("yarn.lock")) {
        return {
            command: "yarn",
            buildArgs: ["workspace", "medoc", "build"],
            previewArgs: [
                "workspace",
                "medoc",
                "preview",
                "--host",
                previewHost,
                "--port",
                String(previewPort),
                "--strictPort",
            ],
        };
    }

    return {
        command: "npm",
        buildArgs: ["run", "build", "-w", "medoc"],
        previewArgs: [
            "run",
            "preview",
            "-w",
            "medoc",
            "--",
            "--host",
            previewHost,
            "--port",
            String(previewPort),
            "--strictPort",
        ],
    };
}

function spawnCommand(command, args, options = {}) {
    return spawn(command, args, {
        stdio: "inherit",
        shell: false,
        ...options,
    });
}

async function runOrThrow(command, args) {
    await new Promise((resolve, reject) => {
        const child = spawnCommand(command, args);
        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0) {
                resolve(undefined);
                return;
            }
            reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
        });
    });
}

async function waitForPreview(url) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < startupTimeoutMs) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
        } catch {
            // Retry until timeout.
        }
        await delay(1_000);
    }
    throw new Error(`Preview server did not become ready within ${startupTimeoutMs / 1000}s`);
}

async function runAxeAudit(url) {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "networkidle" });
        await page.addScriptTag({ path: axeSourcePath });

        const results = await page.evaluate(async () => {
            return await window.axe.run(document, {
                runOnly: {
                    type: "tag",
                    values: ["wcag21aa"],
                },
            });
        });

        const criticalViolations = results.violations.filter(
            (violation) => violation.impact === "critical" && violation.tags.includes("wcag21aa"),
        );

        if (criticalViolations.length === 0) {
            console.log("A11y check passed: no critical WCAG 2.1 AA violations.");
            return;
        }

        console.error(`A11y check failed: ${criticalViolations.length} critical WCAG 2.1 AA violation(s).`);
        for (const violation of criticalViolations) {
            console.error(`- ${violation.id}: ${violation.help}`);
            for (const node of violation.nodes) {
                console.error(`  selector(s): ${node.target.join(", ")}`);
                console.error(`  summary: ${node.failureSummary?.trim() ?? "No failure summary provided."}`);
            }
        }
        throw new Error("Critical WCAG 2.1 AA violations detected.");
    } finally {
        await browser.close();
    }
}

async function main() {
    const pm = detectPackageManager();
    await runOrThrow(pm.command, pm.buildArgs);

    const previewProcess = spawnCommand(pm.command, pm.previewArgs);

    try {
        await waitForPreview(previewUrl);
        await runAxeAudit(previewUrl);
    } finally {
        previewProcess.kill("SIGTERM");
        await Promise.race([
            new Promise((resolve) => previewProcess.once("exit", resolve)),
            delay(5_000),
        ]);
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
