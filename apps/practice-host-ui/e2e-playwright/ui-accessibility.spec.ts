import { expect, test } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const specDir = dirname(fileURLToPath(import.meta.url));
const axeRuntimePath = join(specDir, "fixtures", "axe.min.js");

test.describe("login accessibility audit", () => {
    test("has no critical WCAG violations", async ({ page }) => {
        await page.setViewportSize({ width: 1259, height: 900 });
        await page.goto("/e2e/login-layout");
        await expect(page.locator(".login-form")).toBeVisible();

        await page.addScriptTag({
            path: axeRuntimePath,
        });
        const accessibilityScanResults = await page.evaluate(async () => {
            const axe = (window as { axe?: { run: (node?: unknown) => Promise<unknown> } }).axe;
            if (!axe) {
                throw new Error("axe runtime failed to load");
            }
            return (await axe.run(document)) as { violations: Array<{ impact: string | null }> };
        });
        const criticalViolations = accessibilityScanResults.violations.filter(
            (violation) => violation.impact === "critical",
        );

        expect(criticalViolations).toEqual([]);
    });
});
