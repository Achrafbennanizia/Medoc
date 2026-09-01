import { describe, expect, it } from "vitest";
import { checkPracticeDocumentReadiness } from "@/lib/practice-completeness";
import { parseInvoicePracticeJson, type InvoicePractice } from "@/lib/invoice-service-item";

const full: InvoicePractice = {
    name: "Practice",
    addr: "Str\nPLZ",
    clinician_name: "Dr. X",
    zanr: "123456789",
    bsnr: "987654321",
    bank_iban: "DE89370400440532013000",
};

describe("checkPracticeDocumentReadiness", () => {
    it("invoice requires all billing fields", () => {
        const r = checkPracticeDocumentReadiness(full, "invoice");
        expect(r.ready).toBe(true);
        const noIban = checkPracticeDocumentReadiness({ ...full, bank_iban: "" }, "invoice");
        expect(noIban.ready).toBe(false);
        expect(noIban.missingFields.some((m) => m.field === "bank_iban")).toBe(true);
    });

    it("prescription requires clinician fields", () => {
        expect(checkPracticeDocumentReadiness(full, "prescription").ready).toBe(true);
        const r = checkPracticeDocumentReadiness({ ...full, zanr: "" }, "prescription");
        expect(r.ready).toBe(false);
        expect(r.missingFields.map((m) => m.labelKey)).toContain("practice.setup.zanr");
    });

    it("chart only requires name", () => {
        expect(checkPracticeDocumentReadiness({ name: "P", addr: "" }, "chart").ready).toBe(true);
        expect(checkPracticeDocumentReadiness({ name: "", addr: "x" }, "chart").ready).toBe(false);
    });

    it("missing fields list is correct", () => {
        const r = checkPracticeDocumentReadiness(
            { name: "P", addr: "a", clinician_name: "", zanr: "", bsnr: "", bank_iban: "" },
            "invoice",
        );
        expect(r.missingFields.map((m) => m.field).sort()).toEqual(
            ["bank_iban", "clinician_name", "bsnr", "zanr"].sort(),
        );
    });
});

describe("parseInvoicePracticeJson", () => {
    it("reads English practice keys only", () => {
        const p = parseInvoicePracticeJson({
            name: "Clinic",
            addr: "Street",
            bank_iban: "DE89370400440532013000",
            payment_terms_days: 21,
            emergency_phone: "112",
            vat_exemption_notice: "VAT note",
            kv_number: "KV-1",
            chamber: "Berlin",
            bankverbindung_iban: "IGNORED",
            payment_terms_tage: 99,
            kv_nummer: "IGNORED",
            kammer: "IGNORED",
        });
        expect(p.bank_iban).toBe("DE89370400440532013000");
        expect(p.payment_terms_days).toBe(21);
        expect(p.emergency_phone).toBe("112");
        expect(p.vat_exemption_notice).toBe("VAT note");
        expect(p.kv_number).toBe("KV-1");
        expect(p.chamber).toBe("Berlin");
    });
});
