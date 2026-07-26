import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import tailwindConfig from "../tailwind.config.js";

const FIXTURE_PATH = "/e2e-playwright/ui-quality-audit.fixture.html";

type Breakpoint = { label: string; width: number; height: number };

const BREAKPOINTS: Breakpoint[] = [
    { label: "mobile-375", width: 375, height: 1200 },
    { label: "tablet-768", width: 768, height: 1200 },
    { label: "desktop-1259", width: 1259, height: 1200 },
];

function parsePx(raw: string): number | null {
    if (!raw || raw === "auto") return null;
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return null;
    return Number(parsed.toFixed(2));
}

function spacingScalePx(): Set<number> {
    const base = new Set<number>([4, 8, 12, 16, 20, 24, 32, 72]);
    const spacing =
        (tailwindConfig as { theme?: { extend?: { spacing?: Record<string, string> } } }).theme?.extend?.spacing ??
        {};

    for (const value of Object.values(spacing)) {
        if (value.endsWith("px")) {
            const px = Number.parseFloat(value);
            if (Number.isFinite(px)) base.add(px);
            continue;
        }
        if (value.endsWith("rem")) {
            const rem = Number.parseFloat(value);
            if (Number.isFinite(rem)) base.add(rem * 16);
        }
    }

    return base;
}

test.describe("UI geometry + spacing + a11y audit", () => {
    test("captures geometry snapshots across required breakpoints", async ({ page }, testInfo) => {
        for (const viewport of BREAKPOINTS) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await page.goto(FIXTURE_PATH);

            for (const selector of [
                "[data-testid='component-card']",
                "[data-testid='component-button']",
                "[data-testid='component-icon-button']",
                "[data-testid='component-empty-state']",
                "[data-testid='component-dialog']",
                "[data-testid='component-toast-stack']",
            ]) {
                const rect = await page.locator(selector).boundingBox();
                expect(rect, `${viewport.label} ${selector} should render`).not.toBeNull();
                expect(rect?.width ?? 0, `${viewport.label} ${selector} width`).toBeGreaterThan(0);
                expect(rect?.height ?? 0, `${viewport.label} ${selector} height`).toBeGreaterThan(0);
            }

            const hasHorizontalOverflow = await page.evaluate(
                () => document.documentElement.scrollWidth > window.innerWidth + 1,
            );
            expect(hasHorizontalOverflow, `${viewport.label} should not overflow horizontally`).toBe(false);

            const screenshot = await page.screenshot({ fullPage: true });
            await testInfo.attach(`ui-quality-${viewport.label}.png`, {
                body: screenshot,
                contentType: "image/png",
            });
        }
    });

    test("enforces spacing tokens on audited component surfaces", async ({ page }) => {
        const spacing = spacingScalePx();
        await page.goto(FIXTURE_PATH);

        const buttonPaddingTop = parsePx(
            await page.locator("[data-testid='component-button']").evaluate((el) => getComputedStyle(el).paddingTop),
        );
        expect(buttonPaddingTop).not.toBeNull();
        expect(spacing.has(buttonPaddingTop as number)).toBe(true);

        const fieldWrapMarginBottom = parsePx(
            await page
                .locator("[data-testid='component-field-wrap']")
                .evaluate((el) => getComputedStyle(el).marginBottom),
        );
        expect(fieldWrapMarginBottom).not.toBeNull();
        expect(spacing.has(fieldWrapMarginBottom as number)).toBe(true);

        const toastRight = parsePx(
            await page
                .locator("[data-testid='component-toast-stack']")
                .evaluate((el) => getComputedStyle(el).right),
        );
        expect(toastRight).not.toBeNull();
        expect(spacing.has(toastRight as number)).toBe(true);

        const toastBottom = parsePx(
            await page
                .locator("[data-testid='component-toast-stack']")
                .evaluate((el) => getComputedStyle(el).bottom),
        );
        expect(toastBottom).not.toBeNull();
        expect(spacing.has(toastBottom as number)).toBe(true);
    });

    test("has zero critical axe violations", async ({ page }) => {
        await page.goto(FIXTURE_PATH);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
        const critical = results.violations.filter((violation) => violation.impact === "critical");
        expect(critical).toHaveLength(0);
    });
});
