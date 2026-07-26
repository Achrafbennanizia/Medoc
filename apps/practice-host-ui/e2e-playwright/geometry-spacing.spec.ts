import { expect, test } from "@playwright/test";

const BREAKPOINTS = [
    { name: "mobile-375", width: 375, height: 900, expectedShellPadding: "16px", expectedShellGap: "16px" },
    { name: "tablet-768", width: 768, height: 1024, expectedShellPadding: "24px", expectedShellGap: "24px" },
    { name: "desktop-1259", width: 1259, height: 900, expectedShellPadding: "32px", expectedShellGap: "32px" },
] as const;

test.describe("geometry + spacing audit fixture", () => {
    for (const bp of BREAKPOINTS) {
        test(`spacing tokens at ${bp.name}`, async ({ page }) => {
            await page.setViewportSize({ width: bp.width, height: bp.height });
            await page.goto("/geometry-fixture.html");

            const shell = page.getByTestId("spacing-shell");
            await expect(shell).toBeVisible();

            const shellStyle = await shell.evaluate((el) => {
                const style = getComputedStyle(el);
                return {
                    paddingTop: style.paddingTop,
                    paddingRight: style.paddingRight,
                    paddingBottom: style.paddingBottom,
                    paddingLeft: style.paddingLeft,
                    gap: style.gap,
                };
            });

            expect(shellStyle.paddingTop).toBe(bp.expectedShellPadding);
            expect(shellStyle.paddingRight).toBe(bp.expectedShellPadding);
            expect(shellStyle.paddingBottom).toBe(bp.expectedShellPadding);
            expect(shellStyle.paddingLeft).toBe(bp.expectedShellPadding);
            expect(shellStyle.gap).toBe(bp.expectedShellGap);

            const buttonRowGap = await page.getByTestId("button-row").evaluate((el) => getComputedStyle(el).gap);
            expect(buttonRowGap).toBe("16px");

            // Capture deterministic snapshots per required responsive breakpoint.
            await page.screenshot({
                path: `test-results/geometry-${bp.name}.png`,
                fullPage: true,
            });
        });
    }

    test("keyboard + aria baseline", async ({ page }) => {
        await page.setViewportSize({ width: 1259, height: 900 });
        await page.goto("/geometry-fixture.html");

        const iconButton = page.getByTestId("icon-button");
        await expect(iconButton).toHaveAttribute("aria-label", "Close fixture");

        await iconButton.focus();
        const outline = await iconButton.evaluate((el) => {
            const style = getComputedStyle(el);
            return {
                outlineStyle: style.outlineStyle,
                outlineWidth: style.outlineWidth,
            };
        });
        expect(outline.outlineStyle).not.toBe("none");
        expect(outline.outlineWidth).not.toBe("0px");
    });
});
