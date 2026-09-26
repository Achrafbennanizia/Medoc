import { expect, test } from "@playwright/test";

const geometryAuditEnabled = process.env.MEDOC_UI_GEOMETRY === "1";
const VIEWPORTS = [375, 768, 1259] as const;
const SPACING_SCALE_PX = new Set([
    0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 40, 48, 56,
]);

function pxToInt(value: string): number {
    return Math.round(Number.parseFloat(value));
}

test.describe("Login geometry spacing audit", () => {
    test.skip(
        !geometryAuditEnabled,
        "Set MEDOC_UI_GEOMETRY=1 to run responsive geometry and screenshot checks",
    );

    for (const width of VIEWPORTS) {
        test(`login spacing uses token-like values at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/login");

            const wrap = page.locator(".login-form-wrap");
            await expect(wrap).toBeVisible();

            const metrics = await wrap.evaluate((el) => {
                const css = getComputedStyle(el);
                return {
                    paddingLeft: css.paddingLeft,
                    paddingRight: css.paddingRight,
                    paddingTop: css.paddingTop,
                    paddingBottom: css.paddingBottom,
                };
            });

            const values = [
                pxToInt(metrics.paddingLeft),
                pxToInt(metrics.paddingRight),
                pxToInt(metrics.paddingTop),
                pxToInt(metrics.paddingBottom),
            ];

            for (const spacing of values) {
                expect(
                    SPACING_SCALE_PX.has(spacing),
                    `Unexpected spacing token at ${width}px: ${spacing}px`,
                ).toBeTruthy();
            }

            await expect(page).toHaveScreenshot(`login-${width}.png`, {
                fullPage: true,
                maxDiffPixelRatio: 0.02,
            });
        });
    }
});
