import { useCallback, useEffect, useMemo, useState } from "react";
import { checkSession, login, logout } from "@/systems/practice-host/controllers/auth.controller";
import { listPatients } from "@/systems/practice-host/controllers/patient.controller";
import { getOwnProfile, type OwnProfileDto } from "@/systems/practice-host/controllers/staff.controller";
import { listAppointmentsByDate } from "@/systems/practice-host/controllers/appointment.controller";
import {
    EMPTY_LAN_CLIENT_CONFIG,
    isLanClientActive,
    loadLanClientConfig,
    saveLanClientConfig,
} from "@/systems/lan/lib/lan-client-config";
import { formatLanPracticeError } from "@medoc/system-practice/adapters/http-practice.adapter";
import { useT, useTParams } from "@/lib/i18n";
import type { Patient, Session, Appointment } from "@/models/types";
import { Button } from "@/views/components/ui/button";
import { Input } from "@/views/components/ui/input";

type ActiveView = "patients" | "appointments" | "profil";

function todayIsoLocal(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function clearStoredSession(): void {
    saveLanClientConfig({
        ...loadLanClientConfig(),
        enabled: false,
        accessToken: "",
    });
}

export function LanClientApp() {
    const t = useT();
    const tp = useTParams();
    const stored = loadLanClientConfig();
    const [baseUrl, setBaseUrl] = useState(stored.baseUrl || "https://127.0.0.1:8787");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<OwnProfileDto | null>(null);
    const [patients, setPatients] = useState<Patient[] | null>(null);
    const [appointments, setAppointments] = useState<Appointment[] | null>(null);
    const [appointmentDate, setAppointmentDate] = useState(todayIsoLocal());
    const [patientFilter, setPatientFilter] = useState("");
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<ActiveView>("patients");
    const [loggedIn, setLoggedIn] = useState(isLanClientActive(stored));
    const [bootstrapping, setBootstrapping] = useState(isLanClientActive(stored));
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const canBrowse = loggedIn && !busy && !bootstrapping;

    const reloadPatients = useCallback(async () => {
        const rows = await listPatients();
        setPatients(rows);
        setActiveView("patients");
        setSelectedPatientId((prev) => (prev && rows.some((p) => p.id === prev) ? prev : null));
    }, []);

    const loadAppointments = useCallback(async () => {
        const rows = await listAppointmentsByDate(appointmentDate);
        setAppointments(rows);
        setActiveView("appointments");
        setSelectedPatientId(null);
    }, [appointmentDate]);

    const loadProfile = useCallback(async () => {
        const dto = await getOwnProfile();
        setProfile(dto);
        setActiveView("profil");
        setSelectedPatientId(null);
    }, []);

    const establishSession = useCallback(async () => {
        const restored = await checkSession();
        if (!restored) {
            clearStoredSession();
            setLoggedIn(false);
            setSession(null);
            setProfile(null);
            setPatients(null);
            setAppointments(null);
            return false;
        }
        setSession(restored);
        setLoggedIn(true);
        await reloadPatients();
        return true;
    }, [reloadPatients]);

    useEffect(() => {
        if (!isLanClientActive()) {
            setBootstrapping(false);
            return;
        }
        let cancelled = false;
        void (async () => {
            setError(null);
            setBootstrapping(true);
            try {
                const ok = await establishSession();
                if (!cancelled && !ok) {
                    setError(t("lan.client.session_expired"));
                }
            } catch (e) {
                if (!cancelled) {
                    clearStoredSession();
                    setLoggedIn(false);
                    setSession(null);
                    setProfile(null);
                    setPatients(null);
                    setAppointments(null);
                    setError(formatLanPracticeError(e, t, tp));
                }
            } finally {
                if (!cancelled) setBootstrapping(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [establishSession]);

    const connect = useCallback(async () => {
        setError(null);
        setBusy(true);
        try {
            saveLanClientConfig({
                ...EMPTY_LAN_CLIENT_CONFIG,
                schemaVersion: 1,
                enabled: true,
                baseUrl: baseUrl.replace(/\/$/, ""),
                accessToken: loadLanClientConfig().accessToken,
            });
            const s = await login(email, password);
            setSession(s);
            setLoggedIn(true);
            await reloadPatients();
        } catch (e) {
            setError(formatLanPracticeError(e, t, tp));
            setPatients(null);
            setAppointments(null);
            setLoggedIn(false);
            setSession(null);
        } finally {
            setBusy(false);
        }
    }, [baseUrl, email, password, reloadPatients]);

    const disconnect = useCallback(async () => {
        setError(null);
        setBusy(true);
        try {
            await logout();
        } catch {
            clearStoredSession();
        } finally {
            setLoggedIn(false);
            setSession(null);
            setProfile(null);
            setPatients(null);
            setAppointments(null);
            setSelectedPatientId(null);
            setBusy(false);
        }
    }, []);

    const filteredPatients = useMemo(() => {
        if (!patients) return null;
        const q = patientFilter.trim().toLowerCase();
        if (!q) return patients;
        return patients.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                p.insurance_number.toLowerCase().includes(q) ||
                (p.email?.toLowerCase().includes(q) ?? false),
        );
    }, [patients, patientFilter]);

    const selectedPatient = useMemo(
        () => patients?.find((p) => p.id === selectedPatientId) ?? null,
        [patients, selectedPatientId],
    );

    const viewLabel = useMemo(() => {
        if (activeView === "patients") return t("lan.client.nav_patients");
        if (activeView === "appointments") return t("lan.client.nav_appointments");
        return t("lan.client.nav_profile");
    }, [activeView, t]);

    if (bootstrapping) {
        return (
            <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-6">
                <header>
                    <h1 className="text-xl font-semibold text-on-surface">{t("lan.client.title")}</h1>
                    <p className="text-sm text-on-surface-variant">{t("lan.client.restoring_session")}</p>
                </header>
            </main>
        );
    }

    return (
        <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-6">
            <header>
                <h1 className="text-xl font-semibold text-on-surface">{t("lan.client.title")}</h1>
                <p className="text-sm text-on-surface-variant">
                    Browser client for a remote practice host over HTTPS — no Tauri runtime.
                </p>
            </header>

            {!loggedIn ? (
                <section className="flex flex-col gap-3 rounded-lg border border-surface-overlay bg-surface-container p-4">
                    <label className="flex flex-col gap-1 text-sm">
                        {t("lan.client.lan_server_url")}
                        <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        {t("lan.client.email")}
                        <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        {t("lan.client.password")}
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                        />
                    </label>
                    <Button type="button" onClick={() => void connect()} disabled={busy}>
                        {busy ? t("lan.client.connecting") : t("lan.client.sign_in")}
                    </Button>
                </section>
            ) : (
                <section className="flex flex-col gap-3 rounded-lg border border-surface-overlay bg-surface-container p-4">
                    <p className="text-sm text-on-surface-variant">
                        {session ? (
                            <>
                                {t("lan.client.logged_in_as")} <span className="text-on-surface">{session.name}</span> (
                                {session.role})
                            </>
                        ) : null}
                    </p>
                    <p className="text-sm text-on-surface-variant">
                        {t("lan.client.server")} <span className="font-mono text-on-surface">{baseUrl}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant={activeView === "patients" ? "primary" : "secondary"}
                            disabled={!canBrowse}
                            onClick={() => void reloadPatients()}
                        >
                            {t("lan.client.nav_patients")}
                        </Button>
                        <Button
                            type="button"
                            variant={activeView === "appointments" ? "primary" : "secondary"}
                            disabled={!canBrowse}
                            onClick={() => void loadAppointments()}
                        >
                            {t("lan.client.nav_appointments")}
                        </Button>
                        <Button
                            type="button"
                            variant={activeView === "profil" ? "primary" : "secondary"}
                            disabled={!canBrowse}
                            onClick={() => void loadProfile()}
                        >
                            {t("lan.client.nav_profile")}
                        </Button>
                        <Button type="button" variant="ghost" disabled={busy} onClick={() => void disconnect()}>
                            {t("lan.client.sign_out")}
                        </Button>
                    </div>
                    {activeView === "appointments" ? (
                        <>
                            <label className="flex flex-col gap-1 text-sm">
                                {t("lan.client.date")}
                                <Input
                                    type="date"
                                    value={appointmentDate}
                                    onChange={(e) => setAppointmentDate(e.target.value)}
                                />
                            </label>
                            <Button type="button" disabled={!canBrowse} onClick={() => void loadAppointments()}>
                                {t("lan.client.load_appointments")}
                            </Button>
                        </>
                    ) : null}
                </section>
            )}

            {error ? <p className="text-sm text-error">{error}</p> : null}

            {activeView === "patients" && filteredPatients ? (
                <section className="rounded-lg border border-surface-overlay bg-surface-container p-4">
                    <h2 className="mb-2 text-sm font-medium">
                        {viewLabel} ({filteredPatients.length}
                        {patients && filteredPatients.length !== patients.length
                            ? ` / ${patients.length}`
                            : ""}
                        )
                    </h2>
                    <Input
                        className="mb-3"
                        placeholder={t("lan.client.search_ph")}
                        value={patientFilter}
                        onChange={(e) => setPatientFilter(e.target.value)}
                    />
                    <ul className="max-h-64 space-y-1 overflow-auto text-sm">
                        {filteredPatients.map((p) => (
                            <li key={p.id}>
                                <button
                                    type="button"
                                    className={[
                                        "w-full rounded px-2 py-1 text-left hover:bg-surface-overlay",
                                        selectedPatientId === p.id ? "bg-surface-overlay" : "",
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                    onClick={() => setSelectedPatientId(p.id)}
                                >
                                    {p.name}{" "}
                                    <span className="text-on-surface-variant">({p.status})</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            {activeView === "patients" && selectedPatient ? (
                <section className="rounded-lg border border-surface-overlay bg-surface-container p-4 text-sm">
                    <h2 className="mb-3 font-medium">{selectedPatient.name}</h2>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                        <dt className="text-on-surface-variant">{t("lan.client.birth_date")}</dt>
                        <dd>{selectedPatient.date_of_birth}</dd>
                        <dt className="text-on-surface-variant">{t("lan.client.gender")}</dt>
                        <dd>{selectedPatient.sex}</dd>
                        <dt className="text-on-surface-variant">{t("lan.client.insurance_no")}</dt>
                        <dd>{selectedPatient.insurance_number}</dd>
                        <dt className="text-on-surface-variant">{t("lan.client.phone")}</dt>
                        <dd>{selectedPatient.phone ?? "—"}</dd>
                        <dt className="text-on-surface-variant">{t("lan.client.email")}</dt>
                        <dd>{selectedPatient.email ?? "—"}</dd>
                        <dt className="text-on-surface-variant">{t("lan.client.address")}</dt>
                        <dd>{selectedPatient.address ?? "—"}</dd>
                        <dt className="text-on-surface-variant">{t("lan.client.status")}</dt>
                        <dd>{selectedPatient.status}</dd>
                    </dl>
                </section>
            ) : null}

            {activeView === "appointments" && appointments ? (
                <section className="rounded-lg border border-surface-overlay bg-surface-container p-4">
                    <h2 className="mb-2 text-sm font-medium">
                        {tp("lan.client.appointments_on_date", { view: viewLabel, date: appointmentDate })} ({appointments.length})
                    </h2>
                    <ul className="max-h-80 space-y-2 overflow-auto text-sm">
                        {appointments.length === 0 ? (
                            <li className="text-on-surface-variant">{t("lan.client.no_appointments")}</li>
                        ) : (
                            appointments.map((appointment) => (
                                <li key={appointment.id} className="rounded border border-surface-overlay px-2 py-1">
                                    <span className="font-medium">{appointment.time}</span> — {appointment.kind}{" "}
                                    <span className="text-on-surface-variant">({appointment.status})</span>
                                    {appointment.notes ? (
                                        <p className="mt-1 text-on-surface-variant">{appointment.notes}</p>
                                    ) : null}
                                </li>
                            ))
                        )}
                    </ul>
                </section>
            ) : null}

            {activeView === "profil" && profile ? (
                <section className="rounded-lg border border-surface-overlay bg-surface-container p-4 text-sm">
                    <h2 className="mb-3 font-medium">{viewLabel}</h2>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                        <dt className="text-on-surface-variant">{t("common.name")}</dt>
                        <dd>{profile.name}</dd>
                        <dt className="text-on-surface-variant">{t("lan.client.email")}</dt>
                        <dd>{profile.email}</dd>
                        <dt className="text-on-surface-variant">{t("lan.client.role")}</dt>
                        <dd>{profile.role}</dd>
                        <dt className="text-on-surface-variant">{t("lan.client.activity_area")}</dt>
                        <dd>{profile.activity_area ?? "—"}</dd>
                        <dt className="text-on-surface-variant">{t("lan.client.specialty")}</dt>
                        <dd>{profile.specialty ?? "—"}</dd>
                        <dt className="text-on-surface-variant">{t("lan.client.phone")}</dt>
                        <dd>{profile.phone ?? "—"}</dd>
                    </dl>
                </section>
            ) : null}
        </main>
    );
}
