/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/models/types";
import { useAuthStore } from "@/models/store/auth-store";
import App from "@/App";
import { createPatient } from "@/controllers/patient.controller";
import { getAkte, createZahnbefund } from "@/controllers/akte.controller";
import { setAkteSectionValidated } from "@/controllers/validation.controller";
import { createTermin, updateTermin } from "@/controllers/termin.controller";
import { createZahlung, updateZahlungStatus } from "@/controllers/zahlung.controller";
import { DatenschutzPage } from "@/views/pages/datenschutz";
import { TagesabschlussForm } from "@/views/components/tagesabschluss-form";
import type { Zahlung } from "@/models/types";
import { tauriInvoke } from "@/services/tauri.service";

vi.mock("@/services/tauri.service", () => ({
    tauriInvoke: vi.fn(),
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
                default:
                    throw new Error(`unmocked IPC in flow (a): ${cmd}`);
            }
        });
    });

    it("signs in, shows dashboard greeting, signs out", async () => {
        const user = userEvent.setup();
        render(<App />);

        expect(await screen.findByRole("heading", { name: "Anmelden" })).toBeInTheDocument();

        await user.type(screen.getByLabelText("E-Mail"), "smoke@medoc.test");
        const pw = document.querySelector<HTMLInputElement>("#passwort");
        expect(pw).toBeTruthy();
        await user.type(pw!, "secret123");
        await user.click(screen.getByRole("button", { name: /Anmelden$/ }));

        expect(await screen.findByRole("heading", { name: /Guten Morgen, Dr\. Smoke/ })).toBeInTheDocument();

        const aside = screen.getByRole("complementary");
        await user.click(within(aside).getByRole("button", { name: "Profilmenü öffnen" }));
        await user.click(await within(aside).findByRole("button", { name: "Abmelden" }));

        const logoutDialog = await screen.findByRole("dialog", { name: "Abmelden?" });
        await user.click(within(logoutDialog).getByRole("button", { name: "Abmelden" }));

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: "Anmelden" })).toBeInTheDocument();
        });
        expect(tauriInvoke).toHaveBeenCalledWith("logout");
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

describe("critical flow (c) termin → durchgeführt → zahlung → bezahlt", () => {
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

        expect(await screen.findByText(/Summe der Barzahlungen/i)).toBeInTheDocument();

        await user.type(screen.getByLabelText(/Gezählter Bargeldbetrag/i), "77,50");
        await user.type(screen.getByLabelText(/Bemerkung/i), "Kassenabweichung Smoke");

        await user.click(screen.getByRole("button", { name: /Tagesabschluss protokollieren/i }));

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

describe("critical flow (e) DSGVO export → erase → browser storage clean", () => {
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
