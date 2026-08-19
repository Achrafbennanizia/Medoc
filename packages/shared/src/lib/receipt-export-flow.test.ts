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
vi.mock("@/systems/practice-host/controllers/invoice.controller", () => ({
    allocateReceiptNumber: vi.fn(),
}));
vi.mock("@/lib/invoice-service-item", () => ({
    getInvoicePracticeFromStorage: vi.fn(() => ({
        name: "Testpraxis",
        addr: "Musterstr. 1",
        clinician_name: "Dr. Test",
    })),
}));

import { getPatient } from "@/systems/practice-host/controllers/patient.controller";
import { getChart, listTreatments, listExaminations } from "@/systems/practice-host/controllers/chart.controller";
import { allocateReceiptNumber } from "@/systems/practice-host/controllers/invoice.controller";
import { buildReceiptExportForPayment, isReceiptExportReady, receiptPracticeReadiness } from "./receipt-export-flow";

const z: Payment = {
    id: "z-1",
    patient_id: "p-1",
    amount: 120,
    payment_method: "CASH",
    status: "PAID",
    description: "Kontrolle",
    created_at: "2026-06-02T10:00:00.000Z",
    treatment_id: "b-1",
    service_item_id: null,
    amount_expected: null,
};

describe("receipt-export-flow (GAP-11)", () => {
    beforeEach(() => {
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
        vi.mocked(allocateReceiptNumber).mockResolvedValue("Q-2026-0001");
    });

    it("isReceiptExportReady when practice name + addr present", () => {
        expect(isReceiptExportReady()).toBe(true);
        expect(receiptPracticeReadiness().ready).toBe(true);
    });

    it("buildReceiptExportForPayment returns receipt bundle", async () => {
        const payload = await buildReceiptExportForPayment(z);
        expect(payload.kind).toBe("receipt");
        expect(payload.exportPreviewTitle).toContain("Lena Hoffmann");
        expect(payload.bundle.pdfLayout?.kind).toBe("receipt");
        expect(allocateReceiptNumber).toHaveBeenCalled();
    });

    it("buildReceiptExportForPayment throws when practice not ready", async () => {
        const { getInvoicePracticeFromStorage } = await import("@/lib/invoice-service-item");
        vi.mocked(getInvoicePracticeFromStorage).mockReturnValueOnce({ name: "", addr: "" } as never);
        await expect(buildReceiptExportForPayment(z)).rejects.toThrow(/Practice master data incomplete/);
    });
});
