/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/models/types";
import { useAuthStore } from "@/models/store/auth-store";
import App from "@/App";
import { createPatient } from "@/systems/practice-host/controllers/patient.controller";
import { getChart, createDentalFinding } from "@/systems/practice-host/controllers/chart.controller";
import { setChartSectionValidated } from "@/systems/practice-host/controllers/validation.controller";
import { createAppointment, updateAppointment } from "@/systems/practice-host/controllers/appointment.controller";
import { createPayment, updatePaymentStatus } from "@/systems/practice-host/controllers/payment.controller";
import { PRIVACY_UI_ENABLED } from "@/lib/privacy-config";
import { PrivacyPage } from "@/views/pages/privacy";
import { DayCloseForm } from "@/views/components/day-close-form";
import { LicenseActivatePage } from "@/systems/practice-host/pages/license-activate";
import type { Payment } from "@/models/types";
import { tauriInvoke } from "@/services/tauri.service";
import { CLUSTER_STATUS_READY } from "@/models/store/cluster-store";

vi.mock("@/services/tauri.service", () => ({
    tauriInvoke: vi.fn(),
}));

const PHYSICIAN_SESSION: Session = {
    user_id: "u-smoke",
    name: "Dr. Smoke",
    email: "smoke@medoc.test",
    role: "PHYSICIAN",
};

const MOCK_PATIENT = {
    id: "p-smoke-1",
    name: "Patient Smoke",
    date_of_birth: "1988-01-15",
    sex: "MALE" as const,
    insurance_number: "VNR-SMOKE-1",
    phone: null,
    email: null,
    address: null,
    status: "ACTIVE" as const,
    created_at: "2026-01-01 10:00:00",
    updated_at: "2026-01-01 10:00:00",
};

const MOCK_CHART = {
    id: "chart-smoke-1",
    patient_id: MOCK_PATIENT.id,
    status: "VALIDATED" as const,
    diagnosis: null,
    findings: null,
    created_at: "2026-01-01 10:00:00",
    updated_at: "2026-01-01 10:00:00",
};

const MOCK_DENTAL_FINDING = {
    id: "zb-smoke-1",
    chart_id: MOCK_CHART.id,
    tooth_number: 11,
    finding: "KARIES",
    diagnosis: null,
    notes: null,
    created_at: "2026-01-01 10:00:00",
    updated_at: "2026-01-01 10:00:00",
};

function resetAuthStore() {
    useAuthStore.setState({ session: null, sessionChecked: false });
}

afterEach(() => {
    cleanup();
    resetAuthStore();
    vi.clearAllMocks();
});

describe("critical flow (a) login → dashboard → logout", () => {
    let sessionHold: Session | null = null;

    beforeEach(() => {
        sessionHold = null;
        resetAuthStore();
        vi.mocked(tauriInvoke).mockImplementation(async (cmd: string) => {
            switch (cmd) {
                case "get_db_setup_status":
                    return { needsPassphraseSetup: false, needsUnlock: false };
                case "get_session":
                    return sessionHold;
                case "login":
                    sessionHold = PHYSICIAN_SESSION;
                    return PHYSICIAN_SESSION;
                case "logout":
                    sessionHold = null;
                    return undefined;
                case "touch_session":
                    return true;
                case "check_for_updates":
                    return {
                        current_version: "0.1.0",
                        latest_version: "0.1.0",
                        update_available: false,
                        channel: "stable",
                    };
                case "get_app_kv":
                    return null;
                case "sync_native_menu":
                    return undefined;
                case "sync_get_status":
                    return {
                        localDeviceId: "smoke-master",
                        deployment: {
                            schemaVersion: 1,
                            mode: "practice_desktop",
                            role: "MASTER",
                            masterBaseUrl: "",
                            masterCertSha256: "",
                            masterAccessToken: "",
                            deviceLabel: "Smoke Master",
                            activationToken: "",
                            masterPubkey: "",
                            masterDeviceId: "",
                            pairingRequestId: "",
                            unstableMesh: false,
                        },
                        localSeq: 0,
                        pendingOutbox: 0,
                        peers: [],
                        vectors: {},
                    };
                case "current_license_status":
                    return { valid: true, format: "v1" };
                case "cluster_status_cmd":
                    return CLUSTER_STATUS_READY;
                case "get_dashboard_stats":
                    return {
                        patients_total: 0,
                        appointments_today: 0,
                        revenue_month: 0,
                        products_low: 0,
                    };
                case "list_appointments":
                    return [];
                case "list_patients":
                    return [];
                case "list_purchase_orders":
                    return [];
                default:
                    throw new Error(`unmocked IPC in flow (a): ${cmd}`);
            }
        });
    });

    it("signs in, shows dashboard greeting, signs out", async () => {
        const user = userEvent.setup();
        render(<App />);

        expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();

        await user.type(screen.getByLabelText("Email"), "smoke@medoc.test");
        const pw = document.querySelector<HTMLInputElement>("#password");
        expect(pw).toBeTruthy();
        await user.type(pw!, "secret123");
        await user.click(screen.getByRole("button", { name: /Sign in$/ }));

        expect(await screen.findByRole("heading", { name: /Good morning, Dr\. Smoke/ })).toBeInTheDocument();

        const aside = screen.getByRole("complementary");
        await user.click(within(aside).getByRole("button", { name: "Account: settings and sign out" }));
        await user.click(await screen.findByRole("menuitem", { name: "Sign out" }));

        const logoutDialog = await screen.findByRole("dialog", { name: "Sign out?" });
        await user.click(within(logoutDialog).getByRole("button", { name: "Sign out" }));

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
        });
        const ipcCommands = vi.mocked(tauriInvoke).mock.calls.map((c) => c[0]);
        expect(ipcCommands, `IPC calls: ${ipcCommands.join(", ")}`).toContain("logout");
    });
});

describe("critical flow (b) patient → chart → DentalFinding → validate Master", () => {
    const calls: string[] = [];

    beforeEach(() => {
        calls.length = 0;
        vi.mocked(tauriInvoke).mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
            calls.push(cmd);
            if (cmd === "create_patient") return MOCK_PATIENT;
            if (cmd === "get_chart") return MOCK_CHART;
            if (cmd === "update_dental_finding") return MOCK_DENTAL_FINDING;
            if (cmd === "set_chart_section_validated") return undefined;
            throw new Error(`unmocked IPC in flow (b): ${cmd} ${JSON.stringify(args)}`);
        });
    });

    it("performs the IPC sequence for.stub backend", async () => {
        const p = await createPatient({
            name: MOCK_PATIENT.name,
            date_of_birth: MOCK_PATIENT.date_of_birth,
            sex: MOCK_PATIENT.sex,
            insurance_number: MOCK_PATIENT.insurance_number,
        });
        expect(p.id).toBe(MOCK_PATIENT.id);

        const chart = await getChart(p.id);
        expect(chart.id).toBe(MOCK_CHART.id);

        const zb = await createDentalFinding({
            chart_id: chart.id,
            tooth_number: 11,
            finding: "KARIES",
        });
        expect(zb.tooth_number).toBe(11);

        await setChartSectionValidated(p.id, "master", "u-smoke");

        expect(calls).toEqual([
            "create_patient",
            "get_chart",
            "update_dental_finding",
            "set_chart_section_validated",
        ]);
    });
});

describe("critical flow (c) appointment → completed → payment → paid", () => {
    const calls: string[] = [];

    const appointment1 = {
        id: "t-smoke-1",
        date: "2026-05-10",
        time: "09:30:00",
        kind: "EXAMINATION" as const,
        status: "PLANNED" as const,
        notes: null,
        chief_complaint: null,
        patient_id: MOCK_PATIENT.id,
        physician_id: "u-smoke",
        created_at: "2026-05-01 08:00:00",
        updated_at: "2026-05-01 08:00:00",
    };

    const payment1: Payment = {
        id: "z-smoke-1",
        patient_id: MOCK_PATIENT.id,
        amount: 42,
        payment_method: "CASH",
        status: "OUTSTANDING",
        service_item_id: null,
        description: null,
        created_at: "2026-05-10 10:00:00",
    };

    beforeEach(() => {
        calls.length = 0;
        vi.mocked(tauriInvoke).mockImplementation(async (cmd: string) => {
            calls.push(cmd);
            if (cmd === "create_appointment") return appointment1;
            if (cmd === "update_appointment") return { ...appointment1, status: "COMPLETED" as const };
            if (cmd === "create_payment") return payment1;
            if (cmd === "update_payment_status") return { ...payment1, status: "PAID" as const };
            throw new Error(`unmocked IPC in flow (c): ${cmd}`);
        });
    });

    it("advances appointment and settles payment in IPC order", async () => {
        const t0 = await createAppointment({
            date: appointment1.date,
            time: appointment1.time,
            kind: appointment1.kind,
            patient_id: appointment1.patient_id,
            physician_id: appointment1.physician_id,
        });
        expect(t0.status).toBe("PLANNED");

        const t1 = await updateAppointment(t0.id, { status: "COMPLETED" });
        expect(t1.status).toBe("COMPLETED");

        const z = await createPayment({
            patient_id: MOCK_PATIENT.id,
            amount: 42,
            payment_method: "CASH",
        });
        expect(z.status).toBe("OUTSTANDING");

        const zDone = await updatePaymentStatus(z.id, "PAID");
        expect(zDone.status).toBe("PAID");

        expect(calls).toEqual(["create_appointment", "update_appointment", "create_payment", "update_payment_status"]);
    });
});

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

describe("critical flow (f) login rejection on wrong password", () => {
    beforeEach(() => {
        resetAuthStore();
        vi.mocked(tauriInvoke).mockImplementation(async (cmd: string) => {
            switch (cmd) {
                case "get_db_setup_status":
                    return { needsPassphraseSetup: false, needsUnlock: false };
                case "get_session":
                    return null;
                case "login":
                    throw new Error("error.app.unauthorized");
                case "check_for_updates":
                    return { current_version: "0.1.0", latest_version: "0.1.0", update_available: false, channel: "stable" };
                case "sync_native_menu":
                    return undefined;
                case "get_app_kv":
                    return null;
                case "cluster_status_cmd":
                    return CLUSTER_STATUS_READY;
                default:
                    throw new Error(`unmocked IPC in flow (f): ${cmd}`);
            }
        });
    });

    it("surfaces the backend error message and keeps the user on the login screen", async () => {
        const user = userEvent.setup();
        render(<App />);

        expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();

        await user.type(screen.getByLabelText("Email"), "smoke@medoc.test");
        const pw = document.querySelector<HTMLInputElement>("#password");
        expect(pw).toBeTruthy();
        await user.type(pw!, "bogus");
        await user.click(screen.getByRole("button", { name: /Sign in$/ }));

        const alert = await screen.findByRole("alert");
        expect(alert.textContent ?? "").toMatch(/error\.app\.unauthorized|Not authorized/i);

        expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
        const ipcCommands = vi.mocked(tauriInvoke).mock.calls.map((c) => c[0]);
        expect(ipcCommands).toContain("login");
        expect(useAuthStore.getState().session).toBeNull();
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
            expect(
                screen.getByLabelText("Active license"),
            ).toBeInTheDocument();
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
