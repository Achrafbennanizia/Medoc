import { describe, expect, it } from "vitest";
import type { Examination, Payment, ServiceItem, Treatment, TreatmentCatalogItem } from "@/models/types";
import { receiptPriceBreakdown } from "./clinical-pdf-layout";

const payment = (over: Partial<Payment> = {}): Payment => ({
    id: "z-1",
    patient_id: "p-1",
    amount: 70,
    payment_method: "CASH",
    status: "PAID",
    description: null,
    created_at: "2026-06-02T10:00:00.000Z",
    treatment_id: "b-1",
    examination_id: null,
    service_item_id: null,
    amount_expected: 80,
    ...over,
});

describe("receiptPriceBreakdown", () => {
    it("returns catalog standard, clinical billed, and paid amounts", () => {
        const treatments: Treatment[] = [
            {
                id: "b-1",
                chart_id: "c-1",
                kind: "Füllung",
                description: "Füllung",
                teeth: null,
                material: null,
                notes: null,
                created_at: "2026-06-01T00:00:00.000Z",
                service_name: "Füllung",
                total_cost: 80,
            },
        ];
        const catalog: TreatmentCatalogItem[] = [
            {
                id: "cat-1",
                category: "Konservierend",
                name: "Füllung",
                default_cost: 95,
                sort_order: 1,
                active: 1,
                created_at: "2026-01-01T00:00:00.000Z",
            },
        ];
        const prices = receiptPriceBreakdown(payment(), treatments, [], catalog, []);
        expect(prices.standardPrice).toBe(95);
        expect(prices.billedPrice).toBe(80);
        expect(prices.paidPrice).toBe(70);
    });

    it("uses service_item price as standard when linked", () => {
        const services: ServiceItem[] = [
            {
                id: "si-1",
                name: "Kontrolle",
                description: null,
                category: "Prophylaxe",
                price: 49,
                active: true,
                created_at: "2026-01-01T00:00:00.000Z",
                updated_at: "2026-01-01T00:00:00.000Z",
            },
        ];
        const examinations: Examination[] = [
            {
                id: "u-1",
                chart_id: "c-1",
                chief_complaint: null,
                results: null,
                diagnosis: null,
                created_at: "2026-06-01T00:00:00.000Z",
                service_name: "Kontrolle",
                total_cost: 45,
            },
        ];
        const prices = receiptPriceBreakdown(
            payment({
                treatment_id: null,
                examination_id: "u-1",
                service_item_id: "si-1",
                amount: 45,
                amount_expected: 45,
            }),
            [],
            examinations,
            [],
            services,
        );
        expect(prices.standardPrice).toBe(49);
        expect(prices.billedPrice).toBe(45);
        expect(prices.paidPrice).toBe(45);
    });
});
