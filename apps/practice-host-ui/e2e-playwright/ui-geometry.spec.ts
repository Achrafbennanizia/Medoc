import { expect, test } from "@playwright/test";

const BREAKPOINTS = [375, 768, 1259] as const;
const SPACING_SCALE_PX = new Set([
    0, 2, 4, 6, 7, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80, 96, 112,
    128, 144, 160, 176, 192, 224, 256, 288, 320, 384,
]);

type Metric = { label: string; value: string };

function parsePx(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed.endsWith("px")) return null;
    const n = Number(trimmed.slice(0, -2));
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100) / 100;
}

test.describe("UI geometry and spacing audit", () => {
    for (const width of BREAKPOINTS) {
        test(`spacing tokens + snapshots @${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 1100 });
            await page.goto("/ui-geometry-audit.html");
            await page.waitForSelector("#ui-geometry-root");
            await page.addStyleTag({
                content: `
                    *, *::before, *::after {
                      animation: none !important;
                      transition: none !important;
                    }
                `,
            });

            const spacingMetrics = await page.evaluate<Metric[]>(() => {
                const read = (selector: string, prop: string, label: string): Metric => {
                    const el = document.querySelector<HTMLElement>(selector);
                    if (!el) return { label, value: "MISSING" };
                    return { label, value: getComputedStyle(el)[prop as keyof CSSStyleDeclaration] as string };
                };

                return [
                    read("#ui-geometry-root", "paddingTop", "root.paddingTop"),
                    read("#ui-geometry-root", "paddingRight", "root.paddingRight"),
                    read("#ui-geometry-root", "rowGap", "root.rowGap"),
                    read('[data-qa="button-row"]', "columnGap", "button-row.columnGap"),
                    read('[data-qa="input-grid"]', "rowGap", "input-grid.rowGap"),
                    read('[data-qa="filter-row"]', "rowGap", "filter-row.rowGap"),
                    read('[data-qa="tag-and-slot"]', "rowGap", "tag-and-slot.rowGap"),
                    read('[data-qa="notice-and-empty"]', "rowGap", "notice-and-empty.rowGap"),
                    read(".toast-stack", "right", "toast-stack.right"),
                ];
            });

            const missing = spacingMetrics.filter((m) => m.value === "MISSING");
            expect(missing, "audit selectors must exist").toEqual([]);

            const offScale = spacingMetrics
                .map((metric) => ({ ...metric, px: parsePx(metric.value) }))
                .filter((metric) => metric.px != null && !SPACING_SCALE_PX.has(metric.px));

            expect(
                offScale,
                `off-scale spacing values at ${width}px: ${JSON.stringify(offScale, null, 2)}`,
            ).toEqual([]);

            const toastPlacement = await page.evaluate(() => {
                const el = document.querySelector<HTMLElement>(".toast-stack");
                if (!el) return null;
                const rect = el.getBoundingClientRect();
                return {
                    rightGap: window.innerWidth - rect.right,
                    bottomGap: window.innerHeight - rect.bottom,
                };
            });
            expect(toastPlacement, "toast stack should exist for placement check").not.toBeNull();
            const toastRightGap = Math.round(toastPlacement!.rightGap);
            const toastBottomGap = Math.round(toastPlacement!.bottomGap);
            expect(toastRightGap, "toast stack should be offset from right edge").toBeGreaterThan(0);
            expect(toastBottomGap, "toast stack should be offset from bottom edge").toBeGreaterThan(0);
            expect(
                SPACING_SCALE_PX.has(toastRightGap),
                `toast right gap should use spacing scale token: ${toastRightGap}px`,
            ).toBeTruthy();
            expect(
                SPACING_SCALE_PX.has(toastBottomGap),
                `toast bottom gap should use spacing scale token: ${toastBottomGap}px`,
            ).toBeTruthy();

            const rectChecks = await page.evaluate(() => {
                const rect = (selector: string) => {
                    const el = document.querySelector<HTMLElement>(selector);
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    return { width: r.width, height: r.height };
                };
                return {
                    button: rect('[data-qa="button-row"] button'),
                    input: rect('[data-qa="input-grid"] input'),
                    optionBar: rect('[data-qa="filter-row"] .option-bar'),
                    tagInput: rect('[data-qa="tag-and-slot"] [id$="-tag"]'),
                    timeSlot: rect('[data-qa="tag-and-slot"] button'),
                };
            });

            for (const [label, rect] of Object.entries(rectChecks)) {
                expect(rect, `${label} rect should exist`).not.toBeNull();
                expect(rect!.width, `${label} width > 0`).toBeGreaterThan(0);
                expect(rect!.height, `${label} height > 0`).toBeGreaterThan(0);
            }

            await expect(page).toHaveScreenshot(`ui-geometry-${width}.png`, {
                fullPage: true,
                animations: "disabled",
            });
        });
    }
});
