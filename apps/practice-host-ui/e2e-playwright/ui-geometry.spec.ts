import { expect, test } from "@playwright/test";

const SPACING_SCALE_PX = new Set([
    0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96, 112, 128,
    144, 160, 176, 192, 208, 224, 240, 256, 288, 320, 384,
]);

function pxToNumber(raw: string): number | null {
    const match = raw.trim().match(/^(-?\d+(?:\.\d+)?)px$/);
    return match ? Number(match[1]) : null;
}

function expectOnSpacingScale(raw: string, label: string) {
    const value = pxToNumber(raw);
    if (value === null) {
        return;
    }
    expect(
        SPACING_SCALE_PX.has(value),
        `${label}=${raw} should use token spacing`,
    ).toBeTruthy();
}

test.describe("geometry + spacing audit", () => {
    test("onboarding shell uses token spacing values", async ({ page }) => {
        await page.goto("/login");
        await page.waitForLoadState("networkidle");

        const card = page.locator(".onboarding-card").first();
        await expect(card).toBeVisible();

        const cardStyle = await card.evaluate((el) => {
            const style = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return {
                paddingTop: style.paddingTop,
                paddingRight: style.paddingRight,
                paddingBottom: style.paddingBottom,
                paddingLeft: style.paddingLeft,
                borderRadius: style.borderTopLeftRadius,
                width: rect.width,
                height: rect.height,
            };
        });
        expect(cardStyle.width).toBeGreaterThan(200);
        expect(cardStyle.height).toBeGreaterThan(120);
        expectOnSpacingScale(cardStyle.paddingTop, "card.paddingTop");
        expectOnSpacingScale(cardStyle.paddingRight, "card.paddingRight");
        expectOnSpacingScale(cardStyle.paddingBottom, "card.paddingBottom");
        expectOnSpacingScale(cardStyle.paddingLeft, "card.paddingLeft");
        expectOnSpacingScale(cardStyle.borderRadius, "card.borderRadius");

        const actions = page.locator(".onboarding-actions").first();
        if (await actions.isVisible()) {
            const actionStyle = await actions.evaluate((el) => {
                const style = getComputedStyle(el);
                return {
                    gap: style.gap,
                    marginTop: style.marginTop,
                };
            });
            expectOnSpacingScale(actionStyle.gap, "actions.gap");
            expectOnSpacingScale(actionStyle.marginTop, "actions.marginTop");
        }
    });

    for (const width of [375, 768, 1259]) {
        test(`visual regression snapshot at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/login");
            await page.waitForLoadState("networkidle");
            await expect(page).toHaveScreenshot(`workflow-shell-${width}.png`, {
                fullPage: true,
                animations: "disabled",
                maxDiffPixelRatio: 0.02,
            });
        });
    }
});
