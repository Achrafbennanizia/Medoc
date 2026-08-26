import { describe, expect, it, vi, beforeEach } from "vitest";
import { createZahlung } from "@/systems/practice-host/controllers/zahlung.controller";
import { billingReleaseErrorDe } from "@/lib/billing-release";
import { tauriInvoke } from "@/services/tauri.service";

vi.mock("@/services/tauri.service", () => ({
    tauriInvoke: vi.fn(),
    logWorkflowRouteEnter: vi.fn(),
}));

describe("N3 FA-LEIST-05 release → Zahlung (IPC contract)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("create_zahlung rejects behandlung link without physician release", async () => {
        const msg = billingReleaseErrorDe("Treatment");
        expect(msg).toMatch(/not yet released for billing/);
        vi.mocked(tauriInvoke).mockRejectedValueOnce(new Error(msg));
        await expect(
            createZahlung({
                patient_id: "p-1",
                betrag: 10,
                zahlungsart: "BAR",
                behandlung_id: "beh-1",
            }),
        ).rejects.toThrow(/FA-LEIST-05/);
        expect(tauriInvoke).toHaveBeenCalledWith("create_zahlung", expect.any(Object));
    });

    it("create_zahlung succeeds when backend accepts released behandlung", async () => {
        vi.mocked(tauriInvoke).mockResolvedValueOnce({
            id: "z-1",
            patient_id: "p-1",
            betrag: 10,
            zahlungsart: "BAR",
            status: "AUSSTEHEND",
            leistung_id: null,
            beschreibung: null,
            created_at: "2026-05-21 10:00:00",
        });
        const z = await createZahlung({
            patient_id: "p-1",
            betrag: 10,
            zahlungsart: "BAR",
            behandlung_id: "beh-released",
        });
        expect(z.id).toBe("z-1");
        expect(tauriInvoke).toHaveBeenCalledWith("create_zahlung", expect.any(Object));
    });
});
