import { expect, test } from "@playwright/test";

const BREAKPOINTS = [375, 768, 1259] as const;
const ALLOWED_SPACING_PX = new Set([
    0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80, 96,
]);

function assertTokenSpacing(value: number, label: string) {
    expect(Number.isFinite(value), `${label} must be finite`).toBeTruthy();
    const rounded = Math.round(value);
    expect(
        ALLOWED_SPACING_PX.has(rounded),
        `${label}=${value}px (rounded ${rounded}px) is outside the Palenight spacing scale`,
    ).toBeTruthy();
}

test.describe("login geometry and spacing audit", () => {
    for (const width of BREAKPOINTS) {
        test(`validates login spacing at ${width}px`, async ({ page }, testInfo) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/e2e/login-layout");

            await expect(page.locator(".login-form")).toBeVisible();

            const metrics = await page.evaluate(() => {
                const parsePx = (raw: string | null | undefined) => {
                    const n = Number.parseFloat(raw ?? "0");
                    return Number.isFinite(n) ? n : 0;
                };
                const panels = document.querySelector(".login-root__panels") as HTMLElement | null;
                const form = document.querySelector(".login-form") as HTMLElement | null;
                const rememberRow = document.querySelector(".login-remember-row") as HTMLElement | null;
                const submit = document.querySelector(".login-submit") as HTMLElement | null;
                if (!panels || !form || !rememberRow || !submit) {
                    throw new Error("Missing login geometry targets");
                }
                const panelStyle = getComputedStyle(panels);
                const formStyle = getComputedStyle(form);
                const rememberStyle = getComputedStyle(rememberRow);
                const submitStyle = getComputedStyle(submit);
                return {
                    panelGap: parsePx(panelStyle.gap),
                    formPaddingInline: parsePx(
                        formStyle.paddingInlineStart || formStyle.paddingLeft,
                    ),
                    formPaddingTop: parsePx(formStyle.paddingTop),
                    rememberGap: parsePx(rememberStyle.gap),
                    submitPaddingInline: parsePx(
                        submitStyle.paddingInlineStart || submitStyle.paddingLeft,
                    ),
                    formWidth: form.getBoundingClientRect().width,
                };
            });

            assertTokenSpacing(metrics.panelGap, "login-root panel gap");
            assertTokenSpacing(metrics.formPaddingInline, "login form horizontal padding");
            assertTokenSpacing(metrics.formPaddingTop, "login form top padding");
            assertTokenSpacing(metrics.rememberGap, "remember row gap");
            assertTokenSpacing(metrics.submitPaddingInline, "submit button horizontal padding");

            expect(metrics.formWidth).toBeGreaterThan(250);

            await page.screenshot({
                path: testInfo.outputPath(`login-layout-${width}.png`),
                fullPage: true,
            });
        });
    }
});
