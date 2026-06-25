import path from "node:path";
import { test, expect } from "@playwright/test";

const runGeometryAudit = process.env.MEDOC_UI_GEOMETRY === "1";
const BREAKPOINTS = [375, 768, 1259] as const;
const TAILWIND_SPACING_REM = [
    0, 0.0625, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1, 1.25, 1.5, 1.75,
    2, 2.25, 2.5, 2.75, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20,
    24,
] as const;

test.describe("UI geometry + spacing token audit", () => {
    test.skip(
        !runGeometryAudit,
        "Set MEDOC_UI_GEOMETRY=1 to run browser spacing/snapshot audit.",
    );

    for (const width of BREAKPOINTS) {
        test(`login route spacing at ${width}px`, async ({ page }, testInfo) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/login");
            await page.waitForLoadState("networkidle");

            const violations = await page.evaluate((scaleRem) => {
                const allowed = new Set(scaleRem.map((rem) => Math.round(rem * 16 * 100) / 100));
                const props = [
                    "paddingTop",
                    "paddingRight",
                    "paddingBottom",
                    "paddingLeft",
                    "marginTop",
                    "marginRight",
                    "marginBottom",
                    "marginLeft",
                    "gap",
                    "rowGap",
                    "columnGap",
                ] as const;

                const out: Array<{ element: string; prop: string; value: string }> = [];
                const all = Array.from(document.querySelectorAll<HTMLElement>("*"));
                for (const el of all) {
                    const style = getComputedStyle(el);
                    for (const prop of props) {
                        const raw = style[prop];
                        if (!raw || raw === "0px" || raw === "normal") continue;
                        if (!raw.endsWith("px")) continue;
                        const px = Math.round(Number.parseFloat(raw) * 100) / 100;
                        if (!allowed.has(px)) {
                            const label =
                                el.id
                                    ? `${el.tagName.toLowerCase()}#${el.id}`
                                    : el.className
                                      ? `${el.tagName.toLowerCase()}.${String(el.className)
                                            .trim()
                                            .split(/\s+/)
                                            .slice(0, 2)
                                            .join(".")}`
                                      : el.tagName.toLowerCase();
                            out.push({ element: label, prop, value: raw });
                        }
                    }
                }
                return out.slice(0, 80);
            }, TAILWIND_SPACING_REM);

            const snap = path.join(
                testInfo.outputDir,
                `login-${width}.png`,
            );
            await page.screenshot({ path: snap, fullPage: true });

            expect(violations, `off-scale spacing at ${width}px`).toEqual([]);
        });
    }
});
