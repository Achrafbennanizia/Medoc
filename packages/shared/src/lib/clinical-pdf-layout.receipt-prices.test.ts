import { describe, expect, it } from "vitest";
import type { Examination, Patient, Payment, ServiceItem, Treatment, TreatmentCatalogItem } from "@/models/types";
import { buildReceiptPdfLayout, receiptPriceBreakdown } from "./clinical-pdf-layout";

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
                kind: "Filling",
                description: "Filling",
                teeth: null,
                material: null,
                notes: null,
                created_at: "2026-06-01T00:00:00.000Z",
                service_name: "Filling",
                total_cost: 80,
            },
        ];
        const catalog: TreatmentCatalogItem[] = [
            {
                id: "cat-1",
                category: "Konservierend",
                name: "Filling",
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
                name: "Checkup",
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
                service_name: "Checkup",
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

describe("buildReceiptPdfLayout currency", () => {
    it("prints the practice currency on the paid amount and the total", () => {
        localStorage.setItem("medoc-invoice-practice-v1", JSON.stringify({ currency: "MAD" }));
        try {
            const patient: Patient = {
                id: "p-1",
                name: "Ada",
                date_of_birth: "1990-01-01",
                sex: "FEMALE",
                insurance_number: "",
                phone: null,
                email: null,
                address: null,
                status: "ACTIVE",
                created_at: "2026-01-01T00:00:00.000Z",
                updated_at: "2026-01-01T00:00:00.000Z",
            };
            const layout = buildReceiptPdfLayout(payment({ amount: 70 }), patient, [], [], [], []);
            expect(layout.tables[0]?.rows[0]?.[2]).toMatch(/70[,.]00 MAD$/);
            expect(layout.totals[0]?.value).toMatch(/70[,.]00 MAD$/);
        } finally {
            localStorage.removeItem("medoc-invoice-practice-v1");
        }
    });

    it("localizes prescription type for every document locale", async () => {
        const { buildPrescriptionPdfLayout } = await import("./clinical-pdf-layout");
        const rx = {
            id: "rx-1",
            patient_id: "p-1",
            physician_id: "d-1",
            medication: "Ibuprofen",
            dosage: "1-0-1",
            duration: "5",
            dosage_form: "Filmtabletten",
            pack_size: "N1",
            quantity: 1,
            prescription_type: "PRIVAT",
            issued_at: "2026-11-09",
            status: "ISSUED",
            aut_idem: false,
            active_ingredient: null,
            instructions: null,
            pzn: null,
            created_at: "2026-11-09T00:00:00.000Z",
            updated_at: "2026-11-09T00:00:00.000Z",
        } as const;
        const expected: Record<string, string> = {
            de: "Privat",
            en: "Private",
            fr: "Privé",
            ar: "خاص",
        };
        try {
            for (const locale of ["de", "en", "fr", "ar"] as const) {
                localStorage.setItem("medoc-documents-locale-v1", locale);
                const layout = buildPrescriptionPdfLayout(rx as never, null);
                expect(layout.metaLines.find((m) => m.value === expected[locale])).toBeTruthy();
                expect(layout.documentSubtitle).toContain(expected[locale]);
                expect(layout.documentSubtitle).not.toContain("PRIVAT");
            }
        } finally {
            localStorage.removeItem("medoc-documents-locale-v1");
        }
    });

    it("formats amounts for every document locale", () => {
        localStorage.setItem("medoc-invoice-practice-v1", JSON.stringify({ currency: "EUR" }));
        const patient: Patient = {
            id: "p-1",
            name: "Ada",
            date_of_birth: "1990-01-01",
            sex: "FEMALE",
            insurance_number: "",
            phone: null,
            email: null,
            address: null,
            status: "ACTIVE",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
        };
        try {
            for (const locale of ["de", "en", "fr", "ar"] as const) {
                localStorage.setItem("medoc-documents-locale-v1", locale);
                const layout = buildReceiptPdfLayout(payment({ amount: 70 }), patient, [], [], [], []);
                expect(layout.locale).toBe(locale);
                expect(layout.rtl).toBe(locale === "ar");
                expect(layout.totals[0]?.value).toMatch(/70[,.]00 EUR$/);
            }
        } finally {
            localStorage.removeItem("medoc-invoice-practice-v1");
            localStorage.removeItem("medoc-documents-locale-v1");
        }
    });
});
