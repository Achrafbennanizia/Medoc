import { expect, test } from "@playwright/test";

const breakpoints = [
    { name: "mobile-375", width: 375, height: 900, padding: 14, gap: 10.5, marginTop: 14 },
    { name: "tablet-768", width: 768, height: 1024, padding: 21, gap: 14, marginTop: 21 },
    { name: "desktop-1259", width: 1259, height: 900, padding: 28, gap: 17.5, marginTop: 28 },
] as const;

const PALENIGHT_SCALE_PX = new Set([0, 3.5, 7, 10.5, 14, 17.5, 21, 24.5, 28, 35]);

for (const bp of breakpoints) {
    test(`ui audit spacing matches tokens at ${bp.name}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: bp.width, height: bp.height });
        await page.goto("/ui-audit");
        await page.locator('[data-testid="audit-panel"]').waitFor();

        const metrics = await page.evaluate(() => {
            const pick = (testId: string) => {
                const node = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
                if (!node) throw new Error(`Missing audit node: ${testId}`);
                return node;
            };
            const px = (value: string) => Number.parseFloat(value.replace("px", ""));
            const panelStyle = getComputedStyle(pick("audit-panel"));
            const stackStyle = getComputedStyle(pick("audit-stack"));
            const gridStyle = getComputedStyle(pick("audit-grid"));
            const sizeStyle = getComputedStyle(pick("audit-size-target"));

            const sampledSpacing = [
                px(panelStyle.paddingTop),
                px(panelStyle.paddingRight),
                px(stackStyle.rowGap),
                px(stackStyle.marginTop),
                px(gridStyle.rowGap),
            ];

            return {
                panelPaddingTop: px(panelStyle.paddingTop),
                panelPaddingRight: px(panelStyle.paddingRight),
                stackGap: px(stackStyle.rowGap),
                stackMarginTop: px(stackStyle.marginTop),
                gridGap: px(gridStyle.rowGap),
                targetHeight: px(sizeStyle.height),
                sampledSpacing,
            };
        });

        expect(metrics.panelPaddingTop).toBeCloseTo(bp.padding, 1);
        expect(metrics.panelPaddingRight).toBeCloseTo(bp.padding, 1);
        expect(metrics.stackGap).toBeCloseTo(bp.gap, 1);
        expect(metrics.gridGap).toBeCloseTo(bp.gap, 1);
        expect(metrics.stackMarginTop).toBeCloseTo(bp.marginTop, 1);
        expect(metrics.targetHeight).toBeCloseTo(35, 1);

        for (const value of metrics.sampledSpacing) {
            expect(
                PALENIGHT_SCALE_PX.has(value),
                `Expected ${value}px to be in spacing scale`,
            ).toBeTruthy();
        }

        await page
            .locator('[data-testid="audit-panel"]')
            .screenshot({ path: testInfo.outputPath(`ui-audit-${bp.name}.png`) });
    });
}
