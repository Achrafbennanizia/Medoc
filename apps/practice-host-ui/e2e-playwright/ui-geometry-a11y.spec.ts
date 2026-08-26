import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BREAKPOINTS = [
    { name: "mobile", width: 375, height: 900 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1259, height: 900 },
] as const;

const SPACING_SCALE_PX = new Set([
    0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80, 96, 112,
]);

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        const mockDbStatus = { needsPassphraseSetup: false, needsUnlock: false };
        const mockVerbundStatus = {
            licensed: true,
            provisioned: true,
            isOwner: true,
            clusterId: "playwright-cluster",
            seatUsage: {
                adminUsed: 1,
                memberUsed: 0,
                totalUsed: 1,
                maxAdmin: 3,
                maxMember: 7,
                maxTotal: 10,
            },
            localFingerprint: "PLAYWRIGHT-FINGERPRINT",
            licenseValid: true,
            licenseFormat: "v2",
        };
        const mockOnboardingStatus = {
            registered: true,
            practiceSlug: "playwright-practice",
            setupComplete: true,
            needsAdminAccount: false,
            existingAccountEmails: [],
            personalCount: 1,
            needsPracticeSetup: false,
            needsMemberAccount: false,
            canSkipToLogin: true,
            loginReadyEmails: [],
        };

        const win = window as unknown as {
            __TAURI_INTERNALS__?: {
                invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
            };
        };

        if (!win.__TAURI_INTERNALS__) {
            win.__TAURI_INTERNALS__ = {};
        }

        win.__TAURI_INTERNALS__.invoke = async (cmd: string) => {
            switch (cmd) {
                case "get_db_setup_status":
                    return mockDbStatus;
                case "verbund_status_cmd":
                    return mockVerbundStatus;
                case "onboarding_subscription_status":
                    return mockOnboardingStatus;
                case "get_session":
                case "app_kv_get":
                case "log_workflow_event":
                    return null;
                default:
                    return null;
            }
        };
    });
});

type SpacingProbe = {
    selector: string;
    property: string;
    value: string;
    px: number | null;
};

function px(value: string): number | null {
    if (!value || value === "normal" || value === "auto") return null;
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.round(parsed * 100) / 100;
}

for (const bp of BREAKPOINTS) {
    test(`login spacing tokens and layout snapshot @${bp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: bp.width, height: bp.height });
        await page.goto("/login");
        await expect(page.getByRole("heading", { name: /anmelden|sign in|auth/i })).toBeVisible();

        const probes = await page.evaluate<SpacingProbe[]>(() => {
            const checks: Array<{ selector: string; properties: string[] }> = [
                { selector: ".login-art", properties: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] },
                { selector: ".login-form-wrap", properties: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] },
                { selector: ".login-submit", properties: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "gap"] },
                { selector: ".login-brand-row", properties: ["gap"] },
                { selector: ".login-remember-row", properties: ["marginBottom"] },
            ];
            const out: SpacingProbe[] = [];
            for (const check of checks) {
                const node = document.querySelector<HTMLElement>(check.selector);
                if (!node) continue;
                const style = window.getComputedStyle(node);
                for (const property of check.properties) {
                    const value = style[property as keyof CSSStyleDeclaration];
                    const parsed = Number.parseFloat(value as string);
                    out.push({
                        selector: check.selector,
                        property,
                        value: String(value),
                        px: Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null,
                    });
                }
            }
            return out;
        });

        const offScale = probes.filter((probe) => probe.px != null && !SPACING_SCALE_PX.has(probe.px));
        expect(offScale, `off-scale spacing at ${bp.name}: ${JSON.stringify(offScale, null, 2)}`).toEqual([]);

        await expect(page).toHaveScreenshot(`login-${bp.name}.png`, {
            fullPage: true,
            animations: "disabled",
            caret: "hide",
        });
    });
}

test("login has zero critical axe violations", async ({ page }) => {
    await page.setViewportSize({ width: 1259, height: 900 });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /anmelden|sign in|auth/i })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(
        critical,
        `critical axe violations:\n${critical.map((v) => `${v.id}: ${v.help}`).join("\n")}`,
    ).toEqual([]);
});
