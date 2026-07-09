import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import resolveConfig from "tailwindcss/resolveConfig";
import tailwindConfig from "../tailwind.config.js";

const BREAKPOINTS = [
    { width: 375, height: 900 },
    { width: 768, height: 1024 },
    { width: 1259, height: 960 },
] as const;

const resolvedTailwind = resolveConfig(tailwindConfig);
const spacingScaleValues = Object.values(
    (resolvedTailwind.theme?.spacing ?? {}) as Record<string, string>,
);

function parsePx(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function assertTokenValue(
    rawValue: string,
    tokenValues: ReadonlySet<number>,
    context: string,
): void {
    const px = parsePx(rawValue);
    expect(Number.isNaN(px), `${context}: expected a pixel value, got "${rawValue}"`).toBe(false);
    const normalized = Math.round(px * 100) / 100;
    expect(
        tokenValues.has(normalized),
        `${context}: expected ${normalized}px to match spacing token scale`,
    ).toBe(true);
}

function spacingValueToPx(rawValue: string, rootFontPx: number): number | null {
    const value = rawValue.trim();
    if (value === "0") {
        return 0;
    }
    if (value.endsWith("rem")) {
        const rem = Number.parseFloat(value.slice(0, -3));
        if (!Number.isFinite(rem)) return null;
        return Math.round(rem * rootFontPx * 100) / 100;
    }
    if (value.endsWith("px")) {
        const px = Number.parseFloat(value.slice(0, -2));
        if (!Number.isFinite(px)) return null;
        return Math.round(px * 100) / 100;
    }
    const numeric = Number.parseFloat(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.round(numeric * 100) / 100;
}

test.describe("UI geometry/spacing + a11y compliance", () => {
    for (const viewport of BREAKPOINTS) {
        test(`visual regression snapshot ${viewport.width}px`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await page.goto("/qa/ui-audit");
            await expect(page.getByTestId("qa-title")).toBeVisible();
            await page.addStyleTag({
                content:
                    "*{transition:none !important;animation:none !important;scroll-behavior:auto !important;}",
            });
            await expect(page).toHaveScreenshot(`ui-audit-${viewport.width}.png`, {
                fullPage: true,
            });
        });
    }

    test("spacing on measured containers matches token scale", async ({ page }) => {
        await page.setViewportSize(BREAKPOINTS[2]);
        await page.goto("/qa/ui-audit");
        await expect(page.getByTestId("spacing-box")).toBeVisible();

        const rootFontPx = await page.evaluate(() =>
            Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        );
        const allowed = new Set<number>([0]);
        for (const scaleValue of spacingScaleValues) {
            const px = spacingValueToPx(scaleValue, rootFontPx);
            if (px !== null) {
                allowed.add(px);
            }
        }

        const computed = await page.evaluate(() => {
            const box = document.querySelector<HTMLElement>('[data-testid="spacing-box"]');
            const grid = document.querySelector<HTMLElement>('[data-testid="spacing-grid"]');
            if (!box || !grid) {
                return null;
            }
            const boxStyle = getComputedStyle(box);
            const gridStyle = getComputedStyle(grid);
            return {
                boxPaddingLeft: boxStyle.paddingLeft,
                boxPaddingTop: boxStyle.paddingTop,
                boxMarginTop: boxStyle.marginTop,
                boxMarginLeft: boxStyle.marginLeft,
                gridColumnGap: gridStyle.columnGap,
                gridRowGap: gridStyle.rowGap,
            };
        });

        expect(computed).not.toBeNull();
        assertTokenValue(computed!.boxPaddingLeft, allowed, "spacing-box padding-left");
        assertTokenValue(computed!.boxPaddingTop, allowed, "spacing-box padding-top");
        assertTokenValue(computed!.boxMarginTop, allowed, "spacing-box margin-top");
        assertTokenValue(computed!.boxMarginLeft, allowed, "spacing-box margin-left");
        assertTokenValue(computed!.gridColumnGap, allowed, "spacing-grid column-gap");
        assertTokenValue(computed!.gridRowGap, allowed, "spacing-grid row-gap");
    });

    test("dialog keyboard flow, focus ring, icon labels and axe critical violations", async ({
        page,
    }) => {
        await page.goto("/qa/ui-audit");
        await expect(page.getByTestId("qa-title")).toBeVisible();

        await page.getByRole("button", { name: "Open confirm" }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);

        await page.getByRole("button", { name: "Open confirm" }).click();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Enter");
        await expect(page.getByTestId("confirm-count")).toContainText("1");

        const unlabeledIconButtons = await page.evaluate(() =>
            [...document.querySelectorAll<HTMLButtonElement>("button.icon-btn")].filter((button) => {
                const label = button.getAttribute("aria-label");
                return !label || label.trim().length === 0;
            }).length,
        );
        expect(unlabeledIconButtons).toBe(0);

        await page.focus('[data-testid="qa-icon-button"]');
        const focusRingVisible = await page.evaluate(() => {
            const active = document.activeElement as HTMLElement | null;
            if (!active) return false;
            const style = getComputedStyle(active);
            return style.boxShadow !== "none" || style.outlineStyle !== "none";
        });
        expect(focusRingVisible).toBe(true);

        const axeResults = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .analyze();
        const criticalViolations = axeResults.violations.filter(
            (violation) => violation.impact === "critical",
        );
        expect(
            criticalViolations,
            `Critical axe violations:\n${JSON.stringify(criticalViolations, null, 2)}`,
        ).toEqual([]);
    });

    test("toast position and duration policy", async ({ page }) => {
        await page.goto("/qa/ui-audit");
        await expect(page.getByTestId("qa-title")).toBeVisible();

        await page.getByTestId("toast-success-btn").click();
        await expect(page.getByText("Saved successfully")).toBeVisible();
        const toastPosition = await page.evaluate(() => {
            const stack = document.querySelector<HTMLElement>(".toast-stack");
            if (!stack) return null;
            const style = getComputedStyle(stack);
            const rect = stack.getBoundingClientRect();
            return {
                top: style.top,
                right: style.right,
                bottom: style.bottom,
                rectBottom: rect.bottom,
                viewportHeight: window.innerHeight,
            };
        });
        expect(toastPosition).not.toBeNull();
        expect(toastPosition!.bottom).not.toBe("auto");
        expect(toastPosition!.right).not.toBe("auto");
        expect(toastPosition!.viewportHeight - toastPosition!.rectBottom).toBeLessThanOrEqual(24);
        await page.waitForTimeout(3600);
        await expect(page.getByText("Saved successfully")).toHaveCount(0);

        await page.getByTestId("toast-error-btn").click();
        await expect(page.getByText("Save failed")).toBeVisible();
        await page.waitForTimeout(5600);
        await expect(page.getByText("Save failed")).toHaveCount(0);

        await page.getByTestId("toast-action-required-btn").click();
        await expect(page.getByText("Action required: review and confirm")).toBeVisible();
        await page.waitForTimeout(6200);
        await expect(page.getByText("Action required: review and confirm")).toBeVisible();
    });
});
