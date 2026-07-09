import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const BREAKPOINTS = [375, 768, 1259] as const;
const SPACING_SCALE = new Set([0, 4, 8, 12, 16, 20, 24, 32]);

function assertSpacingOnScale(label: string, value: number) {
    expect(
        SPACING_SCALE.has(value),
        `${label}=${value}px is outside Palenight spacing scale`,
    ).toBeTruthy();
}

test.describe("UI geometry + a11y audit harness", () => {
    for (const width of BREAKPOINTS) {
        test(`captures snapshot and spacing metrics at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto("/ui-audit.html");
            await page.getByText("UI geometry harness").waitFor();

            const metrics = await page.evaluate(() => {
                const px = (raw: string) => {
                    const n = Number.parseFloat(raw || "0");
                    return Number.isFinite(n) ? Math.round(n) : 0;
                };
                const read = (id: string) => {
                    const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
                    if (!el) throw new Error(`missing test id: ${id}`);
                    return getComputedStyle(el);
                };

                const stack = read("spacing-stack");
                const card = read("spacing-card");
                const action = read("action-row");
                const root = getComputedStyle(document.querySelector("main")!);
                const toast = getComputedStyle(document.querySelector(".toast-stack")!);

                return {
                    stackGap: px(stack.rowGap || stack.gap),
                    cardGap: px(card.gap),
                    cardMarginTop: px(card.marginTop),
                    actionGap: px(action.gap),
                    actionMarginTop: px(action.marginTop),
                    rootPaddingLeft: px(root.paddingLeft),
                    rootPaddingRight: px(root.paddingRight),
                    toastBottom: px(toast.bottom),
                    toastRight: px(toast.right),
                    toastPosition: toast.position,
                };
            });

            assertSpacingOnScale("stack gap", metrics.stackGap);
            assertSpacingOnScale("card gap", metrics.cardGap);
            assertSpacingOnScale("card margin-top", metrics.cardMarginTop);
            assertSpacingOnScale("action gap", metrics.actionGap);
            assertSpacingOnScale("action margin-top", metrics.actionMarginTop);
            assertSpacingOnScale("root padding-left", metrics.rootPaddingLeft);
            assertSpacingOnScale("root padding-right", metrics.rootPaddingRight);
            assertSpacingOnScale("toast bottom", metrics.toastBottom);
            assertSpacingOnScale("toast right", metrics.toastRight);

            expect(metrics.toastPosition).toBe("fixed");

            await expect(page).toHaveScreenshot(`ui-audit-${width}.png`, {
                fullPage: true,
                animations: "disabled",
            });
        });
    }

    test("axe scan has zero critical WCAG violations", async ({ page }) => {
        await page.setViewportSize({ width: 1259, height: 1000 });
        await page.goto("/ui-audit.html");
        await page.getByText("UI geometry harness").waitFor();

        const axe = await new AxeBuilder({ page }).analyze();
        const critical = axe.violations.filter((v) => v.impact === "critical");
        expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
    });
});
