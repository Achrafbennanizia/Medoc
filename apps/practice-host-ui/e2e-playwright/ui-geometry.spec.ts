import { expect, test } from "@playwright/test";

const geometryEnabled = process.env.MEDOC_UI_GEOMETRY === "1";
const viewportWidths = [375, 768, 1259];
const ALLOWED_SPACING_SCALE_PX = new Set([0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64]);

function assertSpacingScale(values: number[], label: string, width: number) {
    for (const value of values) {
        if (!Number.isFinite(value)) {
            continue;
        }
        const rounded = Math.round(value);
        if (rounded === 0) {
            continue;
        }
        expect(
            ALLOWED_SPACING_SCALE_PX.has(rounded),
            `${label}=${value}px outside spacing scale at ${width}px`,
        ).toBeTruthy();
    }
}

test.describe("UI geometry + spacing scale", () => {
    test.skip(!geometryEnabled, "Set MEDOC_UI_GEOMETRY=1 to run spacing + snapshot audit.");

    for (const width of viewportWidths) {
        test(`login layout spacing and snapshot @${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 1024 });
            await page.goto("/login");
            await expect(page.getByRole("heading", { name: /anmelden|login/i })).toBeVisible();

            // Stabilize screenshots/metrics by disabling animations.
            await page.addStyleTag({
                content: "* { animation: none !important; transition: none !important; }",
            });

            const metrics = await page.evaluate(() => {
                const samples = [
                    { name: "login-card", selector: ".card" },
                    { name: "email-input", selector: "input[type='email'], input#email, input.input-edit" },
                    { name: "password-input", selector: "input[type='password'], input#passwort" },
                    { name: "submit-button", selector: "button.btn-accent, button[type='submit']" },
                ];
                const px = (value: string) => {
                    const parsed = Number.parseFloat(value);
                    return Number.isFinite(parsed) ? parsed : Number.NaN;
                };

                return samples.map((sample) => {
                    const el = document.querySelector(sample.selector) as HTMLElement | null;
                    if (!el) {
                        return { name: sample.name, missing: true };
                    }
                    const rect = el.getBoundingClientRect();
                    const style = getComputedStyle(el);
                    return {
                        name: sample.name,
                        missing: false,
                        width: rect.width,
                        height: rect.height,
                        padding: [
                            px(style.paddingTop),
                            px(style.paddingRight),
                            px(style.paddingBottom),
                            px(style.paddingLeft),
                        ],
                        margin: [
                            px(style.marginTop),
                            px(style.marginRight),
                            px(style.marginBottom),
                            px(style.marginLeft),
                        ],
                        gap: px(style.gap),
                    };
                });
            });

            for (const sample of metrics) {
                expect(sample.missing, `${sample.name} should exist on /login`).toBe(false);
                if (sample.missing) {
                    continue;
                }
                expect(sample.width, `${sample.name} width`).toBeGreaterThan(0);
                expect(sample.height, `${sample.name} height`).toBeGreaterThan(0);
                assertSpacingScale(sample.padding, `${sample.name}.padding`, width);
                assertSpacingScale(sample.margin, `${sample.name}.margin`, width);
                assertSpacingScale([sample.gap], `${sample.name}.gap`, width);
            }

            await expect(page).toHaveScreenshot(`login-layout-${width}px.png`, {
                fullPage: true,
                maxDiffPixelRatio: 0.02,
            });
        });
    }
});
