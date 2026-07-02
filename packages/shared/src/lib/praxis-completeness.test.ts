import { describe, expect, it } from "vitest";
import { checkPraxisDocumentReadiness } from "@/lib/praxis-completeness";
import type { InvoicePraxis } from "@/lib/invoice-leistung";

const full: InvoicePraxis = {
    name: "Praxis",
    addr: "Str\nPLZ",
    behandler_name: "Dr. X",
    zanr: "123456789",
    bsnr: "987654321",
    bankverbindung_iban: "DE89370400440532013000",
};

describe("checkPraxisDocumentReadiness", () => {
    it("rechnung requires all billing fields", () => {
        const r = checkPraxisDocumentReadiness(full, "rechnung");
        expect(r.ready).toBe(true);
        const noIban = checkPraxisDocumentReadiness({ ...full, bankverbindung_iban: "" }, "rechnung");
        expect(noIban.ready).toBe(false);
        expect(noIban.missingFields.some((m) => m.field === "bankverbindung_iban")).toBe(true);
    });

    it("rezept requires behandler fields", () => {
        expect(checkPraxisDocumentReadiness(full, "rezept").ready).toBe(true);
        const r = checkPraxisDocumentReadiness({ ...full, zanr: "" }, "rezept");
        expect(r.ready).toBe(false);
        expect(r.missingFields.map((m) => m.labelKey)).toContain("praxis.setup.zanr");
    });

    it("akte only requires name", () => {
        expect(checkPraxisDocumentReadiness({ name: "P", addr: "" }, "akte").ready).toBe(true);
        expect(checkPraxisDocumentReadiness({ name: "", addr: "x" }, "akte").ready).toBe(false);
    });

    it("missing fields list is correct", () => {
        const r = checkPraxisDocumentReadiness(
            { name: "P", addr: "a", behandler_name: "", zanr: "", bsnr: "", bankverbindung_iban: "" },
            "rechnung",
        );
        expect(r.missingFields.map((m) => m.field).sort()).toEqual(
            ["bankverbindung_iban", "behandler_name", "bsnr", "zanr"].sort(),
        );
    });
});
