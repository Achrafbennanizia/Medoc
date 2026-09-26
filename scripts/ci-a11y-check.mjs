#!/usr/bin/env node

import { chromium } from "@playwright/test";

const targetUrl = process.argv[2];
if (!targetUrl) {
  console.error("Usage: node scripts/ci-a11y-check.mjs <url>");
  process.exit(1);
}

const axeScriptUrl = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.3/axe.min.js";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60_000 });
  await page.addScriptTag({ url: axeScriptUrl });

  const results = await page.evaluate(async () => {
    if (!window.axe) {
      throw new Error("axe-core did not load in the browser context.");
    }
    return window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    });
  });

  const criticalViolations = results.violations.filter(
    (violation) => violation.impact === "critical",
  );

  if (criticalViolations.length > 0) {
    console.error("Critical WCAG 2.1 AA violations detected:");
    for (const violation of criticalViolations) {
      console.error(`- ${violation.id}: ${violation.help}`);
      console.error(`  impact=${violation.impact} helpUrl=${violation.helpUrl}`);
      for (const node of violation.nodes) {
        console.error(`  target=${node.target.join(" | ")}`);
        if (node.failureSummary) {
          console.error(`  summary=${node.failureSummary.trim()}`);
        }
      }
    }
    process.exit(1);
  }

  console.log("No critical WCAG 2.1 AA violations found by axe-core.");
} finally {
  await browser.close();
}
