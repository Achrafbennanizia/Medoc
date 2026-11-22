import { afterEach, describe, expect, it } from "vitest";
import type { Patient, Payment } from "@/models/types";
import { documentLocale, documentLocaleForI18n } from "./document-locale";
import { translateLocale } from "./i18n";
import {
    buildCertificatePdfLayout,
    buildPrescriptionPdfLayout,
    buildReceiptPdfLayout,
} from "./clinical-pdf-layout";

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

const payment: Payment = {
    id: "z-1",
    patient_id: "p-1",
    amount: 70,
    payment_method: "CASH",
    status: "PAID",
    description: null,
    created_at: "2026-06-02T10:00:00.000Z",
    treatment_id: null,
    examination_id: null,
    service_item_id: null,
    amount_expected: 70,
};

describe("document export locale consistency", () => {
    afterEach(() => {
        localStorage.removeItem("medoc-documents-locale-v1");
        localStorage.removeItem("medoc-locale");
    });

    it("Rx / certificate / receipt layouts honor documents locale for de/en/fr/ar", () => {
        for (const locale of ["de", "en", "fr", "ar"] as const) {
            localStorage.setItem("medoc-documents-locale-v1", locale);
            expect(documentLocale()).toBe(locale);
            expect(documentLocaleForI18n()).toBe(locale);

            const cert = buildCertificatePdfLayout(
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
                } as never,
                patient,
            );
            expect(cert.locale).toBe(locale);
            expect(cert.rtl).toBe(locale === "ar");
            expect(cert.documentTitle.toUpperCase()).toContain(
                translateLocale(locale, "enum.certificate_kind.sick_leave_certificate").toUpperCase(),
            );

            const rx = buildPrescriptionPdfLayout(
                {
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
                } as never,
                patient,
            );
            expect(rx.locale).toBe(locale);
            expect(rx.documentTitle.toUpperCase()).toContain(
                translateLocale(locale, "document.print.prescription_title").toUpperCase(),
            );

            const receipt = buildReceiptPdfLayout(payment, patient, [], [], [], []);
            expect(receipt.locale).toBe(locale);
            expect(receipt.documentTitle.toUpperCase()).toContain(
                translateLocale(locale, "document.print.receipt_title").toUpperCase(),
            );
        }
    });
});
