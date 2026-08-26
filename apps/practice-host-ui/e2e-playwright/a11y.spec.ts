import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("home page has no critical WCAG 2.1 A/AA violations", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const criticalViolations = violations.filter((violation) => violation.impact === "critical");

    expect(
        criticalViolations,
        criticalViolations
            .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} nodes)`)
            .join("\n")
    ).toHaveLength(0);
});
