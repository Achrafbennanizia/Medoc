import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectDir = resolve(__dirname, "../../apps/practice-host-ui");

const host = process.env.MEDOC_A11Y_HOST ?? "127.0.0.1";
const port = Number(process.env.MEDOC_A11Y_PORT ?? "4173");
const baseUrl = `http://${host}:${port}`;
const targetPaths = (process.env.MEDOC_A11Y_PATHS ?? "/")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function waitForServerReady(timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(baseUrl, { redirect: "manual" });
            if (response.status > 0) {
                return;
            }
        } catch {
            // Continue polling until timeout.
        }
        await sleep(400);
    }
    throw new Error(`Timed out waiting for preview server at ${baseUrl}`);
}

async function stopProcess(child) {
    if (!child || child.killed) {
        return;
    }

    child.kill("SIGTERM");
    await Promise.race([
        new Promise((resolveStop) => child.once("exit", resolveStop)),
        sleep(5_000),
    ]);

    if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
    }
}

async function run() {
    const preview = spawn("npm", ["run", "preview", "--", "--host", host, "--port", String(port), "--strictPort"], {
        cwd: projectDir,
        stdio: "inherit",
        env: process.env,
    });

    try {
        await waitForServerReady();
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        const criticalFindings = [];
        for (const path of targetPaths) {
            const pageUrl = new URL(path, `${baseUrl}/`).toString();
            await page.goto(pageUrl, { waitUntil: "domcontentloaded" });

            const result = await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa"])
                .analyze();

            for (const violation of result.violations) {
                if (violation.impact !== "critical") {
                    continue;
                }
                criticalFindings.push({
                    page: pageUrl,
                    id: violation.id,
                    description: violation.description,
                    help: violation.help,
                    nodes: violation.nodes.map((node) => node.target.join(" ")),
                });
            }
        }

        await browser.close();

        if (criticalFindings.length > 0) {
            console.error("Critical WCAG 2.1 A/AA violations detected:");
            for (const finding of criticalFindings) {
                console.error(`- [${finding.page}] ${finding.id}: ${finding.help}`);
                console.error(`  ${finding.description}`);
                if (finding.nodes.length > 0) {
                    console.error(`  Targets: ${finding.nodes.join(" | ")}`);
                }
            }
            process.exitCode = 1;
            return;
        }

        console.log(`No critical WCAG 2.1 A/AA violations detected across ${targetPaths.length} page(s).`);
    } finally {
        await stopProcess(preview);
    }
}

run().catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
});
