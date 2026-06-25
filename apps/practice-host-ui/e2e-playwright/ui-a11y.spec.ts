import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const runA11yAudit = process.env.MEDOC_UI_A11Y === "1";

test.describe("UI accessibility audit (axe-core)", () => {
    test.skip(!runA11yAudit, "Set MEDOC_UI_A11Y=1 to run axe-core audits.");

    test("login route has zero critical violations", async ({ page }) => {
        await page.goto("/login");
        await page.waitForLoadState("networkidle");

        const scan = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .analyze();

        const critical = scan.violations.filter(
            (violation) => violation.impact === "critical",
        );
        expect(critical, "critical WCAG issues").toEqual([]);
    });
});
