import { expect, test } from "@playwright/test";

const uiGeometry = process.env.MEDOC_UI_GEOMETRY === "1";
const BREAKPOINTS = [375, 768, 1259];
const PALENIGHT_SPACING_SCALE_PX = new Set([
    0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72,
    80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 288, 320, 384,
]);

test.describe("UI geometry + spacing audit", () => {
    test.skip(!uiGeometry, "Set MEDOC_UI_GEOMETRY=1 to run browser geometry checks");

    for (const width of BREAKPOINTS) {
        test(`login page geometry remains stable at ${width}px`, async ({
            page,
        }, testInfo) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/login");
            await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();

            const overflow = await page.evaluate(
                () => document.documentElement.scrollWidth > window.innerWidth + 1,
            );
            expect(overflow).toBe(false);

            const spacing = await page.locator("#email").evaluate((node) => {
                const style = getComputedStyle(node as HTMLElement);
                const rect = (node as HTMLElement).getBoundingClientRect();
                return {
                    marginBottom: Math.round(Number.parseFloat(style.marginBottom)),
                    paddingInline:
                        Math.round(Number.parseFloat(style.paddingLeft)) +
                        Math.round(Number.parseFloat(style.paddingRight)),
                    height: Math.round(rect.height),
                };
            });

            expect(PALENIGHT_SPACING_SCALE_PX.has(spacing.marginBottom)).toBe(true);
            expect(PALENIGHT_SPACING_SCALE_PX.has(spacing.paddingInline / 2)).toBe(true);
            expect(spacing.height).toBeGreaterThan(30);

            await page.screenshot({
                path: testInfo.outputPath(`login-geometry-${width}.png`),
                fullPage: true,
            });
        });
    }
});
