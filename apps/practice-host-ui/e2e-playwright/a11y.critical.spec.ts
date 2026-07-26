import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("login route has no critical WCAG 2.1 AA violations", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const criticalViolations = results.violations.filter((violation) => violation.impact === "critical");
    const criticalViolationIds = criticalViolations.map((violation) => violation.id);

    expect(criticalViolationIds, `Critical violations: ${criticalViolationIds.join(", ")}`).toEqual([]);
});
