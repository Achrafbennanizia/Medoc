import { describe, expect, it } from "vitest";
import type { Examination, Payment, Treatment } from "@/models/types";
import {
    buildOpenPaymentLinkSelectOptions,
    parsePaymentLinkValue,
} from "./payment-booking";

const t = (k: string) => k;
const tp = (k: string, p: Record<string, string | number>) => `${k}:${JSON.stringify(p)}`;

describe("parsePaymentLinkValue", () => {
    it("accepts treatment and examination keys and legacy unter", () => {
        expect(parsePaymentLinkValue("treatment:abc")).toEqual({ kind: "treatment", id: "abc" });
        expect(parsePaymentLinkValue("examination:u1")).toEqual({ kind: "examination", id: "u1" });
        expect(parsePaymentLinkValue("unter:u1")).toEqual({ kind: "examination", id: "u1" });
        expect(parsePaymentLinkValue("")).toBeNull();
    });
});

describe("buildOpenPaymentLinkSelectOptions", () => {
    it("lists only open examination/treatment rows with examination: keys", () => {
        const treatments: Treatment[] = [
            {
                id: "b-open",
                chart_id: "c1",
                kind: "Füllung",
                description: null,
                teeth: null,
                material: null,
                notes: null,
                created_at: "2026-01-01T00:00:00Z",
                service_name: "Füllung",
                total_cost: 80,
                treatment_number: "B-1",
            },
            {
                id: "b-paid",
                chart_id: "c1",
                kind: "Krone",
                description: null,
                teeth: null,
                material: null,
                notes: null,
                created_at: "2026-01-01T00:00:00Z",
                service_name: "Krone",
                total_cost: 500,
                treatment_number: "B-2",
            },
        ];
        const examinations: Examination[] = [
            {
                id: "u-open",
                chart_id: "c1",
                chief_complaint: null,
                results: null,
                diagnosis: "Check",
                created_at: "2026-01-01T00:00:00Z",
                service_name: "Kontrolle",
                total_cost: 49,
                examination_number: "U-1",
            },
        ];
        const payments: Payment[] = [
            {
                id: "z1",
                patient_id: "p1",
                amount: 500,
                payment_method: "CASH",
                status: "PAID",
                service_item_id: null,
                description: null,
                created_at: "2026-01-02T00:00:00Z",
                treatment_id: "b-paid",
                examination_id: null,
                amount_expected: 500,
            },
            {
                id: "z2",
                patient_id: "p1",
                amount: 0,
                payment_method: "INVOICE",
                status: "OUTSTANDING",
                service_item_id: null,
                description: "open",
                created_at: "2026-01-02T00:00:00Z",
                treatment_id: "b-open",
                examination_id: null,
                amount_expected: 80,
            },
        ];
        const opts = buildOpenPaymentLinkSelectOptions(
            payments,
            "p1",
            treatments,
            examinations,
            t,
            tp,
        );
        const values = opts.map((o) => o.value).filter(Boolean);
        expect(values).toContain("treatment:b-open");
        expect(values).toContain("examination:u-open");
        expect(values).not.toContain("treatment:b-paid");
        expect(values.some((v) => v.startsWith("unter:"))).toBe(false);
    });
});
