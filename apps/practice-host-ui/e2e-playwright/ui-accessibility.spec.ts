import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function assertNoCriticalAxeViolations(path: string, page: Page) {
    await page.goto(path);
    const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const critical = report.violations.filter((violation) => violation.impact === "critical");
    expect(critical).toEqual([]);
}

test("ui-audit page has zero critical wcag violations", async ({ page }) => {
    await assertNoCriticalAxeViolations("/ui-audit", page);
});

test("login page has zero critical wcag violations", async ({ page }) => {
    await assertNoCriticalAxeViolations("/login", page);
});
