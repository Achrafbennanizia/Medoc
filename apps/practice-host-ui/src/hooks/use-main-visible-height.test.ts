import { describe, expect, it } from "vitest";
import { sidePanelMaxHeight } from "./use-main-visible-height";

describe("sidePanelMaxHeight", () => {
    it("ends the panel above the window bottom when it starts below the page header", () => {
        // main area 85..800, panel starts at 240 → 800 - 240 - 16
        expect(sidePanelMaxHeight(240, 85, 800)).toBe(544);
    });
    it("uses the sticky position once the page is scrolled", () => {
        expect(sidePanelMaxHeight(-300, 85, 800)).toBe(800 - 93 - 16);
    });
    it("never collapses below a usable height", () => {
        expect(sidePanelMaxHeight(790, 85, 800)).toBe(160);
    });
});
