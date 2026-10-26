import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("home page has no critical WCAG 2.1 A/AA violations", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#root");

    const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
    const criticalViolations = result.violations.filter(
        (violation) => violation.impact === "critical",
    );

    if (criticalViolations.length > 0) {
        // Print machine-readable evidence when the gate fails.
        console.error(JSON.stringify(criticalViolations, null, 2));
    }

    expect(criticalViolations).toEqual([]);
});
