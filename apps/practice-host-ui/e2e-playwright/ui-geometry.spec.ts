import { expect, test } from "@playwright/test";

const viteBaseUrl = process.env.MEDOC_VITE_URL ?? "http://127.0.0.1:5173";

const breakpoints = [
    { name: "mobile-375", width: 375, height: 812 },
    { name: "tablet-768", width: 768, height: 1024 },
    { name: "desktop-1259", width: 1259, height: 900 },
] as const;

const PALE_NIGHT_SPACING_SCALE_PX = new Set([
    0, 2, 3, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80, 96,
]);

type LoginSpacingProbe = {
    loginKindPaddingTop: number;
    loginKindPaddingLeft: number;
    loginWrapPaddingLeft: number;
    submitPaddingTop: number;
    submitGap: number;
    rememberGap: number;
    rememberMarginBottom: number;
};

function assertOnScale(metrics: LoginSpacingProbe) {
    for (const [name, value] of Object.entries(metrics)) {
        expect(
            PALE_NIGHT_SPACING_SCALE_PX.has(value),
            `${name}=${value}px is off the Palenight spacing scale`,
        ).toBe(true);
    }
}

test.describe("UI geometry + spacing scale", () => {
    for (const bp of breakpoints) {
        test(`login spacing tokens and snapshot @ ${bp.name}`, async ({ page }) => {
            await page.setViewportSize({ width: bp.width, height: bp.height });
            const cssHref = new URL("/src/index.css", viteBaseUrl).toString();
            await page.setContent(`
                <!doctype html>
                <html lang="en">
                  <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <link rel="stylesheet" href="${cssHref}" />
                  </head>
                  <body>
                    <div class="login-root">
                      <div class="login-root__panels">
                        <section class="login-kind">Brand panel</section>
                        <section class="login-form-wrap">
                          <form class="login-form">
                            <button type="submit" class="login-submit">Sign in</button>
                            <div class="row login-remember-row">Remember email</div>
                          </form>
                        </section>
                      </div>
                    </div>
                  </body>
                </html>
            `);
            await page.waitForFunction(
                () => getComputedStyle(document.querySelector(".login-submit") as HTMLElement).paddingTop !== "0px",
            );
            await expect(page.locator(".login-form")).toBeVisible();

            const metrics = await page.evaluate<LoginSpacingProbe>(() => {
                const px = (input: string) => Math.round(Number.parseFloat(input || "0"));
                const loginKind = document.querySelector<HTMLElement>(".login-kind");
                const loginWrap = document.querySelector<HTMLElement>(".login-form-wrap");
                const submit = document.querySelector<HTMLElement>(".login-submit");
                const remember = document.querySelector<HTMLElement>(".login-remember-row");
                if (!loginKind || !loginWrap || !submit || !remember) {
                    throw new Error("Required login layout element missing");
                }
                const kindStyle = getComputedStyle(loginKind);
                const wrapStyle = getComputedStyle(loginWrap);
                const submitStyle = getComputedStyle(submit);
                const rememberStyle = getComputedStyle(remember);
                return {
                    loginKindPaddingTop: px(kindStyle.paddingTop),
                    loginKindPaddingLeft: px(kindStyle.paddingLeft),
                    loginWrapPaddingLeft: px(wrapStyle.paddingLeft),
                    submitPaddingTop: px(submitStyle.paddingTop),
                    submitGap: px(submitStyle.gap),
                    rememberGap: px(rememberStyle.gap),
                    rememberMarginBottom: px(rememberStyle.marginBottom),
                };
            });

            assertOnScale(metrics);
            await expect(page).toHaveScreenshot(`login-${bp.name}.png`, {
                fullPage: true,
                animations: "disabled",
            });
        });
    }
});
