import { describe, expect, it } from "vitest";
import { checkPracticeDocumentReadiness } from "@/lib/practice-completeness";
import type { InvoicePractice } from "@/lib/invoice-service-item";

const full: InvoicePractice = {
    name: "Practice",
    addr: "Str\nPLZ",
    clinician_name: "Dr. X",
    zanr: "123456789",
    bsnr: "987654321",
    bankverbindung_iban: "DE89370400440532013000",
};

describe("checkPracticeDocumentReadiness", () => {
    it("invoice requires all billing fields", () => {
        const r = checkPracticeDocumentReadiness(full, "invoice");
        expect(r.ready).toBe(true);
        const noIban = checkPracticeDocumentReadiness({ ...full, bankverbindung_iban: "" }, "invoice");
        expect(noIban.ready).toBe(false);
        expect(noIban.missingFields.some((m) => m.field === "bankverbindung_iban")).toBe(true);
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
            { name: "P", addr: "a", clinician_name: "", zanr: "", bsnr: "", bankverbindung_iban: "" },
            "invoice",
        );
        expect(r.missingFields.map((m) => m.field).sort()).toEqual(
            ["bankverbindung_iban", "clinician_name", "bsnr", "zanr"].sort(),
        );
    });
});
