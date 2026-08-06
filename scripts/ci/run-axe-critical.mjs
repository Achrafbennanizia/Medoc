import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const baseUrl = process.argv[2] ?? process.env.A11Y_BASE_URL ?? "http://127.0.0.1:4173";
const routes = (process.env.A11Y_ROUTES ?? "/")
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const criticalViolations = [];

for (const route of routes) {
  const url = new URL(route, baseUrl).toString();
  await page.goto(url, { waitUntil: "networkidle" });

  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const routeCritical = result.violations.filter((violation) => violation.impact === "critical");

  for (const violation of routeCritical) {
    criticalViolations.push({
      route: url,
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      help: violation.help,
      nodes: violation.nodes.map((node) => node.target.join(" ")),
    });
  }
}

await browser.close();

if (criticalViolations.length === 0) {
  console.log(`axe-core scan passed: 0 critical violations across ${routes.length} route(s).`);
  process.exit(0);
}

console.error(`axe-core scan failed: ${criticalViolations.length} critical violation(s).`);
for (const violation of criticalViolations) {
  console.error(`\n[${violation.route}] ${violation.id}: ${violation.description}`);
  console.error(`help: ${violation.help}`);
  if (violation.nodes.length > 0) {
    console.error(`targets: ${violation.nodes.join(", ")}`);
  }
}
process.exit(1);
