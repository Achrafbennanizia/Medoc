import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const uiRulesEnabled = process.env.MEDOC_UI_RULES === "1";
const viewports = [375, 768, 1259];

async function gotoLoginSurface(page: Parameters<typeof test>[1]["page"]) {
    await page.goto("/login");
    const continueWithoutVerbund = page.getByRole("button", { name: /ohne verbund fortfahren/i });
    if (await continueWithoutVerbund.isVisible({ timeout: 1500 }).catch(() => false)) {
        await continueWithoutVerbund.click();
    }
    await expect(page.getByRole("heading", { name: /anmelden|login/i })).toBeVisible();
}

async function expectVisibleFocusRing(page: Parameters<typeof test>[1]["page"]) {
    const hasFocusRing = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active) return false;
        const style = getComputedStyle(active);
        return style.outlineStyle !== "none" || style.boxShadow !== "none";
    });
    expect(hasFocusRing).toBe(true);
}

test.describe("UI rules compliance (login surface)", () => {
    test.skip(!uiRulesEnabled, "Set MEDOC_UI_RULES=1 to run axe/focus/order checks.");

    for (const width of viewports) {
        test(`axe + keyboard order @${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 1024 });
            await gotoLoginSurface(page);

            const axe = await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa"])
                .analyze();
            const critical = axe.violations.filter((violation) => violation.impact === "critical");
            expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);

            // Tab order: email -> password -> forgot-password helper.
            await page.keyboard.press("Tab");
            await expect(page.locator("#email")).toBeFocused();
            await expectVisibleFocusRing(page);

            await page.keyboard.press("Tab");
            await expect(page.locator("button[aria-describedby='login-teaser-hint']")).toBeFocused();
            await expectVisibleFocusRing(page);

            await page.keyboard.press("Tab");
            await expect(page.locator("#passwort")).toBeFocused();
            await expectVisibleFocusRing(page);

            // Every icon-only button on login has an explicit label.
            const unlabeledIconButtons = await page.locator("button.icon-btn:not([aria-label])").count();
            expect(unlabeledIconButtons).toBe(0);
        });
    }
});
