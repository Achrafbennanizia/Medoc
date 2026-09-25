import { createRequire } from "node:module";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");
const targetUrl = process.env.A11Y_BASE_URL ?? "http://127.0.0.1:4173";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(targetUrl, { waitUntil: "networkidle" });
  await page.addScriptTag({ path: axePath });

  const results = await page.evaluate(async () => {
    return await globalThis.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2aa", "wcag21aa"],
      },
    });
  });

  const criticalViolations = results.violations.filter((violation) => violation.impact === "critical");

  if (criticalViolations.length > 0) {
    console.error(`Found ${criticalViolations.length} critical WCAG 2.1 AA violation(s).`);
    for (const violation of criticalViolations) {
      console.error(`- ${violation.id}: ${violation.help}`);
      console.error(`  Impact: ${violation.impact}`);
      console.error(`  Help URL: ${violation.helpUrl}`);
      for (const node of violation.nodes) {
        console.error(`    Target: ${node.target.join(", ")}`);
      }
    }
    process.exitCode = 1;
  } else {
    console.log("No critical WCAG 2.1 AA violations found by axe-core.");
  }
} finally {
  await browser.close();
}
