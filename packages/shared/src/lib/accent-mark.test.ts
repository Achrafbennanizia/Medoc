import { describe, expect, it } from "vitest";
import { accentMarkStops } from "./accent-preset";

describe("accentMarkStops", () => {
    it("uses the accent itself as the light-theme start", () => {
        expect(accentMarkStops("mint", "light").from).toBe("#0EA07E");
        expect(accentMarkStops("ocean", "light").from).toBe("#0A84FF");
    });

    it("uses a different pair for the dark theme", () => {
        const light = accentMarkStops("plum", "light");
        const dark = accentMarkStops("plum", "dark");
        expect(dark.from).not.toBe(light.from);
        expect(dark.to).not.toBe(light.to);
    });

    it("changes the logo stops when the accent changes", () => {
        expect(accentMarkStops("rose", "light")).not.toEqual(accentMarkStops("amber", "light"));
    });
});
