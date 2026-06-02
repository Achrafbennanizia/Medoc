import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Zahlung } from "@/models/types";

vi.mock("@/systems/practice-host/controllers/patient.controller", () => ({
    getPatient: vi.fn(),
}));
vi.mock("@/systems/practice-host/controllers/akte.controller", () => ({
    getAkte: vi.fn(),
    listBehandlungen: vi.fn(),
    listUntersuchungen: vi.fn(),
}));
vi.mock("@/systems/practice-host/controllers/invoice.controller", () => ({
    allocateQuittungNummer: vi.fn(),
}));
vi.mock("@/lib/invoice-leistung", () => ({
    getInvoicePraxisFromStorage: vi.fn(() => ({
        name: "Testpraxis",
        addr: "Musterstr. 1",
        behandler_name: "Dr. Test",
    })),
}));

import { getPatient } from "@/systems/practice-host/controllers/patient.controller";
import { getAkte, listBehandlungen, listUntersuchungen } from "@/systems/practice-host/controllers/akte.controller";
import { allocateQuittungNummer } from "@/systems/practice-host/controllers/invoice.controller";
import { buildQuittungExportForZahlung, isQuittungExportReady } from "./quittung-export-flow";

const z: Zahlung = {
    id: "z-1",
    patient_id: "p-1",
    betrag: 120,
    zahlungsart: "BAR",
    status: "BEZAHLT",
    beschreibung: "Kontrolle",
    created_at: "2026-06-02T10:00:00.000Z",
    behandlung_id: "b-1",
    leistung_id: null,
    betrag_erwartet: null,
};

describe("quittung-export-flow (GAP-11)", () => {
    beforeEach(() => {
        vi.mocked(getPatient).mockResolvedValue({
            id: "p-1",
            name: "Lena Hoffmann",
            geburtsdatum: "1990-01-15",
            versicherungsnummer: "VN123",
            adresse: "Berlin",
        } as never);
        vi.mocked(getAkte).mockResolvedValue({ id: "akte-1" } as never);
        vi.mocked(listBehandlungen).mockResolvedValue([]);
        vi.mocked(listUntersuchungen).mockResolvedValue([]);
        vi.mocked(allocateQuittungNummer).mockResolvedValue("Q-2026-0001");
    });

    it("isQuittungExportReady when praxis name + addr present", () => {
        expect(isQuittungExportReady()).toBe(true);
    });

    it("buildQuittungExportForZahlung returns quittung bundle", async () => {
        const payload = await buildQuittungExportForZahlung(z);
        expect(payload.kind).toBe("quittung");
        expect(payload.exportPreviewTitle).toContain("Lena Hoffmann");
        expect(payload.bundle.pdfLayout?.kind).toBe("quittung");
        expect(allocateQuittungNummer).toHaveBeenCalled();
    });
});
