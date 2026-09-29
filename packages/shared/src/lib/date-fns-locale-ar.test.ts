import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import { AR_GREGORIAN_MONTHS_WIDE, dateFnsArGregorian } from "./date-fns-locale-ar";

describe("Arabic Gregorian (Christian) months", () => {
    it("uses standard Gregorian Arabic names for MMMM", () => {
        const names = Array.from({ length: 12 }, (_, month) =>
            format(new Date(2026, month, 1), "MMMM", { locale: dateFnsArGregorian }),
        );
        expect(names).toEqual([...AR_GREGORIAN_MONTHS_WIDE]);
    });
});
