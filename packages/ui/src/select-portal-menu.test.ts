import { describe, expect, it } from "vitest";
import { portalMenuVerticalPlacement } from "./input";

describe("portalMenuVerticalPlacement", () => {
    it("keeps the menu inside the viewport when the trigger is near the bottom", () => {
        const trigger = { top: 520, bottom: 560, left: 0, right: 200, width: 200, height: 40 } as DOMRect;
        const { top, maxHeight } = portalMenuVerticalPlacement(trigger, 8, 600, 280);
        expect(top + maxHeight).toBeLessThanOrEqual(600);
        expect(maxHeight).toBeGreaterThanOrEqual(120);
        // Prefer opening above when space below is tight.
        expect(top).toBeLessThan(trigger.top);
    });

    it("opens below when there is enough room", () => {
        const trigger = { top: 80, bottom: 120, left: 0, right: 200, width: 200, height: 40 } as DOMRect;
        const { top, maxHeight } = portalMenuVerticalPlacement(trigger, 8, 800, 280);
        expect(top).toBe(126); // bottom + gap
        expect(maxHeight).toBe(280);
        expect(top + maxHeight).toBeLessThanOrEqual(800);
    });
});
