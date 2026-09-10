/** @vitest-environment jsdom */
/** Page/form critical flows — no full App mount. */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRIVACY_UI_ENABLED } from "@/lib/privacy-config";
import { PrivacyPage } from "@/views/pages/privacy";
import { DayCloseForm } from "@/views/components/day-close-form";
import { LicenseActivatePage } from "@/systems/practice-host/pages/license-activate";
import type { Payment } from "@/models/types";
import { tauriInvoke } from "@/services/tauri.service";
import { MOCK_PATIENT, installCriticalFlowCleanup } from "./critical-flows.smoke.shared";

vi.mock("@/services/tauri.service", () => ({
    tauriInvoke: vi.fn(),
}));

afterEach(installCriticalFlowCleanup());

describe("critical flow (d) DayClose mismatch → Notiz → protokollieren", () => {
    const paymentTag: Payment = {
        id: "z-ta-1",
        patient_id: MOCK_PATIENT.id,
        amount: 100,
        payment_method: "CASH",
        status: "PAID",
        service_item_id: null,
        description: null,
        cash_verified: 0,
        created_at: "2001-03-20 15:00:00",
    };

    beforeEach(() => {
        vi.mocked(tauriInvoke).mockImplementation(async (cmd: string) => {
            if (cmd === "list_payments") return [paymentTag];
            throw new Error(`unmocked IPC in flow (d): ${cmd}`);
        });
    });

    it("submits protocol with mismatch and note", async () => {
        const user = userEvent.setup();
        const onRecord = vi.fn().mockResolvedValue(undefined);

        render(
            <DayCloseForm
                canWrite
                getPatientName={(id) => (id === MOCK_PATIENT.id ? MOCK_PATIENT.name : id)}
                onRecord={onRecord}
                fixedAsOfDate="2001-03-20"
                saveBusy={false}
            />,
        );

        expect(await screen.findByText(/Sum of cash payments/i)).toBeInTheDocument();

        await user.type(screen.getByLabelText(/Counted cash amount/i), "77,50");
        await user.type(screen.getByLabelText(/Remark/i), "Kassenabweichung Smoke");

        await user.click(screen.getByRole("button", { name: /Log daily close/i }));

        await waitFor(() => {
            expect(onRecord).toHaveBeenCalledTimes(1);
        });

        const payload = onRecord.mock.calls[0][0] as {
            note: string | null;
            cash_matches: number;
            variance_eur: number | null;
        };
        expect(payload.note).toBe("Kassenabweichung Smoke");
        expect(payload.cash_matches).toBe(0);
        expect(payload.variance_eur).not.toBeNull();
    });
});

describe("critical flow (g) LicenseActivatePage: invalid → activate v2 → shows active license", () => {
    let firstStatusServed = false;

    beforeEach(() => {
        firstStatusServed = false;
        vi.mocked(tauriInvoke).mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
            switch (cmd) {
                case "current_license_status": {
                    if (!firstStatusServed) {
                        firstStatusServed = true;
                        return { valid: false, reason: "License abgelaufen", format: null };
                    }
                    return {
                        valid: true,
                        reason: null,
                        format: "v2",
                        licenseV2: {
                            customerId: "ACME",
                            edition: "PRO",
                            deviceId: "smoke-master",
                            activatedAt: "2026-05-27T12:00:00Z",
                            maxUsers: 5,
                            modules: [],
                            editionFeatures: [],
                        },
                    };
                }
                case "activate_license": {
                    const t = String((args as { token?: string })?.token ?? "");
                    if (t.startsWith("v2.")) {
                        return {
                            valid: true,
                            reason: null,
                            format: "v2",
                            licenseV2: {
                                customerId: "ACME",
                                edition: "PRO",
                                deviceId: "smoke-master",
                                activatedAt: "2026-05-27T12:00:00Z",
                                maxUsers: 5,
                                modules: [],
                                editionFeatures: [],
                            },
                        };
                    }
                    return { valid: false, reason: "Invalid format", format: null };
                }
                default:
                    throw new Error(`unmocked IPC in flow (g): ${cmd}`);
            }
        });
    });

    it("renders activation prompt, accepts a v2 token, and shows the active license panel", async () => {
        const user = userEvent.setup();
        const onActivated = vi.fn();
        render(<LicenseActivatePage onActivated={onActivated} />);

        expect(await screen.findByRole("heading", { name: "Activate license" })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: /Main device \(practice hub\)/ }));

        const tokenInput = screen.getByLabelText("License token") as HTMLTextAreaElement;
        await user.type(tokenInput, "v2.dummybody.dummysig");
        await user.click(screen.getByRole("button", { name: /Activate license/ }));

        await waitFor(() => {
            expect(screen.getByLabelText("Active license")).toBeInTheDocument();
        });
        const calls = vi.mocked(tauriInvoke).mock.calls.map((c) => c[0]);
        expect(calls).toContain("activate_license");
        expect(onActivated).toHaveBeenCalled();
    });
});

describe.skipIf(!PRIVACY_UI_ENABLED)("critical flow (e) DSGVO export → erase → browser storage clean", () => {
    beforeEach(() => {
        vi.mocked(tauriInvoke).mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
            if (cmd === "list_patients") return [MOCK_PATIENT];
            if (cmd === "dsgvo_export_patient") {
                return { patient_id: MOCK_PATIENT.id, stub: true };
            }
            if (cmd === "dsgvo_erase_patient") {
                return {
                    patient_id: String(args?.patient_id ?? ""),
                    anonymised_at: "2026-05-01T12:00:00Z",
                    deleted_records: 3,
                };
            }
            throw new Error(`unmocked IPC in flow (e): ${cmd}`);
        });
    });

    it("invokes export and erase and clears patient-scoped legacy keys", async () => {
        const user = userEvent.setup();
        const legacyKey = `medoc.chart.validation.v1.${MOCK_PATIENT.id}`;
        try {
            localStorage.removeItem(legacyKey);
        } catch {
            /* non-browser / incomplete Storage (see vitest-setup) */
        }
        localStorage.setItem(legacyKey, '{"version":2,"sections":{},"items":{}}');

        render(<PrivacyPage />);

        expect(await screen.findByRole("button", { name: /Export \(JSON\)/ })).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /Export \(JSON\)/ }));
        expect(tauriInvoke).toHaveBeenCalledWith("dsgvo_export_patient", { patient_id: MOCK_PATIENT.id });

        await user.click(screen.getByRole("button", { name: /Löschanfrage/ }));
        await user.click(screen.getByRole("button", { name: "Pseudonymisieren" }));

        await waitFor(() => {
            expect(tauriInvoke).toHaveBeenCalledWith("dsgvo_erase_patient", { patient_id: MOCK_PATIENT.id });
        });

        expect(localStorage.getItem(legacyKey)).toBeNull();
        expect(await screen.findByText(/Betroffene Datensätze:\s*3/)).toBeInTheDocument();
    });
});
