import { expect, test } from "@playwright/test";

const uiA11yE2e = process.env.MEDOC_UI_GEOMETRY_E2E === "1";
const AXE_CDN_URL = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.3/axe.min.js";

test.describe("UI rules compliance (axe-core)", () => {
    test.skip(!uiA11yE2e, "Set MEDOC_UI_GEOMETRY_E2E=1 to run browser a11y checks");

    test("login page has zero critical WCAG 2.1 AA violations", async ({ page }) => {
        await page.goto("/login");
        await page.waitForSelector(".login-form");

        await page.addScriptTag({ url: AXE_CDN_URL });
        const report = await page.evaluate(async () => {
            const axe = (window as unknown as { axe?: { run: (ctx: Document, opts: unknown) => Promise<unknown> } })
                .axe;
            if (!axe) {
                throw new Error("axe-core script not loaded");
            }
            return (await axe.run(document, {
                runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
            })) as {
                violations: Array<{ impact?: string }>;
            };
        });

        const critical = report.violations.filter((v) => v.impact === "critical");
        expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
    });
});
