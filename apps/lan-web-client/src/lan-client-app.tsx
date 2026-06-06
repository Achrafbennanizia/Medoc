import { useCallback, useEffect, useMemo, useState } from "react";
import { checkSession, login, logout } from "@/systems/practice-host/controllers/auth.controller";
import { listPatienten } from "@/systems/practice-host/controllers/patient.controller";
import { getOwnProfile, type OwnProfileDto } from "@/systems/practice-host/controllers/personal.controller";
import { listTermineByDate } from "@/systems/practice-host/controllers/termin.controller";
import {
    EMPTY_LAN_CLIENT_CONFIG,
    isLanClientActive,
    loadLanClientConfig,
    saveLanClientConfig,
} from "@/systems/lan/lib/lan-client-config";
import type { Patient, Session, Termin } from "@/models/types";
import { Button } from "@/views/components/ui/button";
import { Input } from "@/views/components/ui/input";

type ActiveView = "patienten" | "termine" | "profil";

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
    const stored = loadLanClientConfig();
    const [baseUrl, setBaseUrl] = useState(stored.baseUrl || "https://127.0.0.1:8787");
    const [email, setEmail] = useState("");
    const [passwort, setPasswort] = useState("");
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<OwnProfileDto | null>(null);
    const [patients, setPatients] = useState<Patient[] | null>(null);
    const [termine, setTermine] = useState<Termin[] | null>(null);
    const [terminDatum, setTerminDatum] = useState(todayIsoLocal());
    const [patientFilter, setPatientFilter] = useState("");
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<ActiveView>("patienten");
    const [loggedIn, setLoggedIn] = useState(isLanClientActive(stored));
    const [bootstrapping, setBootstrapping] = useState(isLanClientActive(stored));
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const canBrowse = loggedIn && !busy && !bootstrapping;

    const reloadPatients = useCallback(async () => {
        const rows = await listPatienten();
        setPatients(rows);
        setActiveView("patienten");
        setSelectedPatientId((prev) => (prev && rows.some((p) => p.id === prev) ? prev : null));
    }, []);

    const loadTermine = useCallback(async () => {
        const rows = await listTermineByDate(terminDatum);
        setTermine(rows);
        setActiveView("termine");
        setSelectedPatientId(null);
    }, [terminDatum]);

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
            setTermine(null);
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
                    setError("Gespeicherte Sitzung abgelaufen — bitte erneut anmelden.");
                }
            } catch (e) {
                if (!cancelled) {
                    clearStoredSession();
                    setLoggedIn(false);
                    setSession(null);
                    setProfile(null);
                    setPatients(null);
                    setTermine(null);
                    setError(e instanceof Error ? e.message : String(e));
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
            const s = await login(email, passwort);
            setSession(s);
            setLoggedIn(true);
            await reloadPatients();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            setPatients(null);
            setTermine(null);
            setLoggedIn(false);
            setSession(null);
        } finally {
            setBusy(false);
        }
    }, [baseUrl, email, passwort, reloadPatients]);

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
            setTermine(null);
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
                p.versicherungsnummer.toLowerCase().includes(q) ||
                (p.email?.toLowerCase().includes(q) ?? false),
        );
    }, [patients, patientFilter]);

    const selectedPatient = useMemo(
        () => patients?.find((p) => p.id === selectedPatientId) ?? null,
        [patients, selectedPatientId],
    );

    const viewLabel = useMemo(() => {
        if (activeView === "patienten") return "Patienten";
        if (activeView === "termine") return "Termine";
        return "Profil";
    }, [activeView]);

    if (bootstrapping) {
        return (
            <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-6">
                <header>
                    <h1 className="text-xl font-semibold text-on-surface">MeDoc LAN Web Client</h1>
                    <p className="text-sm text-on-surface-variant">Sitzung wird wiederhergestellt…</p>
                </header>
            </main>
        );
    }

    return (
        <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-6">
            <header>
                <h1 className="text-xl font-semibold text-on-surface">MeDoc LAN Web Client</h1>
                <p className="text-sm text-on-surface-variant">
                    Browser client for a remote practice host over HTTPS — no Tauri runtime.
                </p>
            </header>

            {!loggedIn ? (
                <section className="flex flex-col gap-3 rounded-lg border border-surface-overlay bg-surface-container p-4">
                    <label className="flex flex-col gap-1 text-sm">
                        LAN server URL
                        <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        E-Mail
                        <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        Passwort
                        <Input
                            type="password"
                            value={passwort}
                            onChange={(e) => setPasswort(e.target.value)}
                            autoComplete="current-password"
                        />
                    </label>
                    <Button type="button" onClick={() => void connect()} disabled={busy}>
                        {busy ? "Verbinde…" : "Anmelden"}
                    </Button>
                </section>
            ) : (
                <section className="flex flex-col gap-3 rounded-lg border border-surface-overlay bg-surface-container p-4">
                    <p className="text-sm text-on-surface-variant">
                        {session ? (
                            <>
                                Angemeldet als <span className="text-on-surface">{session.name}</span> (
                                {session.rolle})
                            </>
                        ) : null}
                    </p>
                    <p className="text-sm text-on-surface-variant">
                        Server <span className="font-mono text-on-surface">{baseUrl}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant={activeView === "patienten" ? "primary" : "secondary"}
                            disabled={!canBrowse}
                            onClick={() => void reloadPatients()}
                        >
                            Patienten
                        </Button>
                        <Button
                            type="button"
                            variant={activeView === "termine" ? "primary" : "secondary"}
                            disabled={!canBrowse}
                            onClick={() => void loadTermine()}
                        >
                            Termine
                        </Button>
                        <Button
                            type="button"
                            variant={activeView === "profil" ? "primary" : "secondary"}
                            disabled={!canBrowse}
                            onClick={() => void loadProfile()}
                        >
                            Profil
                        </Button>
                        <Button type="button" variant="ghost" disabled={busy} onClick={() => void disconnect()}>
                            Abmelden
                        </Button>
                    </div>
                    {activeView === "termine" ? (
                        <>
                            <label className="flex flex-col gap-1 text-sm">
                                Datum
                                <Input
                                    type="date"
                                    value={terminDatum}
                                    onChange={(e) => setTerminDatum(e.target.value)}
                                />
                            </label>
                            <Button type="button" disabled={!canBrowse} onClick={() => void loadTermine()}>
                                Termine laden
                            </Button>
                        </>
                    ) : null}
                </section>
            )}

            {error ? <p className="text-sm text-error">{error}</p> : null}

            {activeView === "patienten" && filteredPatients ? (
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
                        placeholder="Suche Name, Versicherungsnr., E-Mail…"
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

            {activeView === "patienten" && selectedPatient ? (
                <section className="rounded-lg border border-surface-overlay bg-surface-container p-4 text-sm">
                    <h2 className="mb-3 font-medium">{selectedPatient.name}</h2>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                        <dt className="text-on-surface-variant">Geburtsdatum</dt>
                        <dd>{selectedPatient.geburtsdatum}</dd>
                        <dt className="text-on-surface-variant">Geschlecht</dt>
                        <dd>{selectedPatient.geschlecht}</dd>
                        <dt className="text-on-surface-variant">Versicherungsnr.</dt>
                        <dd>{selectedPatient.versicherungsnummer}</dd>
                        <dt className="text-on-surface-variant">Telefon</dt>
                        <dd>{selectedPatient.telefon ?? "—"}</dd>
                        <dt className="text-on-surface-variant">E-Mail</dt>
                        <dd>{selectedPatient.email ?? "—"}</dd>
                        <dt className="text-on-surface-variant">Adresse</dt>
                        <dd>{selectedPatient.adresse ?? "—"}</dd>
                        <dt className="text-on-surface-variant">Status</dt>
                        <dd>{selectedPatient.status}</dd>
                    </dl>
                </section>
            ) : null}

            {activeView === "termine" && termine ? (
                <section className="rounded-lg border border-surface-overlay bg-surface-container p-4">
                    <h2 className="mb-2 text-sm font-medium">
                        {viewLabel} am {terminDatum} ({termine.length})
                    </h2>
                    <ul className="max-h-80 space-y-2 overflow-auto text-sm">
                        {termine.length === 0 ? (
                            <li className="text-on-surface-variant">Keine Termine an diesem Tag.</li>
                        ) : (
                            termine.map((t) => (
                                <li key={t.id} className="rounded border border-surface-overlay px-2 py-1">
                                    <span className="font-medium">{t.uhrzeit}</span> — {t.art}{" "}
                                    <span className="text-on-surface-variant">({t.status})</span>
                                    {t.notizen ? (
                                        <p className="mt-1 text-on-surface-variant">{t.notizen}</p>
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
                        <dt className="text-on-surface-variant">Name</dt>
                        <dd>{profile.name}</dd>
                        <dt className="text-on-surface-variant">E-Mail</dt>
                        <dd>{profile.email}</dd>
                        <dt className="text-on-surface-variant">Rolle</dt>
                        <dd>{profile.rolle}</dd>
                        <dt className="text-on-surface-variant">Tätigkeitsbereich</dt>
                        <dd>{profile.taetigkeitsbereich ?? "—"}</dd>
                        <dt className="text-on-surface-variant">Fachrichtung</dt>
                        <dd>{profile.fachrichtung ?? "—"}</dd>
                        <dt className="text-on-surface-variant">Telefon</dt>
                        <dd>{profile.telefon ?? "—"}</dd>
                    </dl>
                </section>
            ) : null}
        </main>
    );
}
