import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const host = process.env.A11Y_HOST ?? "127.0.0.1";
const port = process.env.A11Y_PORT ?? "4173";
const baseUrl = `http://${host}:${port}`;
const previewArgs = ["run", "preview", "--", "--host", host, "--port", port, "--strictPort"];

async function waitForServer(url, timeoutMs = 60_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return;
            }
        } catch {
            // Server is still booting.
        }
        await delay(500);
    }
    throw new Error(`Timed out waiting for preview server at ${url}`);
}

function logCriticalViolations(violations) {
    console.error(`Found ${violations.length} critical WCAG 2.1 AA violations.`);
    for (const violation of violations) {
        console.error(`- ${violation.id}: ${violation.help}`);
        for (const node of violation.nodes) {
            const target = node.target.join(" ");
            console.error(`  target=${target}`);
            if (node.failureSummary) {
                console.error(`  summary=${node.failureSummary.trim()}`);
            }
        }
    }
}

async function stopProcess(child) {
    if (child.exitCode !== null) {
        return;
    }
    child.kill("SIGTERM");
    const exited = await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        delay(5_000).then(() => false),
    ]);
    if (!exited && child.exitCode === null) {
        child.kill("SIGKILL");
        await new Promise((resolve) => child.once("exit", resolve));
    }
}

async function run() {
    const preview = spawn("npm", previewArgs, {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
    });
    preview.stdout.on("data", (chunk) => process.stdout.write(chunk));
    preview.stderr.on("data", (chunk) => process.stderr.write(chunk));

    let browser;
    try {
        await waitForServer(baseUrl);
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(baseUrl, { waitUntil: "networkidle" });

        const results = await new AxeBuilder({ page }).withTags(["wcag2aa", "wcag21aa"]).analyze();
        const critical = results.violations.filter((violation) => violation.impact === "critical");
        if (critical.length > 0) {
            logCriticalViolations(critical);
            process.exitCode = 1;
        } else {
            console.log("No critical WCAG 2.1 AA violations found by axe-core.");
        }
    } finally {
        if (browser) {
            await browser.close();
        }
        await stopProcess(preview);
    }
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
