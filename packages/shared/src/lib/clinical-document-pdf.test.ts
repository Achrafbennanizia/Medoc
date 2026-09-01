import { describe, expect, it } from "vitest";
import { buildClinicalTemplateHeaderLines } from "./clinical-document-pdf";
import { emptyDocumentTemplatePayloadV1 } from "./document-template-schema";
import { DEFAULT_PRACTICE_HEADER_PRIVACY } from "./practice-header-privacy";
import type { InvoicePractice } from "./invoice-service-item";

const practice: InvoicePractice = {
    name: "Clinic",
    addr: "Street 1",
    kv_number: "123456",
    chamber: "Berlin",
    bsnr: "987654321",
};

describe("buildClinicalTemplateHeaderLines", () => {
    it("labels KV as health insurance and chamber separately from BSNR", () => {
        const tpl = emptyDocumentTemplatePayloadV1();
        tpl.header.fieldsToShow = ["kv", "chamber", "bsnr"];
        const lines = buildClinicalTemplateHeaderLines(tpl, practice, DEFAULT_PRACTICE_HEADER_PRIVACY);
        expect(lines).toEqual(["Health insurance no. 123456", "BSNR: 987654321", "Chamber: Berlin"]);
        expect(lines.some((l) => /site no/i.test(l))).toBe(false);
    });
});
