import { describe, expect, it } from "vitest";
import { isLowStock } from "./is-low-stock";

describe("isLowStock", () => {
    it("is low at or below the minimum", () => {
        expect(isLowStock({ stock: 3, min_stock: 3 })).toBe(true);
        expect(isLowStock({ stock: 4, min_stock: 3 })).toBe(false);
    });
    it("never flags a product without a minimum", () => expect(isLowStock({ stock: 0, min_stock: 0 })).toBe(false));
});
