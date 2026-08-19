import { describe, expect, it } from "vitest";
import { amountsMatch, filterPaymentsForLocalDay, parseEuroInput, sumCashDay, paymentLocalYmd } from "./day-close";
import type { Payment } from "@/models/types";

const base: Omit<Payment, "id" | "created_at" | "amount"> = {
    patient_id: "p1",
    payment_method: "CASH",
    status: "PAID",
    service_item_id: null,
    description: null,
};

describe("day_close", () => {
    it("maps local ymd for ISO datetime", () => {
        expect(paymentLocalYmd("2026-04-26T12:00:00")).toBe("2026-04-26");
    });

        it("sums cash for day", () => {
        const z: Payment[] = [
            { ...base, id: "1", amount: 10, payment_method: "CASH", status: "PAID", created_at: "2026-04-26 10:00:00" },
            { ...base, id: "2", amount: 5, payment_method: "CARD", status: "PAID", created_at: "2026-04-26 11:00:00" },
        ];
        expect(filterPaymentsForLocalDay(z, "2026-04-26")).toHaveLength(2);
        expect(sumCashDay(z, "2026-04-26")).toBe(10);
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
