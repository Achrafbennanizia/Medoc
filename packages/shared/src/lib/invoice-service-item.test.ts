import { describe, expect, it } from "vitest";
import {
    buildInvoiceHeaderAddressLines,
    parseInvoicePracticeJson,
    type InvoicePractice,
} from "./invoice-service-item";
import { DEFAULT_PRACTICE_HEADER_PRIVACY } from "./practice-header-privacy";

const practice: InvoicePractice = {
    name: "Clinic",
    addr: "Street 1",
    kv_number: "123456",
    tax_number: "DE-TAX",
    opening_hours: "Mon–Fri 08:00–18:00",
    chamber: "Berlin",
};

describe("buildInvoiceHeaderAddressLines", () => {
    it("labels KV as health insurance, not site number", () => {
        const lines = buildInvoiceHeaderAddressLines(practice, DEFAULT_PRACTICE_HEADER_PRIVACY);
        expect(lines).toContain("Health insurance no. 123456");
        expect(lines.some((l) => /site no/i.test(l))).toBe(false);
        expect(lines.some((l) => /Betriebs/i.test(l))).toBe(false);
    });
});

describe("parseInvoicePracticeJson", () => {
    it("reads English chamber and vat_id keys only", () => {
        const english = parseInvoicePracticeJson({
            name: "Clinic",
            addr: "Street",
            chamber: "Berlin",
            vat_id: "DE2",
            kammer: "Hamburg",
            ust_id: "DE1",
        });
        expect(english.chamber).toBe("Berlin");
        expect(english.vat_id).toBe("DE2");
    });

    it("ignores leftover German keys", () => {
        const leftover = parseInvoicePracticeJson({
            name: "Clinic",
            addr: "Street",
            kammer: "Hamburg",
            ust_id: "DE1",
        });
        expect(leftover.chamber).toBeUndefined();
        expect(leftover.vat_id).toBeUndefined();
    });
});
