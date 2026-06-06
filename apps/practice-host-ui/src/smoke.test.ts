import { describe, expect, it } from "vitest";

describe("release gate", () => {
    it("runs a minimal assertion so npm test / CI fails if the harness breaks", () => {
        expect(true).toBe(true);
    });
});
