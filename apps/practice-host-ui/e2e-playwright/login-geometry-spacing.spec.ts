import { expect, test } from "@playwright/test";

const BREAKPOINTS = [
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1259, height: 900 },
];

const SPACING_SCALE = new Set(Array.from({ length: 33 }, (_, index) => index * 4));

function assertSpacingScale(value: string, label: string): void {
    const numeric = Number.parseFloat(value);
    expect(Number.isFinite(numeric), `${label} should be a px value`).toBe(true);
    expect(
        SPACING_SCALE.has(Math.round(numeric)),
        `${label}=${value} is off the 4px spacing scale`,
    ).toBe(true);
}

test.describe("Login geometry + spacing scale", () => {
    for (const viewport of BREAKPOINTS) {
        test(`layout spacing follows 4px tokens at ${viewport.width}px`, async ({ page }, testInfo) => {
            await page.addInitScript(() => {
                const clusterReady = {
                    licensed: true,
                    provisioned: true,
                    isOwner: true,
                    clusterId: "test-cluster",
                    seatUsage: {
                        adminUsed: 1,
                        memberUsed: 0,
                        totalUsed: 1,
                        maxAdmin: 3,
                        maxMember: 7,
                        maxTotal: 10,
                    },
                    localFingerprint: "TEST-FINGERPRINT",
                    licenseValid: true,
                    licenseFormat: "v2",
                };
                const onboardingReady = {
                    registered: true,
                    practiceSlug: "demo",
                    setupComplete: true,
                    needsAdminAccount: false,
                    existingAccountEmails: [],
                    staffCount: 1,
                    needsPracticeSetup: false,
                    needsMemberAccount: false,
                    canSkipToLogin: true,
                    loginReadyEmails: [],
                };
                const internals = (window as unknown as { __TAURI_INTERNALS__?: Record<string, unknown> })
                    .__TAURI_INTERNALS__ ?? {};
                (window as unknown as { __TAURI_INTERNALS__: Record<string, unknown> }).__TAURI_INTERNALS__ = {
                    ...internals,
                    invoke: async (cmd: string) => {
                        switch (cmd) {
                            case "get_db_setup_status":
                                return { needsPassphraseSetup: false, needsUnlock: false };
                            case "get_session":
                                return null;
                            case "get_app_kv":
                                return null;
                            case "cluster_status_cmd":
                                return clusterReady;
                            case "onboarding_subscription_status":
                                return onboardingReady;
                            default:
                                return null;
                        }
                    },
                    transformCallback: internals.transformCallback ?? ((cb: unknown) => cb),
                    unregisterCallback: internals.unregisterCallback ?? (() => undefined),
                    convertFileSrc: internals.convertFileSrc ?? ((path: string) => path),
                };
            });
            await page.setViewportSize(viewport);
            await page.goto("/login");
            await expect(page.locator(".login-form")).toBeVisible();

            const metrics = await page.evaluate(() => {
                const pull = (selector: string) => {
                    const element = document.querySelector<HTMLElement>(selector);
                    if (!element) throw new Error(`Missing selector ${selector}`);
                    return getComputedStyle(element);
                };
                const wrap = pull(".login-form-wrap");
                const submit = pull(".login-submit");
                const brand = pull(".login-kind");
                return {
                    wrapPaddingTop: wrap.paddingTop,
                    wrapPaddingLeft: wrap.paddingLeft,
                    submitPaddingTop: submit.paddingTop,
                    submitGap: submit.gap,
                    brandPaddingTop: brand.paddingTop,
                    brandPaddingLeft: brand.paddingLeft,
                };
            });

            assertSpacingScale(metrics.wrapPaddingTop, "login-form-wrap padding-top");
            assertSpacingScale(metrics.wrapPaddingLeft, "login-form-wrap padding-left");
            assertSpacingScale(metrics.submitPaddingTop, "login-submit padding-top");
            assertSpacingScale(metrics.submitGap, "login-submit gap");
            assertSpacingScale(metrics.brandPaddingTop, "login-kind padding-top");
            assertSpacingScale(metrics.brandPaddingLeft, "login-kind padding-left");

            await page.screenshot({
                path: testInfo.outputPath(`login-${viewport.width}x${viewport.height}.png`),
                fullPage: true,
            });
        });
    }
});
