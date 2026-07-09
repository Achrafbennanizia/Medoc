import { expect, test, type Page } from "@playwright/test";
import resolveConfig from "tailwindcss/resolveConfig.js";
import tailwindConfig from "../tailwind.config.js";

type AuditPoint = {
    selector: string;
    property: string;
    value: number;
};

const VIEWPORTS = [
    { label: "mobile-375", width: 375, height: 812 },
    { label: "tablet-768", width: 768, height: 1024 },
    { label: "desktop-1259", width: 1259, height: 900 },
] as const;

function toPixels(value: string): number | null {
    const normalized = value.trim();
    if (!normalized || normalized === "0") return 0;
    if (normalized.endsWith("px")) return Number.parseFloat(normalized);
    if (normalized.endsWith("rem")) return Number.parseFloat(normalized) * 16;
    if (normalized.endsWith("em")) return Number.parseFloat(normalized) * 16;
    return null;
}

const resolved = resolveConfig(tailwindConfig);
const spacingValues = resolved.theme?.spacing ?? {};
const spacingScalePx = new Set<number>(
    Object.values(spacingValues)
        .map((value) => (typeof value === "string" ? toPixels(value) : null))
        .filter((value): value is number => value != null),
);
spacingScalePx.add(0);

const PROPERTIES = [
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "gap",
] as const;

const AUDIT_PATH = "/quality-audit.html";
const AUDIT_ROOT_SELECTOR = "#quality-audit-root";

async function gotoAuditSurface(page: Page) {
    const response = await page.goto(AUDIT_PATH);
    expect(response?.ok()).toBeTruthy();
    await page.waitForSelector(AUDIT_ROOT_SELECTOR);
}

test.describe("UI quality geometry and accessibility", () => {
    for (const viewport of VIEWPORTS) {
        test(`captures quality audit snapshots and checks spacing scale at ${viewport.label}`, async ({
            page,
        }, testInfo) => {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await gotoAuditSurface(page);

            await page.screenshot({
                path: testInfo.outputPath(`quality-audit-${viewport.label}.png`),
                fullPage: true,
            });

            const hasHorizontalOverflow = await page.evaluate(
                () =>
                    document.documentElement.scrollWidth >
                    document.documentElement.clientWidth + 1,
            );
            expect(hasHorizontalOverflow).toBe(false);

            const offScale = await page.evaluate(
                ({ selectors, properties, allowed }) => {
                    const allowedSet = new Set(allowed);
                    const findings: AuditPoint[] = [];
                    for (const selector of selectors) {
                        const el = document.querySelector<HTMLElement>(selector);
                        if (!el) continue;
                        const style = getComputedStyle(el);
                        for (const prop of properties) {
                            const raw = style[prop as keyof CSSStyleDeclaration];
                            const px = Number.parseFloat(String(raw));
                            if (!Number.isFinite(px) || px === 0) continue;
                            if (!allowedSet.has(px)) {
                                findings.push({ selector, property: prop, value: px });
                            }
                        }
                    }
                    return findings;
                },
                {
                    selectors: [
                        "#quality-audit-root",
                        '[data-audit="card"]',
                        '[data-audit="controls"]',
                        ".toast-stack",
                    ],
                    properties: PROPERTIES,
                    allowed: [...spacingScalePx],
                },
            );

            expect(offScale).toEqual([]);
        });
    }

    test("reports no critical axe violations on quality audit surface", async ({ page }) => {
        await gotoAuditSurface(page);

        await page.addScriptTag({
            url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.3/axe.min.js",
        });
        const result = await page.evaluate(async () => {
            const axe = (window as Window & { axe: { run: (context?: unknown, options?: unknown) => Promise<unknown> } }).axe;
            return axe.run(document, {
                runOnly: {
                    type: "tag",
                    values: ["wcag2a", "wcag2aa"],
                },
            });
        });

        const critical = (result as { violations: Array<{ impact: string | null }> }).violations.filter(
            (violation) => violation.impact === "critical",
        );
        expect(critical).toEqual([]);
    });
});
