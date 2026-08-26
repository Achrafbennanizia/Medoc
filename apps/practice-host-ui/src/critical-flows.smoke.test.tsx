/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/models/types";
import { useAuthStore } from "@/models/store/auth-store";
import App from "@/App";
import { createPatient } from "@/systems/practice-host/controllers/patient.controller";
import { getAkte, createZahnbefund } from "@/systems/practice-host/controllers/akte.controller";
import { setAkteSectionValidated } from "@/systems/practice-host/controllers/validation.controller";
import { createTermin, updateTermin } from "@/systems/practice-host/controllers/termin.controller";
import { createZahlung, updateZahlungStatus } from "@/systems/practice-host/controllers/zahlung.controller";
import { DATENSCHUTZ_UI_ENABLED } from "@/lib/datenschutz-config";
import { DatenschutzPage } from "@/views/pages/datenschutz";
import { TagesabschlussForm } from "@/views/components/tagesabschluss-form";
import { LicenseActivatePage } from "@/systems/practice-host/pages/license-activate";
import type { Zahlung } from "@/models/types";
import { tauriInvoke } from "@/services/tauri.service";
import { VERBUND_STATUS_READY } from "@/models/store/verbund-store";

vi.mock("@/services/tauri.service", () => ({
    tauriInvoke: vi.fn(),
    logWorkflowRouteEnter: vi.fn(),
}));

const ARZT_SESSION: Session = {
    user_id: "u-smoke",
    name: "Dr. Smoke",
    email: "smoke@medoc.test",
    rolle: "ARZT",
};

const MOCK_PATIENT = {
    id: "p-smoke-1",
    name: "Patient Smoke",
    geburtsdatum: "1988-01-15",
    geschlecht: "MAENNLICH" as const,
    versicherungsnummer: "VNR-SMOKE-1",
    telefon: null,
    email: null,
    adresse: null,
    status: "AKTIV" as const,
    created_at: "2026-01-01 10:00:00",
    updated_at: "2026-01-01 10:00:00",
};

const MOCK_AKTE = {
    id: "akte-smoke-1",
    patient_id: MOCK_PATIENT.id,
    status: "VALIDIERT" as const,
    diagnose: null,
    befunde: null,
    created_at: "2026-01-01 10:00:00",
    updated_at: "2026-01-01 10:00:00",
};

const MOCK_ZAHNBEFUND = {
    id: "zb-smoke-1",
    akte_id: MOCK_AKTE.id,
    zahn_nummer: 11,
    befund: "KARIES",
    diagnose: null,
    notizen: null,
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
                    sessionHold = ARZT_SESSION;
                    return ARZT_SESSION;
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
                case "verbund_status_cmd":
                    return VERBUND_STATUS_READY;
                case "onboarding_subscription_status":
                    return { needsPracticeSetup: false, needsMemberAccount: false };
                case "get_dashboard_stats":
                    return {
                        patienten_gesamt: 0,
                        termine_heute: 0,
                        einnahmen_monat: 0,
                        produkte_niedrig: 0,
                    };
                case "list_termine":
                    return [];
                case "list_patienten":
                    return [];
                case "list_bestellungen":
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
        const pw = document.querySelector<HTMLInputElement>("#passwort");
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

describe("critical flow (b) patient → akte → Zahnbefund → validate Stamm", () => {
    const calls: string[] = [];

    beforeEach(() => {
        calls.length = 0;
        vi.mocked(tauriInvoke).mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
            calls.push(cmd);
            if (cmd === "create_patient") return MOCK_PATIENT;
            if (cmd === "get_akte") return MOCK_AKTE;
            if (cmd === "update_zahnbefund") return MOCK_ZAHNBEFUND;
            if (cmd === "set_akte_section_validated") return undefined;
            throw new Error(`unmocked IPC in flow (b): ${cmd} ${JSON.stringify(args)}`);
        });
    });

    it("performs the IPC sequence for.stub backend", async () => {
        const p = await createPatient({
            name: MOCK_PATIENT.name,
            geburtsdatum: MOCK_PATIENT.geburtsdatum,
            geschlecht: MOCK_PATIENT.geschlecht,
            versicherungsnummer: MOCK_PATIENT.versicherungsnummer,
        });
        expect(p.id).toBe(MOCK_PATIENT.id);

        const akte = await getAkte(p.id);
        expect(akte.id).toBe(MOCK_AKTE.id);

        const zb = await createZahnbefund({
            akte_id: akte.id,
            zahn_nummer: 11,
            befund: "KARIES",
        });
        expect(zb.zahn_nummer).toBe(11);

        await setAkteSectionValidated(p.id, "stamm", "u-smoke");

        expect(calls).toEqual([
            "create_patient",
            "get_akte",
            "update_zahnbefund",
            "set_akte_section_validated",
        ]);
    });
});

describe("critical flow (c) appointment → completed → payment → paid", () => {
    const calls: string[] = [];

    const termin1 = {
        id: "t-smoke-1",
        datum: "2026-05-10",
        uhrzeit: "09:30:00",
        art: "UNTERSUCHUNG" as const,
        status: "GEPLANT" as const,
        notizen: null,
        beschwerden: null,
        patient_id: MOCK_PATIENT.id,
        arzt_id: "u-smoke",
        created_at: "2026-05-01 08:00:00",
        updated_at: "2026-05-01 08:00:00",
    };

    const zahlung1: Zahlung = {
        id: "z-smoke-1",
        patient_id: MOCK_PATIENT.id,
        betrag: 42,
        zahlungsart: "BAR",
        status: "AUSSTEHEND",
        leistung_id: null,
        beschreibung: null,
        created_at: "2026-05-10 10:00:00",
    };

    beforeEach(() => {
        calls.length = 0;
        vi.mocked(tauriInvoke).mockImplementation(async (cmd: string) => {
            calls.push(cmd);
            if (cmd === "create_termin") return termin1;
            if (cmd === "update_termin") return { ...termin1, status: "DURCHGEFUEHRT" as const };
            if (cmd === "create_zahlung") return zahlung1;
            if (cmd === "update_zahlung_status") return { ...zahlung1, status: "BEZAHLT" as const };
            throw new Error(`unmocked IPC in flow (c): ${cmd}`);
        });
    });

    it("advances termin and settles payment in IPC order", async () => {
        const t0 = await createTermin({
            datum: termin1.datum,
            uhrzeit: termin1.uhrzeit,
            art: termin1.art,
            patient_id: termin1.patient_id,
            arzt_id: termin1.arzt_id,
        });
        expect(t0.status).toBe("GEPLANT");

        const t1 = await updateTermin(t0.id, { status: "DURCHGEFUEHRT" });
        expect(t1.status).toBe("DURCHGEFUEHRT");

        const z = await createZahlung({
            patient_id: MOCK_PATIENT.id,
            betrag: 42,
            zahlungsart: "BAR",
        });
        expect(z.status).toBe("AUSSTEHEND");

        const zDone = await updateZahlungStatus(z.id, "BEZAHLT");
        expect(zDone.status).toBe("BEZAHLT");

        expect(calls).toEqual(["create_termin", "update_termin", "create_zahlung", "update_zahlung_status"]);
    });
});

describe("critical flow (d) Tagesabschluss mismatch → Notiz → protokollieren", () => {
    const zahlungTag: Zahlung = {
        id: "z-ta-1",
        patient_id: MOCK_PATIENT.id,
        betrag: 100,
        zahlungsart: "BAR",
        status: "BEZAHLT",
        leistung_id: null,
        beschreibung: null,
        kasse_geprueft: 0,
        created_at: "2001-03-20 15:00:00",
    };

    beforeEach(() => {
        vi.mocked(tauriInvoke).mockImplementation(async (cmd: string) => {
            if (cmd === "list_zahlungen") return [zahlungTag];
            throw new Error(`unmocked IPC in flow (d): ${cmd}`);
        });
    });

    it("submits protocol with mismatch and note", async () => {
        const user = userEvent.setup();
        const onProtokolliere = vi.fn().mockResolvedValue(undefined);

        render(
            <TagesabschlussForm
                canWrite
                getPatientName={(id) => (id === MOCK_PATIENT.id ? MOCK_PATIENT.name : id)}
                onProtokolliere={onProtokolliere}
                fixedStichtag="2001-03-20"
                saveBusy={false}
            />,
        );

        expect(await screen.findByText(/Sum of cash payments/i)).toBeInTheDocument();

        await user.type(screen.getByLabelText(/Counted cash amount/i), "77,50");
        await user.type(screen.getByLabelText(/Remark/i), "Kassenabweichung Smoke");

        await user.click(screen.getByRole("button", { name: /Log daily close/i }));

        await waitFor(() => {
            expect(onProtokolliere).toHaveBeenCalledTimes(1);
        });

        const payload = onProtokolliere.mock.calls[0][0] as {
            notiz: string | null;
            bar_stimmt: number;
            abweichung_eur: number | null;
        };
        expect(payload.notiz).toBe("Kassenabweichung Smoke");
        expect(payload.bar_stimmt).toBe(0);
        expect(payload.abweichung_eur).not.toBeNull();
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
                    throw new Error("Falsche E-Mail oder Passwort");
                case "check_for_updates":
                    return { current_version: "0.1.0", latest_version: "0.1.0", update_available: false, channel: "stable" };
                case "sync_native_menu":
                    return undefined;
                case "get_app_kv":
                    return null;
                case "verbund_status_cmd":
                    return VERBUND_STATUS_READY;
                case "onboarding_subscription_status":
                    return { needsPracticeSetup: false, needsMemberAccount: false };
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
        const pw = document.querySelector<HTMLInputElement>("#passwort");
        expect(pw).toBeTruthy();
        await user.type(pw!, "bogus");
        await user.click(screen.getByRole("button", { name: /Sign in$/ }));

        const alert = await screen.findByRole("alert");
        expect(alert.textContent ?? "").toMatch(/Falsche E-Mail oder Passwort/);

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
                        return { valid: false, reason: "Lizenz abgelaufen", format: null };
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

describe.skipIf(!DATENSCHUTZ_UI_ENABLED)("critical flow (e) DSGVO export → erase → browser storage clean", () => {
    beforeEach(() => {
        vi.mocked(tauriInvoke).mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
            if (cmd === "list_patienten") return [MOCK_PATIENT];
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
        const legacyKey = `medoc.akte.validation.v1.${MOCK_PATIENT.id}`;
        try {
            localStorage.removeItem(legacyKey);
        } catch {
            /* non-browser / incomplete Storage (see vitest-setup) */
        }
        localStorage.setItem(legacyKey, '{"version":2,"sections":{},"items":{}}');

        render(<DatenschutzPage />);

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
