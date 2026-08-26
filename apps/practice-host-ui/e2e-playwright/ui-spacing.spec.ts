import { expect, test, type Page } from "@playwright/test";

const runUiE2E = process.env.MEDOC_UI_E2E === "1";

const BREAKPOINTS = [375, 768, 1259] as const;
const SPACING_SCALE_PX = new Set([0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32]);

async function readSpacing(page: Page, selector: string) {
    return page.$eval(selector, (node) => {
        const style = getComputedStyle(node as HTMLElement);
        const px = (value: string) => Number.parseFloat(value || "0");
        return {
            paddingTop: px(style.paddingTop),
            paddingRight: px(style.paddingRight),
            paddingBottom: px(style.paddingBottom),
            paddingLeft: px(style.paddingLeft),
            gap: px(style.gap),
        };
    });
}

test.describe("UI spacing + geometry audit", () => {
    test.skip(!runUiE2E, "Set MEDOC_UI_E2E=1 to run browser spacing/snapshot checks");

    for (const width of BREAKPOINTS) {
        test(`login spacing tokens at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/login");

            const inputShell = await readSpacing(page, ".login-password-input-row");
            const emailInput = await readSpacing(page, "#email");

            expect(SPACING_SCALE_PX.has(inputShell.paddingTop)).toBe(true);
            expect(SPACING_SCALE_PX.has(inputShell.paddingLeft)).toBe(true);
            expect(SPACING_SCALE_PX.has(emailInput.paddingTop)).toBe(true);
            expect(SPACING_SCALE_PX.has(emailInput.paddingLeft)).toBe(true);

            await expect(page).toHaveScreenshot(`login-layout-${width}.png`, {
                fullPage: true,
            });
        });
    }
});
