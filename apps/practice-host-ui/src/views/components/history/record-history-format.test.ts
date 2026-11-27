import { describe, expect, it } from "vitest";
import { changeTexts, formatValue, humanizeField } from "./record-history-format";

describe("History formatting", () => {
    it("makes a readable label from a column name", () => {
        expect(humanizeField("treating_staff_id")).toBe("Treating staff");
        expect(humanizeField("date_of_birth")).toBe("Date of birth");
    });

    it("shows names for staff ids and a dash for empty values", () => {
        expect(changeTexts({ field: "physician_id", old: "dr-a", new: "dr-b", oldLabel: "Dr. A", newLabel: "Dr. B" })).toEqual({
            old: "Dr. A",
            next: "Dr. B",
        });
        expect(formatValue(null)).toBeNull();
        expect(formatValue("")).toBeNull();
        expect(formatValue(true)).toBe("✓");
        expect(formatValue(12.5)).toBe("12.5");
    });

    it("shortens long text", () => {
        const long = "x".repeat(300);
        expect(formatValue(long)?.length).toBe(141);
    });
});
