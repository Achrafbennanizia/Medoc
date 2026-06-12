import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const baseUrl = (process.env.A11Y_BASE_URL ?? "http://127.0.0.1:4173").replace(/\/$/, "");
const routes = (process.env.A11Y_ROUTES ?? "/")
    .split(",")
    .map((route) => route.trim())
    .filter(Boolean);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
let criticalCount = 0;

try {
    const page = await context.newPage();

    for (const route of routes) {
        const target = `${baseUrl}${route.startsWith("/") ? route : `/${route}`}`;
        await page.goto(target, { waitUntil: "networkidle" });

        const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
        const criticalViolations = result.violations.filter((violation) => violation.impact === "critical");

        if (criticalViolations.length > 0) {
            console.error(`Critical WCAG 2.1 A/AA violations on ${target}:`);
            for (const violation of criticalViolations) {
                console.error(`- ${violation.id}: ${violation.help}`);
                for (const node of violation.nodes) {
                    const targetSelector = node.target.join(", ");
                    console.error(`  • ${targetSelector}`);
                }
            }
        }

        criticalCount += criticalViolations.length;
    }
} finally {
    await context.close();
    await browser.close();
}

if (criticalCount > 0) {
    process.exit(1);
}

console.log("No critical WCAG 2.1 A/AA violations detected.");
