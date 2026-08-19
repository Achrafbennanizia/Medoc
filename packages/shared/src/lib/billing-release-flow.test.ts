import { describe, expect, it, vi, beforeEach } from "vitest";
import { createPayment } from "@/systems/practice-host/controllers/payment.controller";
import { billingReleaseErrorDe } from "@/lib/billing-release";
import { tauriInvoke } from "@/services/tauri.service";

vi.mock("@/services/tauri.service", () => ({
    tauriInvoke: vi.fn(),
}));

describe("N3 FA-LEIST-05 release → Payment (IPC contract)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("create_payment rejects treatment link without physician release", async () => {
        const msg = billingReleaseErrorDe("Treatment");
        expect(msg).toMatch(/not yet released for billing/);
        vi.mocked(tauriInvoke).mockRejectedValueOnce(new Error(msg));
        await expect(
            createPayment({
                patient_id: "p-1",
                amount: 10,
                payment_method: "CASH",
                treatment_id: "beh-1",
            }),
        ).rejects.toThrow(/FA-LEIST-05/);
        expect(tauriInvoke).toHaveBeenCalledWith("create_payment", expect.any(Object));
    });

    it("create_payment succeeds when backend accepts released treatment", async () => {
        vi.mocked(tauriInvoke).mockResolvedValueOnce({
            id: "z-1",
            patient_id: "p-1",
            amount: 10,
            payment_method: "CASH",
            status: "OUTSTANDING",
            service_item_id: null,
            description: null,
            created_at: "2026-05-21 10:00:00",
        });
        const z = await createPayment({
            patient_id: "p-1",
            amount: 10,
            payment_method: "CASH",
            treatment_id: "beh-released",
        });
        expect(z.id).toBe("z-1");
        expect(tauriInvoke).toHaveBeenCalledWith("create_payment", expect.any(Object));
    });
});
