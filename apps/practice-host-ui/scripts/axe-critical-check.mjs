import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const targetUrl =
  process.env.A11Y_TARGET_URL || process.argv[2] || "http://127.0.0.1:4173";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60_000 });

  const results = await new AxeBuilder({ page })
    .withTags(["wcag21aa", "wcag2aa"])
    .analyze();

  const criticalViolations = results.violations.filter(
    (violation) => violation.impact === "critical",
  );

  if (criticalViolations.length > 0) {
    console.error(
      `Found ${criticalViolations.length} critical WCAG 2.1 AA violation(s).`,
    );

    for (const violation of criticalViolations) {
      console.error(`- ${violation.id}: ${violation.help}`);
      for (const node of violation.nodes) {
        const selector = node.target.join(", ");
        console.error(`  target: ${selector}`);
      }
    }

    process.exit(1);
  }

  console.log("No critical WCAG 2.1 AA violations detected.");
} finally {
  await context.close();
  await browser.close();
}
