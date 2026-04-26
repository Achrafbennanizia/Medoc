import { describe, expect, it } from "vitest";
import { betragAequivalentProMonat, vertragAktivHeute, type VertragItem } from "./vertrag-local";

describe("vertrag-local", () => {
    it("Jahr to month equivalent", () => {
        expect(betragAequivalentProMonat(840, "JAHR")).toBeCloseTo(70, 2);
    });

    it("vertragAktivHeute for befristet in range", () => {
        const v: VertragItem = {
            id: "1",
            bezeichnung: "x",
            partner: "y",
            betrag: 1,
            intervall: "MONAT",
            unbefristet: false,
            periodeVon: "2020-01-01",
            periodeBis: "2040-12-31",
            createdAt: "",
        };
        // depends on "today" — use a mock by checking logic with fixed strings
        expect(v.unbefristet).toBe(false);
        const vPast: VertragItem = { ...v, periodeBis: "2000-01-01" };
        const t = new Date();
        const ymd = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
        expect(vertragAktivHeute(v)).toBe(ymd >= "2020-01-01" && ymd <= "2040-12-31");
        expect(vertragAktivHeute(vPast)).toBe(false);
    });
});
