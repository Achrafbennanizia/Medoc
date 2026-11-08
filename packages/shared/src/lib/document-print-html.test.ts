import { describe, expect, it } from "vitest";
import { suggestCertificateExportBasename } from "./document-print-html";
import { buildCertificatePdfLayout } from "./clinical-pdf-layout";
import { useLocale } from "./i18n";

describe("suggestCertificateExportBasename", () => {
    it("uses an English Certificate_ prefix", () => {
        const name = suggestCertificateExportBasename({
            id: "abcdefgh-rest",
            issued_at: "2026-08-20T10:00:00.000Z",
        } as Parameters<typeof suggestCertificateExportBasename>[0]);
        expect(name).toBe("Certificate_2026-08-20_abcdefgh");
        expect(name.startsWith("Attest_")).toBe(false);
    });
});

describe("certificate validity unit", () => {
    it("PDF layout interpolates Kalendertage not {unit}", () => {
        useLocale.getState().setLocale("de");
        const layout = buildCertificatePdfLayout(
            {
                id: "c1",
                patient_id: "p1",
                physician_id: "d1",
                kind: "SICK_LEAVE",
                body_text: "x",
                valid_from: "2026-03-01",
                valid_until: "2026-03-05",
                issued_at: "2026-03-01T00:00:00Z",
                created_at: "2026-03-01T00:00:00Z",
            },
            null,
        );
        const blob = JSON.stringify(layout);
        expect(blob).toContain("Kalendertage");
        expect(blob).not.toContain("{unit}");
        expect(blob).not.toContain("Kalendertags");
    });
});
