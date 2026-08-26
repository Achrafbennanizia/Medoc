import { expect, test } from "@playwright/test";

const uiE2e = process.env.MEDOC_UI_E2E === "1";
const BREAKPOINTS = [375, 768, 1259] as const;
const SPACING_SCALE_PX = new Set([
    0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80,
    96, 112, 128, 144, 160, 176, 192, 208, 224, 240, 256, 288, 320, 384,
]);

type SelectorAudit = {
    selector: string;
    properties: string[];
};

const AUDITS: SelectorAudit[] = [
    {
        selector: ".login-root__panels",
        properties: [
            "paddingTop",
            "paddingRight",
            "paddingBottom",
            "paddingLeft",
            "marginTop",
            "marginRight",
            "marginBottom",
            "marginLeft",
            "rowGap",
            "columnGap",
        ],
    },
    {
        selector: ".login-form",
        properties: [
            "paddingTop",
            "paddingRight",
            "paddingBottom",
            "paddingLeft",
            "marginTop",
            "marginRight",
            "marginBottom",
            "marginLeft",
            "rowGap",
            "columnGap",
        ],
    },
    {
        selector: ".login-submit",
        properties: [
            "height",
            "paddingTop",
            "paddingRight",
            "paddingBottom",
            "paddingLeft",
        ],
    },
    {
        selector: ".login-password-input-row",
        properties: ["height", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
    },
];

function parsePx(raw: string): number | null {
    if (!raw || raw === "normal" || raw === "auto") {
        return null;
    }
    const m = /^(-?\d+(?:\.\d+)?)px$/.exec(raw.trim());
    if (!m) {
        return null;
    }
    return Number.parseFloat(m[1]);
}

test.describe("UI spacing token audit starter", () => {
    test.skip(!uiE2e, "Set MEDOC_UI_E2E=1 and run against a live Vite server");

    for (const width of BREAKPOINTS) {
        test(`login spacing audit @${width}px`, async ({ page }, testInfo) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/login");
            await page.waitForLoadState("networkidle");

            const violations: string[] = [];
            for (const audit of AUDITS) {
                const node = page.locator(audit.selector).first();
                if ((await node.count()) === 0) {
                    violations.push(`${audit.selector}: selector not found`);
                    continue;
                }
                const computed = await node.evaluate((el, props) => {
                    const style = getComputedStyle(el);
                    const out: Record<string, string> = {};
                    for (const prop of props as string[]) {
                        out[prop] = style[prop as keyof CSSStyleDeclaration] as string;
                    }
                    return out;
                }, audit.properties);

                for (const prop of audit.properties) {
                    const raw = computed[prop];
                    const px = parsePx(raw);
                    if (px == null) continue;
                    if (px < 0) continue;
                    if (!SPACING_SCALE_PX.has(px)) {
                        violations.push(`${audit.selector}.${prop}=${raw}`);
                    }
                }
            }

            const screenshotPath = testInfo.outputPath(`login-${width}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            await testInfo.attach(`login-${width}`, {
                path: screenshotPath,
                contentType: "image/png",
            });

            expect(violations, `Off-scale spacing values detected at ${width}px`).toEqual([]);
        });
    }
});
