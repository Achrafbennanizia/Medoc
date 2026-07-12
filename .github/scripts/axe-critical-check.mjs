import fs from "node:fs";
import process from "node:process";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const baseUrl = process.env.A11Y_BASE_URL ?? "http://127.0.0.1:4173";
const routes = (process.env.A11Y_ROUTES ?? "/,/login")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const criticalFindings = [];

try {
  for (const route of routes) {
    const url = new URL(route, baseUrl).toString();
    await page.goto(url, { waitUntil: "networkidle" });
    await page.addScriptTag({ content: axeSource });

    const result = await page.evaluate(async () => {
      return window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa"],
        },
      });
    });

    const criticalViolations = result.violations
      .filter((violation) => violation.impact === "critical")
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        help: violation.help,
        helpUrl: violation.helpUrl,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          failureSummary: node.failureSummary,
        })),
      }));

    if (criticalViolations.length > 0) {
      criticalFindings.push({ url, violations: criticalViolations });
    }
  }
} finally {
  await browser.close();
}

if (criticalFindings.length > 0) {
  console.error(
    "Critical WCAG 2.1 AA axe violations detected:\n" +
      JSON.stringify(criticalFindings, null, 2),
  );
  process.exit(1);
}

console.log(
  `Axe check passed for routes: ${routes.join(", ")} (critical WCAG 2.1 AA violations: 0)`,
);
