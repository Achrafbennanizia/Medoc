import { describe, expect, it } from "vitest";
import { amountsMatch, filterZahlungenForLocalDay, sumBarTag, zahlungLocalYmd } from "./tagesabschluss";
import type { Zahlung } from "@/models/types";

const base: Omit<Zahlung, "id" | "created_at" | "betrag"> = {
    patient_id: "p1",
    zahlungsart: "BAR",
    status: "BEZAHLT",
    leistung_id: null,
    beschreibung: null,
};

describe("tagesabschluss", () => {
    it("maps local ymd for ISO datetime", () => {
        expect(zahlungLocalYmd("2026-04-26T12:00:00")).toBe("2026-04-26");
    });

    it("sums bar for day", () => {
        const z: Zahlung[] = [
            { ...base, id: "1", betrag: 10, zahlungsart: "BAR", status: "BEZAHLT", created_at: "2026-04-26 10:00:00" },
            { ...base, id: "2", betrag: 5, zahlungsart: "KARTE", status: "BEZAHLT", created_at: "2026-04-26 11:00:00" },
        ];
        expect(filterZahlungenForLocalDay(z, "2026-04-26")).toHaveLength(2);
        expect(sumBarTag(z, "2026-04-26")).toBe(10);
    });

    it("amountsMatch tolerates cent rounding", () => {
        expect(amountsMatch(10, 10.005)).toBe(true);
        expect(amountsMatch(10, 10.02)).toBe(false);
    });
});
