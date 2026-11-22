import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Payment } from "@/models/types";

vi.mock("@/systems/practice-host/controllers/patient.controller", () => ({
    getPatient: vi.fn(),
}));
vi.mock("@/systems/practice-host/controllers/chart.controller", () => ({
    getChart: vi.fn(),
    listTreatments: vi.fn(),
    listExaminations: vi.fn(),
}));
vi.mock("@/systems/practice-host/controllers/practice.controller", () => ({
    listTreatmentCatalog: vi.fn(async () => []),
}));
vi.mock("@/systems/practice-host/controllers/service-item.controller", () => ({
    listServices: vi.fn(async () => []),
}));
vi.mock("@/lib/invoice-service-item", () => ({
    getInvoicePracticeFromStorage: vi.fn(() => ({
        name: "Test practice",
        addr: "Sample Street 1",
        clinician_name: "Dr. Test",
    })),
}));

import { getPatient } from "@/systems/practice-host/controllers/patient.controller";
import { getChart, listTreatments, listExaminations } from "@/systems/practice-host/controllers/chart.controller";
import { buildReceiptExportForPayment, isReceiptExportReady, receiptPracticeReadiness } from "./receipt-export-flow";

const z: Payment = {
    id: "z-1",
    patient_id: "p-1",
    amount: 120,
    payment_method: "CASH",
    status: "PAID",
    description: "Checkup",
    created_at: "2026-06-02T10:00:00.000Z",
    treatment_id: "b-1",
    service_item_id: null,
    amount_expected: null,
};

describe("receipt-export-flow (GAP-11)", () => {
    beforeEach(() => {
        // German practice documents (explicit: the fallback now follows the UI language, not German).
        localStorage.setItem("medoc-documents-locale-v1", "de");
        vi.mocked(getPatient).mockResolvedValue({
            id: "p-1",
            name: "Lena Hoffmann",
            date_of_birth: "1990-01-15",
            insurance_number: "VN123",
            address: "Berlin",
        } as never);
        vi.mocked(getChart).mockResolvedValue({ id: "chart-1" } as never);
        vi.mocked(listTreatments).mockResolvedValue([]);
        vi.mocked(listExaminations).mockResolvedValue([]);
    });

    it("isReceiptExportReady when practice name + addr present", () => {
        expect(isReceiptExportReady()).toBe(true);
        expect(receiptPracticeReadiness().ready).toBe(true);
    });

    it("buildReceiptExportForPayment returns receipt bundle", async () => {
        const payload = await buildReceiptExportForPayment(z);
        expect(payload.kind).toBe("receipt");
        expect(payload.bundle.pdfLayout?.kind).toBe("receipt");
        // No client-side number: the server issues QU-… and stores the hash.
        expect(payload.bundle.source).toEqual({ kind: "receipt", sourceId: "z-1" });
        const layout = payload.bundle.pdfLayout;
        const totals = layout?.totals ?? [];
        expect(layout?.documentTitle).toBe("Quittung");
        expect(layout?.tables[0]?.headers).toHaveLength(3);
        expect(totals.find((row) => row.total)?.label).toBe("Erhaltener Betrag");
        expect(totals.map((row) => row.label)).not.toContain("Rechnungsbetrag");
        expect(totals.map((row) => row.label)).not.toContain("Noch offen");
        const closing = (layout?.closingParagraphs ?? []).join("\n");
        expect(closing).not.toMatch(/Zahlbar|überweisen|Payable|Please transfer/);
        expect(closing).toContain("Betrag dankend erhalten.");
    });

    it("refuses receipts for unpaid payments", async () => {
        await expect(buildReceiptExportForPayment({ ...z, status: "OUTSTANDING" } as Payment)).rejects.toThrow(/paid payment/);
    });

    it("buildReceiptExportForPayment throws when practice not ready", async () => {
        const { getInvoicePracticeFromStorage } = await import("@/lib/invoice-service-item");
        vi.mocked(getInvoicePracticeFromStorage).mockReturnValueOnce({ name: "", addr: "" } as never);
        await expect(buildReceiptExportForPayment(z)).rejects.toThrow(/Practice master data incomplete/);
    });
});
