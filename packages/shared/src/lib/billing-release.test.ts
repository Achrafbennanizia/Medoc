import { describe, expect, it } from "vitest";
import { billingReleaseError, isReleasedForBilling, requireReleasedForBilling } from "./billing-release";

describe("FA-LEIST-05 billing release (N3 UI mirror)", () => {
    it("rejects missing release fields", () => {
        expect(isReleasedForBilling(null, null)).toBe(false);
        expect(isReleasedForBilling("arzt-1", null)).toBe(false);
        expect(isReleasedForBilling(null, "2026-01-01T00:00:00Z")).toBe(false);
        expect(isReleasedForBilling("  ", "2026-01-01T00:00:00Z")).toBe(false);
    });

    it("accepts non-empty release fields", () => {
        expect(isReleasedForBilling("arzt-1", "2026-01-01T00:00:00Z")).toBe(true);
    });

    it("requireReleasedForBilling throws validation-style message", () => {
        expect(() => requireReleasedForBilling(undefined, undefined, "Treatment")).toThrow(
            /not yet released for billing/,
        );
    });
});
