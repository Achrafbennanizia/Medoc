import { expect, test } from "@playwright/test";

const uiGeometryE2e = process.env.MEDOC_UI_GEOMETRY_E2E === "1";
const BREAKPOINTS = [
    { width: 375, height: 900 },
    { width: 768, height: 1024 },
    { width: 1259, height: 900 },
] as const;

const PALENIGHT_SPACING_SCALE = new Set([
    0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80, 96, 112, 128,
]);

function isScaleAligned(value: number): boolean {
    return PALENIGHT_SPACING_SCALE.has(Math.round(value));
}

type GeometryProbe = {
    viewportWidth: number;
    viewportHeight: number;
    horizontalOverflow: boolean;
    metrics: Array<{ name: string; value: number }>;
    offScale: Array<{ name: string; value: number }>;
};

test.describe("UI geometry + spacing (Palenight scale)", () => {
    test.skip(!uiGeometryE2e, "Set MEDOC_UI_GEOMETRY_E2E=1 to run geometry + spacing checks");

    for (const bp of BREAKPOINTS) {
        test(`login view is scale-aligned @${bp.width}px`, async ({ page }) => {
            await page.setViewportSize({ width: bp.width, height: bp.height });
            await page.goto("/login");
            await page.waitForSelector(".login-form");

            const probe = await page.evaluate<GeometryProbe>(() => {
                const readPx = (selector: string, prop: string): number => {
                    const el = document.querySelector<HTMLElement>(selector);
                    if (!el) return NaN;
                    const value = getComputedStyle(el).getPropertyValue(prop);
                    return Number.parseFloat(value || "0");
                };
                const metrics = [
                    { name: "login-form-wrap.padding-top", value: readPx(".login-form-wrap", "padding-top") },
                    { name: "login-form-wrap.padding-right", value: readPx(".login-form-wrap", "padding-right") },
                    { name: "login-art.padding-top", value: readPx(".login-art", "padding-top") },
                    { name: "login-art.padding-right", value: readPx(".login-art", "padding-right") },
                    { name: "login-submit.padding-top", value: readPx(".login-submit", "padding-top") },
                    { name: "login-submit.padding-right", value: readPx(".login-submit", "padding-right") },
                    { name: "toast-stack.gap", value: readPx(".toast-stack", "gap") || 10 },
                ].filter((m) => Number.isFinite(m.value));

                const offScale = metrics.filter(
                    (metric) => ![0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80, 96, 112, 128]
                        .includes(Math.round(metric.value)),
                );

                return {
                    viewportWidth: window.innerWidth,
                    viewportHeight: window.innerHeight,
                    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
                    metrics,
                    offScale,
                };
            });

            expect(probe.horizontalOverflow).toBe(false);
            expect(probe.offScale).toEqual([]);
            for (const metric of probe.metrics) {
                expect(isScaleAligned(metric.value)).toBe(true);
            }

            await expect(page).toHaveScreenshot(`login-geometry-${bp.width}.png`, {
                fullPage: true,
                maxDiffPixelRatio: 0.01,
            });
        });
    }
});
