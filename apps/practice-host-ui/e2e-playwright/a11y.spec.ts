import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("accessibility", () => {
    test("built UI has no critical WCAG 2.1 A/AA violations", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
        const criticalViolations = results.violations.filter((violation) => violation.impact === "critical");

        const violationSummary = criticalViolations
            .map((violation) => {
                const targets = violation.nodes
                    .flatMap((node) => node.target)
                    .slice(0, 5)
                    .join(", ");
                return `${violation.id}: ${violation.help} [${targets}]`;
            })
            .join("\n");

        expect(
            criticalViolations,
            violationSummary.length > 0
                ? `Critical WCAG 2.1 accessibility violations found:\n${violationSummary}`
                : "No critical WCAG 2.1 accessibility violations were found."
        ).toHaveLength(0);
    });
});
