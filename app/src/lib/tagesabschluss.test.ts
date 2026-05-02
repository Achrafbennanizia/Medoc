import { describe, expect, it } from "vitest";
import { amountsMatch, filterZahlungenForLocalDay, parseEuroInput, sumBarTag, zahlungLocalYmd } from "./tagesabschluss";
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

    describe("parseEuroInput (de-DE)", () => {
        it("parses thousands + decimal comma", () => {
            expect(parseEuroInput("1.234,56")).toBe(1234.56);
            expect(parseEuroInput("12.345,67")).toBe(12345.67);
        });

        it("parses decimal comma without thousands", () => {
            expect(parseEuroInput("1234,56")).toBe(1234.56);
            expect(parseEuroInput("10,5")).toBe(10.5);
        });

        it("parses grouped thousands without decimals", () => {
            expect(parseEuroInput("1.234.567")).toBe(1234567);
        });

        it("single dot as decimal when no comma", () => {
            expect(parseEuroInput("12.34")).toBe(12.34);
        });

        it("returns null for empty or invalid", () => {
            expect(parseEuroInput("")).toBeNull();
            expect(parseEuroInput("   ")).toBeNull();
            expect(parseEuroInput("x")).toBeNull();
        });
    });
});
