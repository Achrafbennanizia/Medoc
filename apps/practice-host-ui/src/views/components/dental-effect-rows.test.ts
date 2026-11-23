import { describe, expect, it } from "vitest";
import { dentalEffectRows } from "./dental-effect-rows";

describe("tooth chart legend rows (Help)", () => {
    it("lists every status, then every pair the chart accepts", () => {
        const ids = dentalEffectRows().map((r) => r.id);
        expect(ids.slice(0, 8)).toEqual(["healthy", "caries", "filling", "crown", "root", "missing", "implant", "planned"]);
        const pairs = ids.slice(8);
        // 7 stackable statuses → 21 pairs, minus missing with caries/filling/crown/root and root with implant.
        expect(pairs).toHaveLength(16);
        expect(pairs).toEqual(expect.arrayContaining(["missing+implant", "missing+planned", "crown+implant", "caries+planned"]));
        expect(pairs).not.toEqual(expect.arrayContaining(["root+implant"]));
        expect(pairs.some((p) => p.startsWith("missing+") && /caries|filling|crown|root/.test(p))).toBe(false);
    });
});
