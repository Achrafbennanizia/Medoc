#!/usr/bin/env node

import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const axeSourcePath = require.resolve("axe-core/axe.min.js");

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4173";
const routeListArg = process.argv[3] ?? "/";
const reportPath = process.env.A11Y_REPORT_PATH ?? "a11y-report.json";
const routes = routeListArg
    .split(",")
    .map((route) => route.trim())
    .filter(Boolean);

const scans = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
    for (const route of routes) {
        const url = new URL(route, baseUrl).toString();
        await page.goto(url, { waitUntil: "networkidle" });
        await page.addScriptTag({ path: axeSourcePath });

        const result = await page.evaluate(async () => {
            return window.axe.run(document, {
                runOnly: {
                    type: "tag",
                    values: ["wcag2a", "wcag2aa"],
                },
            });
        });

        scans.push({
            route,
            url,
            result,
            criticalViolations: result.violations.filter((violation) => violation.impact === "critical"),
        });
    }
} finally {
    await browser.close();
}

await fs.writeFile(reportPath, JSON.stringify({ baseUrl, routes, scans }, null, 2));

const criticalViolations = scans.flatMap((scan) =>
    scan.criticalViolations.map((violation) => ({
        route: scan.route,
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        helpUrl: violation.helpUrl,
        nodeCount: violation.nodes.length,
    })),
);

if (criticalViolations.length > 0) {
    console.error("Critical WCAG 2.1 AA violations detected:");
    for (const violation of criticalViolations) {
        console.error(
            `- [${violation.route}] ${violation.id} (${violation.impact}) ` +
                `${violation.help} [nodes=${violation.nodeCount}] ${violation.helpUrl}`,
        );
    }
    process.exit(1);
}

console.log(
    `A11y check passed: no critical WCAG 2.1 AA violations on routes ${routes.join(", ")} (report: ${reportPath}).`,
);
