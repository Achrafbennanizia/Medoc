import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { createBackup } from "../../controllers/ops.controller";
import { useAuthStore } from "../../models/store/auth-store";
import { useUiPreferencesStore } from "../../models/store/ui-preferences-store";
import {
    changePassword,
    verifyLicense,
    openSubscriptionPortal,
    type LicenseStatus,
    currentAppVersion,
    checkForUpdates,
    attachPaymentMethod,
    getPerfThresholdMs,
    setPerfThresholdMs,
    systemHealthCheck,
    type HealthCheck,
} from "../../controllers/system.controller";
import { useLocale } from "../../lib/i18n";
import {
    DEFAULT_CLIENT_SETTINGS,
    loadClientSettings,
    mergeClientSettingsPatch,
    saveClientSettings,
    applyAppearanceFromSettings,
    type ClientSettingsV1,
    type DensityId,
    type TermineKalenderAnsicht,
} from "../../lib/client-settings";
import {
    hydratePraxisPraeferenzenFromKv,
    loadPraxisPraeferenzen,
    savePraxisPraeferenzen,
    type PraxisPraeferenzen,
} from "../../lib/praxis-praeferenzen-storage";
import {
    CONFIRMATION_AREA_KEYS,
    CONFIRMATION_AREA_LABELS,
    type ConfirmationAreaKey,
    type ConfirmationPresentMode,
} from "../../lib/confirmation-preferences";
import { getInvoicePraxisFromStorage, saveInvoicePraxisToStorage, type InvoicePraxis } from "../../lib/invoice-leistung";
import { Button } from "../components/ui/button";
import { Input, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { Dialog } from "../components/ui/dialog";

const LazyOpsPage = lazy(() => import("./ops").then((m) => ({ default: m.OpsPage })));
const LazyHilfePage = lazy(() => import("./hilfe").then((m) => ({ default: m.HilfePage })));
const LazyMigrationWizardPage = lazy(() => import("./migration-wizard").then((m) => ({ default: m.MigrationWizardPage })));
const LazyTerminePage = lazy(() => import("./termine").then((m) => ({ default: m.TerminePage })));
const LazyTerminCreatePage = lazy(() => import("./termin-create").then((m) => ({ default: m.TerminCreatePage })));
const LazyPatientenPage = lazy(() => import("./patienten").then((m) => ({ default: m.PatientenPage })));
const LazyFinanzenPage = lazy(() => import("./finanzen").then((m) => ({ default: m.FinanzenPage })));
const LazyBestellungenPage = lazy(() => import("./bestellungen").then((m) => ({ default: m.BestellungenPage })));
const LazyPersonalArbeitsplanPage = lazy(() => import("./personal-arbeitsplan").then((m) => ({ default: m.PersonalArbeitsplanPage })));
const LazyVerwaltungPage = lazy(() => import("./verwaltung").then((m) => ({ default: m.VerwaltungPage })));
const LazyVorlagenPage = lazy(() => import("./vorlagen-rezepte-atteste").then((m) => ({ default: m.VorlagenRezepteAttestePage })));
const LazyStatistikPage = lazy(() => import("./statistik").then((m) => ({ default: m.StatistikPage })));
const LazyPraxisplanungPage = lazy(() => import("./praxisplanung").then((m) => ({ default: m.PraxisplanungPage })));
const LazyArbeitszeitenPage = lazy(() => import("./arbeitszeiten").then((m) => ({ default: m.ArbeitszeitenPage })));
const LazyAuditPage = lazy(() => import("./audit").then((m) => ({ default: m.AuditPage })));
const LazyLoggingPage = lazy(() => import("./logging").then((m) => ({ default: m.LoggingPage })));
const LazyCompliancePage = lazy(() => import("./compliance").then((m) => ({ default: m.CompliancePage })));

function SettingsEmbeddedShell({ children }: { children: ReactNode }) {
    return (
        <div style={{ marginTop: 12, border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
            <div style={{ maxHeight: "min(72vh, 840px)", overflow: "auto", padding: 12 }}>
                {children}
            </div>
        </div>
    );
}

function EmbedSuspenseFallback() {
    return (
        <div className="card-pad" style={{ color: "var(--fg-3)", fontSize: 13 }}>
            Modul wird geladen …
        </div>
    );
}

/**
 * Einstellungen — Praxis-Stammdaten (Rechnung/PDF), Konto, Client-Flags, Lizenz, Darstellung & Bestätigungs-Dialoge.
 */
const ACCENT_KEY = "medoc-accent-preset";

type AccentId = "mint" | "ocean" | "plum";

const ACCENT_LABELS: Record<AccentId, string> = {
    mint: "Mint",
    ocean: "Ocean",
    plum: "Plum",
};

function applyAccentPreset(id: AccentId) {
    const presets: Record<AccentId, { accent: string; soft: string; ink: string }> = {
        mint: { accent: "#0EA07E", soft: "#DCF3EC", ink: "#06604B" },
        ocean: { accent: "#0A84FF", soft: "#E5F1FF", ink: "#0355B7" },
        plum: { accent: "#AF52DE", soft: "#F2E4FB", ink: "#6B2A95" },
    };
    const v = presets[id];
    document.documentElement.style.setProperty("--accent", v.accent);
    document.documentElement.style.setProperty("--accent-soft", v.soft);
    document.documentElement.style.setProperty("--accent-ink", v.ink);
    localStorage.setItem(ACCENT_KEY, id);
}

type AblaufPanelId =
    | null
    | "ops"
    | "migration"
    | "termine"
    | "termin-neu"
    | "patienten"
    | "finanzen"
    | "bestellungen"
    | "arbeitsplan"
    | "verwaltung"
    | "vorlagen"
    | "statistik";

type TermineWorkbenchId = null | "kalender" | "neu" | "planung" | "arbeitszeiten";

type SecurityWorkbenchId = null | "audit" | "logs" | "compliance";

const ABL_MODULE_CHIPS: Array<{ id: Exclude<AblaufPanelId, null>; label: string }> = [
    { id: "patienten", label: "Patienten" },
    { id: "termine", label: "Termine" },
    { id: "termin-neu", label: "Neuer Termin" },
    { id: "finanzen", label: "Finanzen" },
    { id: "bestellungen", label: "Bestellungen" },
    { id: "arbeitsplan", label: "Arbeitsplan" },
    { id: "verwaltung", label: "Verwaltung" },
    { id: "vorlagen", label: "Vorlagen" },
    { id: "statistik", label: "Statistik" },
    { id: "ops", label: "Betrieb / Ops" },
    { id: "migration", label: "Migration" },
];

type SettingsSection =
    | "praxis"
    | "konto"
    | "benachrichtigung"
    | "termine"
    | "sicherheit"
    | "lizenz"
    | "integrationen"
    | "migration"
    | "ablauf"
    | "darstellung"
    | "hilfe";

export function EinstellungenPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const session = useAuthStore((s) => s.session);
    const locale = useLocale((s) => s.locale);
    const setLocale = useLocale((s) => s.setLocale);
    const toast = useToastStore((s) => s.add);

    const hydrateConfirmations = useUiPreferencesStore((s) => s.hydrate);
    const confirmations = useUiPreferencesStore((s) => s.confirmations);
    const hydratedUi = useUiPreferencesStore((s) => s.hydrated);
    const setDefaultConfirmationMode = useUiPreferencesStore((s) => s.setDefaultConfirmationMode);
    const setAreaConfirmationOverride = useUiPreferencesStore((s) => s.setAreaConfirmationOverride);

    const [activeSection, setActiveSection] = useState<SettingsSection>("praxis");

    useEffect(() => {
        if (searchParams.get("tab") === "hilfe") {
            setActiveSection("hilfe");
        }
    }, [searchParams]);
    const [client, setClient] = useState<ClientSettingsV1>(() => loadClientSettings());

    const [praxis, setPraxis] = useState<InvoicePraxis>(() => getInvoicePraxisFromStorage());
    const [praxisDirty, setPraxisDirty] = useState(false);

    const [praef, setPraef] = useState<PraxisPraeferenzen>(() => loadPraxisPraeferenzen());
    const [praefDirty, setPraefDirty] = useState(false);

    const [oldPw, setOldPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [pwBusy, setPwBusy] = useState(false);
    const [pwDialogOpen, setPwDialogOpen] = useState(false);

    const [licenseToken, setLicenseToken] = useState("");
    const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
    const [licBusy, setLicBusy] = useState(false);
    const [appVersion, setAppVersion] = useState<string>("…");
    const [updateBusy, setUpdateBusy] = useState(false);
    const [paymentToken, setPaymentToken] = useState("");
    const [paymentBusy, setPaymentBusy] = useState(false);

    const [accentDialogOpen, setAccentDialogOpen] = useState(false);
    const [accentLabel, setAccentLabel] = useState("Mint");

    const [backupBusy, setBackupBusy] = useState(false);
    const [healthBusy, setHealthBusy] = useState(false);
    const [healthLast, setHealthLast] = useState<HealthCheck | null>(null);

    const [perfMs, setPerfMs] = useState<string>("");
    const [perfBusy, setPerfBusy] = useState(false);

    const [ablaufPanel, setAblaufPanel] = useState<AblaufPanelId>(null);
    const [termineWorkbench, setTermineWorkbench] = useState<TermineWorkbenchId>(null);
    const [securityWorkbench, setSecurityWorkbench] = useState<SecurityWorkbenchId>(null);

    useEffect(() => {
        let cancelled = false;
        void hydratePraxisPraeferenzenFromKv().then((v) => {
            if (!cancelled) {
                setPraef(v);
                setPraefDirty(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const persistClientSilent = (updater: (c: ClientSettingsV1) => ClientSettingsV1) => {
        setClient((c) => {
            const next = updater(c);
            saveClientSettings(next);
            applyAppearanceFromSettings(next);
            return next;
        });
    };

    useEffect(() => {
        void hydrateConfirmations();
    }, [hydrateConfirmations]);

    useEffect(() => {
        let cancelled = false;
        currentAppVersion()
            .then((v) => { if (!cancelled) setAppVersion(v); })
            .catch(() => { if (!cancelled) setAppVersion("?"); });
        getPerfThresholdMs()
            .then((ms) => { if (!cancelled) setPerfMs(String(ms)); })
            .catch(() => { if (!cancelled) setPerfMs(""); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const saved = localStorage.getItem(ACCENT_KEY) as AccentId | null;
        if (saved === "ocean" || saved === "plum" || saved === "mint") {
            applyAccentPreset(saved);
            setAccentLabel(ACCENT_LABELS[saved]);
        }
    }, []);

    async function handleChangePassword() {
        if (newPw.length < 8) {
            toast("Passwort muss mindestens 8 Zeichen lang sein");
            return;
        }
        if (newPw !== confirmPw) {
            toast("Passwörter stimmen nicht überein");
            return;
        }
        setPwBusy(true);
        try {
            await changePassword(oldPw, newPw);
            toast("Passwort geändert");
            setOldPw("");
            setNewPw("");
            setConfirmPw("");
            setPwDialogOpen(false);
        } catch (e) {
            toast(`Fehler: ${(e as Error).message ?? e}`);
        } finally {
            setPwBusy(false);
        }
    }

    async function handleVerifyLicense() {
        if (!licenseToken.trim()) return;
        setLicBusy(true);
        try {
            const st = await verifyLicense(licenseToken.trim());
            setLicenseStatus(st);
            toast(st.valid ? "Lizenz gültig" : `Ungültig: ${st.reason ?? "—"}`, st.valid ? "success" : "info");
        } catch (e) {
            toast(`Fehler: ${(e as Error).message ?? e}`);
        } finally {
            setLicBusy(false);
        }
    }

    async function handleCheckUpdates() {
        setUpdateBusy(true);
        try {
            const info = await checkForUpdates();
            toast(
                info.update_available
                    ? `Update verfügbar: ${info.latest_version}`
                    : `Aktuell auf neuester Version (${info.current_version})`,
                info.update_available ? "info" : "success",
            );
        } catch (e) {
            toast(`Update-Prüfung fehlgeschlagen: ${(e as Error).message ?? e}`);
        } finally {
            setUpdateBusy(false);
        }
    }

    async function handleAttachPayment() {
        const token = paymentToken.trim();
        if (!token) return;
        setPaymentBusy(true);
        try {
            await attachPaymentMethod({ provider_token: token });
            toast("Zahlungsmethode hinterlegt", "success");
            setPaymentToken("");
        } catch (e) {
            toast(`Zahlungsmethode konnte nicht hinterlegt werden: ${(e as Error).message ?? e}`);
        } finally {
            setPaymentBusy(false);
        }
    }

    async function runHealthCheck() {
        setHealthBusy(true);
        try {
            const h = await systemHealthCheck();
            setHealthLast(h);
            toast(
                h.db_ok && h.audit_chain_ok ? "System-Check: OK" : "System-Check: siehe Kurzinfo",
                h.db_ok && h.audit_chain_ok ? "success" : "info",
            );
        } catch (e) {
            toast(`Health-Check fehlgeschlagen: ${(e as Error).message ?? e}`, "error");
        } finally {
            setHealthBusy(false);
        }
    }

    async function savePerfThreshold() {
        const n = Number.parseInt(perfMs, 10);
        if (!Number.isFinite(n) || n < 50 || n > 60_000) {
            toast("Performance-Schwelle: Zahl zwischen 50 und 60000 ms", "error");
            return;
        }
        setPerfBusy(true);
        try {
            await setPerfThresholdMs(n);
            toast("Performance-Schwelle gespeichert", "success");
        } catch (e) {
            toast(`Fehler: ${(e as Error).message ?? e}`);
        } finally {
            setPerfBusy(false);
        }
    }

    const savePraxis = () => {
        saveInvoicePraxisToStorage(praxis);
        setPraxisDirty(false);
        toast("Praxis-Stammdaten gespeichert", "success");
    };

    const savePraef = async () => {
        try {
            await savePraxisPraeferenzen(praef);
            setPraefDirty(false);
            toast("Termin-Präferenzen gespeichert (Praxis-weit in der Datenbank)", "success");
        } catch (e) {
            toast(`Speichern fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const roleLabel = useMemo(() => session?.rolle ?? "—", [session?.rolle]);

    const menuItems: Array<{ id: SettingsSection; label: string }> = [
        { id: "praxis", label: "Praxis" },
        { id: "konto", label: "Konto" },
        { id: "benachrichtigung", label: "Benachrichtigungen" },
        { id: "termine", label: "Termine & Kalender" },
        { id: "sicherheit", label: "Sicherheit" },
        { id: "lizenz", label: "Lizenz & Abo" },
        { id: "integrationen", label: "Integrationen" },
        { id: "migration", label: "Migration" },
        { id: "ablauf", label: "Module & Abläufe" },
        { id: "darstellung", label: "Darstellung" },
        { id: "hilfe", label: "Hilfe & Kurzbefehle" },
    ];

    const notif = client.notifications ?? DEFAULT_CLIENT_SETTINGS.notifications!;
    const sec = client.security ?? DEFAULT_CLIENT_SETTINGS.security!;
    const integ = client.integrations ?? DEFAULT_CLIENT_SETTINGS.integrations!;
    const appearance = client.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
    const wf = client.workflows ?? DEFAULT_CLIENT_SETTINGS.workflows!;
    const akteClient = client.akte ?? DEFAULT_CLIENT_SETTINGS.akte!;

    function renderAblaufEmbed(id: Exclude<AblaufPanelId, null>) {
        switch (id) {
            case "ops":
                return <LazyOpsPage embedded onOpenMigration={() => setAblaufPanel("migration")} />;
            case "migration":
                return <LazyMigrationWizardPage embedded onEmbeddedExit={() => setAblaufPanel(null)} />;
            case "termine":
                return <LazyTerminePage />;
            case "termin-neu":
                return <LazyTerminCreatePage />;
            case "patienten":
                return <LazyPatientenPage />;
            case "finanzen":
                return <LazyFinanzenPage />;
            case "bestellungen":
                return <LazyBestellungenPage />;
            case "arbeitsplan":
                return <LazyPersonalArbeitsplanPage />;
            case "verwaltung":
                return <LazyVerwaltungPage />;
            case "vorlagen":
                return <LazyVorlagenPage />;
            case "statistik":
                return <LazyStatistikPage />;
            default:
                return null;
        }
    }

    function renderTermineWorkbench(id: Exclude<TermineWorkbenchId, null>) {
        switch (id) {
            case "kalender":
                return <LazyTerminePage />;
            case "neu":
                return <LazyTerminCreatePage />;
            case "planung":
                return <LazyPraxisplanungPage />;
            case "arbeitszeiten":
                return <LazyArbeitszeitenPage />;
            default:
                return null;
        }
    }

    function renderSecurityWorkbench(id: Exclude<SecurityWorkbenchId, null>) {
        switch (id) {
            case "audit":
                return <LazyAuditPage />;
            case "logs":
                return <LazyLoggingPage />;
            case "compliance":
                return <LazyCompliancePage embedded />;
            default:
                return null;
        }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in--sticky-safe">
            <h2 className="page-title">Einstellungen</h2>
            <p className="page-sub">Praxis · Termine · Module · Konto · Sicherheit · Lizenz · Darstellung · Hilfe</p>

            <div className="split settings-shell" style={{ gridTemplateColumns: "minmax(200px, 240px) 1fr", alignItems: "start" }}>
                <div className="card card-pad settings-nav">
                    <div className="col">
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className={`sb-item settings-nav-item ${activeSection === item.id ? "active" : ""}`}
                                onClick={() => {
                                    const id = item.id;
                                    setActiveSection(id);
                                    setSearchParams(
                                        (prev) => {
                                            const n = new URLSearchParams(prev);
                                            if (id === "hilfe") n.set("tab", "hilfe");
                                            else n.delete("tab");
                                            return n;
                                        },
                                        { replace: true },
                                    );
                                }}
                            >
                                <span className="settings-nav-dot" aria-hidden />
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="card settings-panel" style={{ overflow: "hidden" }}>
                    {activeSection === "praxis" ? (
                        <section>
                            <div className="card-head">
                                <div>
                                    <div className="card-title">Praxis</div>
                                    <div className="card-sub">Stammdaten für Rechnungen, PDF-Export und interne Anzeige</div>
                                </div>
                            </div>
                            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                <Input id="praxis-name" label="Praxisname" value={praxis.name} onChange={(e) => { setPraxis((p) => ({ ...p, name: e.target.value })); setPraxisDirty(true); }} />
                                <PraxisAddressArea label="Adresse (Zeilen wie auf Briefpapier)" value={praxis.addr} onChange={(v) => { setPraxis((p) => ({ ...p, addr: v })); setPraxisDirty(true); }} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Input id="praxis-kv" label="KV- / Betriebsnummer" value={praxis.kv_nummer ?? ""} onChange={(e) => { setPraxis((p) => ({ ...p, kv_nummer: e.target.value })); setPraxisDirty(true); }} />
                                    <Input id="praxis-oe" label="Öffnungszeiten (Kurztext)" value={praxis.oeffnungszeiten ?? ""} onChange={(e) => { setPraxis((p) => ({ ...p, oeffnungszeiten: e.target.value })); setPraxisDirty(true); }} />
                                </div>
                                <p className="card-sub" style={{ margin: 0 }}>
                                    PDF-Rechnungen und Finanzberichte nutzen diese Stammdaten; Erstellung erfolgt über den eingebetteten Bereich Module → Finanzen (kein Seitenwechsel nötig).
                                </p>
                                <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                                    <Button type="button" onClick={savePraxis} disabled={!praxisDirty}>Speichern</Button>
                                </div>
                            </div>
                        </section>
                    ) : null}

                    {activeSection === "konto" ? (
                        <section>
                            <div className="card-head">
                                <div>
                                    <div className="card-title">Mein Konto</div>
                                    <div className="card-sub">{session?.name} · {session?.email}</div>
                                </div>
                            </div>
                            <div className="settings-row"><div><b>Name</b><div className="card-sub">{session?.name}</div></div></div>
                            <div className="settings-row"><div><b>E-Mail</b><div className="card-sub">{session?.email}</div></div></div>
                            <div className="settings-row">
                                <div><b>Rolle</b><div className="card-sub">{roleLabel}</div></div>
                                <span className="pill blue">{session?.rolle ?? "—"}</span>
                            </div>
                            <div className="settings-row">
                                <div><b>Passwort</b><div className="card-sub">Anmeldepasswort ändern</div></div>
                                <Button variant="secondary" type="button" onClick={() => setPwDialogOpen(true)}>Ändern</Button>
                            </div>
                            <div className="settings-row">
                                <div><b>Sprache</b><div className="card-sub">Oberfläche</div></div>
                                <div className="row" style={{ gap: 8 }}>
                                    <Button type="button" className={locale === "de" ? "btn-accent" : "btn-subtle"} onClick={() => setLocale("de")}>DE</Button>
                                    <Button type="button" className={locale === "en" ? "btn-accent" : "btn-subtle"} onClick={() => setLocale("en")}>EN</Button>
                                </div>
                            </div>
                        </section>
                    ) : null}

                    {activeSection === "benachrichtigung" ? (
                        <section>
                            <div className="card-head"><div><div className="card-title">Benachrichtigungen</div><div className="card-sub">Lokal gespeichert — Anbindung an E-Mail/Push folgt</div></div></div>
                            <div className="settings-row">
                                <div><b>Push-Benachrichtigungen</b><div className="card-sub">Freigaben, Termine, Bestellungen</div></div>
                                <input type="checkbox" checked={notif.push} onChange={() => persistClientSilent((c) => {
                                    const n = c.notifications ?? DEFAULT_CLIENT_SETTINGS.notifications!;
                                    return mergeClientSettingsPatch(c, { notifications: { ...n, push: !n.push } });
                                })} aria-label="Push" />
                            </div>
                            <div className="settings-row">
                                <div><b>E-Mail-Zusammenfassung</b><div className="card-sub">Tagesüberblick</div></div>
                                <input type="checkbox" checked={notif.mailDigest} onChange={() => persistClientSilent((c) => {
                                    const n = c.notifications ?? DEFAULT_CLIENT_SETTINGS.notifications!;
                                    return mergeClientSettingsPatch(c, { notifications: { ...n, mailDigest: !n.mailDigest } });
                                })} aria-label="E-Mail-Zusammenfassung" />
                            </div>
                            <div className="settings-row">
                                <div><b>Kritische Warnungen</b><div className="card-sub">Lager, Genehmigungen</div></div>
                                <input type="checkbox" checked={notif.criticalAlerts} onChange={() => persistClientSilent((c) => {
                                    const n = c.notifications ?? DEFAULT_CLIENT_SETTINGS.notifications!;
                                    return mergeClientSettingsPatch(c, { notifications: { ...n, criticalAlerts: !n.criticalAlerts } });
                                })} aria-label="Kritische Warnungen" />
                            </div>
                            <div className="settings-row">
                                <div><b>Patienten-SMS (Erinnerungen)</b><div className="card-sub">Benötigt SMS-Anbieter</div></div>
                                <input type="checkbox" checked={notif.smsReminders} onChange={() => persistClientSilent((c) => {
                                    const n = c.notifications ?? DEFAULT_CLIENT_SETTINGS.notifications!;
                                    return mergeClientSettingsPatch(c, { notifications: { ...n, smsReminders: !n.smsReminders } });
                                })} aria-label="SMS" />
                            </div>
                        </section>
                    ) : null}

                    {activeSection === "termine" ? (
                        <section>
                            <div className="card-head">
                                <div>
                                    <div className="card-title">Termine &amp; Kalender</div>
                                    <div className="card-sub">Regeln für Planung · Standardansicht der Terminübersicht</div>
                                </div>
                            </div>
                            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                <h3 className="text-title" style={{ margin: 0, fontSize: 15 }}>Terminregeln (Praxis-Präferenzen)</h3>
                                <p className="card-sub" style={{ margin: 0 }}>Speicher identisch zur Verwaltungs-Ansicht — hier zentral bearbeitbar.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Input id="set-puffer" type="number" min={0} label="Puffer zwischen Terminen (Min)" value={praef.pufferMin} onChange={(e) => { setPraef((p) => ({ ...p, pufferMin: e.target.value })); setPraefDirty(true); }} />
                                    <Input id="set-notfall" type="number" min={0} label="Notfall-Restzeit (Min)" value={praef.notfallPuffer} onChange={(e) => { setPraef((p) => ({ ...p, notfallPuffer: e.target.value })); setPraefDirty(true); }} />
                                    <Select
                                        label="Reminder vor Termin"
                                        value={praef.reminder}
                                        options={[
                                            { value: "0", label: "Kein Reminder" },
                                            { value: "2", label: "2 Stunden vorher" },
                                            { value: "24", label: "24 Stunden vorher" },
                                            { value: "48", label: "48 Stunden vorher" },
                                        ]}
                                        onChange={(e) => { setPraef((p) => ({ ...p, reminder: e.target.value })); setPraefDirty(true); }}
                                    />
                                    <Select
                                        label="No-Show Behandlung"
                                        value={praef.noShow}
                                        options={[
                                            { value: "warn", label: "Nur markieren" },
                                            { value: "fee", label: "Ausfallhinweis in Finanzen" },
                                            { value: "block", label: "Patient intern kennzeichnen" },
                                        ]}
                                        onChange={(e) => { setPraef((p) => ({ ...p, noShow: e.target.value })); setPraefDirty(true); }}
                                    />
                                </div>
                                <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                                    <Button type="button" onClick={savePraef} disabled={!praefDirty}>Speichern</Button>
                                </div>
                                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                                    <Select
                                        label="Standard beim Öffnen von „Termine“"
                                        value={wf.termineDefaultView ?? "monat"}
                                        onChange={(e) => persistClientSilent((c) => {
                                            const w = c.workflows ?? DEFAULT_CLIENT_SETTINGS.workflows!;
                                            return mergeClientSettingsPatch(c, { workflows: { ...w, termineDefaultView: e.target.value as TermineKalenderAnsicht } });
                                        })}
                                        options={[
                                            { value: "tag", label: "Tagesansicht" },
                                            { value: "woche", label: "Wochenansicht" },
                                            { value: "monat", label: "Monatsansicht" },
                                        ]}
                                    />
                                    <p className="card-sub" style={{ margin: "8px 0 0" }}>Wird beim Seitenbesuch gesetzt; Änderungen in der Terminübersicht werden als neuer Standard gespeichert.</p>
                                </div>
                                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                                    <div className="card-head" style={{ paddingTop: 0 }}><div><div className="card-title">Planung &amp; Kalender (eingebettet)</div><div className="card-sub">Kalender, Neuer Termin, Praxisplanung und Arbeitszeiten — dieselben Module wie in der App, ohne Route zu wechseln.</div></div></div>
                                    <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                                        <Button type="button" variant={termineWorkbench === "kalender" ? undefined : "ghost"} onClick={() => setTermineWorkbench((w) => (w === "kalender" ? null : "kalender"))}>Kalender</Button>
                                        <Button type="button" variant={termineWorkbench === "neu" ? undefined : "ghost"} onClick={() => setTermineWorkbench((w) => (w === "neu" ? null : "neu"))}>Neuer Termin</Button>
                                        <Button type="button" variant={termineWorkbench === "planung" ? undefined : "ghost"} onClick={() => setTermineWorkbench((w) => (w === "planung" ? null : "planung"))}>Praxisplanung</Button>
                                        <Button type="button" variant={termineWorkbench === "arbeitszeiten" ? undefined : "ghost"} onClick={() => setTermineWorkbench((w) => (w === "arbeitszeiten" ? null : "arbeitszeiten"))}>Arbeitszeiten</Button>
                                    </div>
                                    {termineWorkbench ? (
                                        <Suspense fallback={<EmbedSuspenseFallback />}>
                                            <SettingsEmbeddedShell>{renderTermineWorkbench(termineWorkbench)}</SettingsEmbeddedShell>
                                        </Suspense>
                                    ) : null}
                                </div>
                            </div>
                        </section>
                    ) : null}

                    {activeSection === "sicherheit" ? (
                        <section>
                            <div className="card-head">
                                <div>
                                    <div className="card-title">Sicherheit &amp; Compliance</div>
                                    <div className="card-sub">Hinweise · Session und 2FA serverseitig</div>
                                </div>
                            </div>
                            <div className="settings-row">
                                <div><b>Zwei-Faktor-Authentifizierung</b><div className="card-sub">Lokale Erinnerungs-Option</div></div>
                                <input type="checkbox" checked={sec.remindTwoFactor} onChange={() => persistClientSilent((c) => {
                                    const s = c.security ?? DEFAULT_CLIENT_SETTINGS.security!;
                                    return mergeClientSettingsPatch(c, { security: { ...s, remindTwoFactor: !s.remindTwoFactor } });
                                })} aria-label="2FA" />
                            </div>
                            <div className="settings-row">
                                <div><b>Inaktivität</b><div className="card-sub">Arbeitsplatz sperren — Erinnerung</div></div>
                                <input type="checkbox" checked={sec.remindAutoLock} onChange={() => persistClientSilent((c) => {
                                    const s = c.security ?? DEFAULT_CLIENT_SETTINGS.security!;
                                    return mergeClientSettingsPatch(c, { security: { ...s, remindAutoLock: !s.remindAutoLock } });
                                })} aria-label="Auto-Sperre" />
                            </div>
                            <div className="settings-row">
                                <div><b>Audit &amp; Protokolle</b><div className="card-sub">Prüfpfad und technische Logs (eingebettet)</div></div>
                                <div className="row" style={{ gap: 8 }}>
                                    <Button type="button" variant={securityWorkbench === "audit" ? "secondary" : "ghost"} onClick={() => setSecurityWorkbench((w) => (w === "audit" ? null : "audit"))}>Audit</Button>
                                    <Button type="button" variant={securityWorkbench === "logs" ? "secondary" : "ghost"} onClick={() => setSecurityWorkbench((w) => (w === "logs" ? null : "logs"))}>Logs</Button>
                                    <Button type="button" variant={securityWorkbench === "compliance" ? "secondary" : "ghost"} onClick={() => setSecurityWorkbench((w) => (w === "compliance" ? null : "compliance"))}>Compliance</Button>
                                </div>
                            </div>
                            {securityWorkbench ? (
                                <Suspense fallback={<EmbedSuspenseFallback />}>
                                    <SettingsEmbeddedShell>{renderSecurityWorkbench(securityWorkbench)}</SettingsEmbeddedShell>
                                </Suspense>
                            ) : null}
                            <div className="card-head" style={{ marginTop: 12 }}><div><div className="card-title">Systemstatus</div></div></div>
                            <div className="settings-row">
                                <div>
                                    <b>Health-Check</b>
                                    <div className="card-sub">
                                        {healthLast
                                            ? `DB ${healthLast.db_ok ? "OK" : "Fehler"} (${healthLast.db_latency_ms} ms) · Audit ${healthLast.audit_chain_ok ? "OK" : "Bruch"} · v${healthLast.version}`
                                            : "Datenbank, Audit-Kette, Logverzeichnis"}
                                    </div>
                                </div>
                                <Button type="button" variant="secondary" loading={healthBusy} disabled={healthBusy} onClick={() => void runHealthCheck()}>Prüfen</Button>
                            </div>
                            <div className="settings-row" style={{ alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                                <div style={{ flex: "1 1 200px" }}>
                                    <Input id="perf-ms" label="Performance-Schwelle (ms)" value={perfMs} onChange={(e) => setPerfMs(e.target.value)} />
                                    <span className="card-sub">Langsame Tauri-Aufrufe über dieser Zeit werden protokolliert</span>
                                </div>
                                <Button type="button" onClick={() => void savePerfThreshold()} loading={perfBusy} disabled={perfBusy}>Speichern</Button>
                            </div>
                        </section>
                    ) : null}

                    {activeSection === "lizenz" ? (
                        <section>
                            <div className="settings-highlight-card" style={{ margin: 18, border: "1px solid #6ea9d8", borderRadius: 16, padding: 16, background: "#f7fbff" }}>
                                <div className="row settings-highlight-head" style={{ justifyContent: "space-between" }}>
                                    <span className="pill blue">Lizenz</span>
                                    <span style={{ color: "var(--fg-3)", fontSize: 12 }}>Token prüfen</span>
                                </div>
                                <p className="card-sub" style={{ margin: "8px 0 0" }}>Geben Sie einen Lizenz-Token ein, um Gültigkeit und Konditionen abzufragen.</p>
                                <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                                    <Button variant="ghost" type="button" onClick={() => void handleVerifyLicense()} disabled={licBusy || !licenseToken.trim()} loading={licBusy}>Jetzt prüfen</Button>
                                    <Button type="button" onClick={async () => { const p = await openSubscriptionPortal(); window.open(p.url, "_blank", "noopener,noreferrer"); }}>Abo-Portal öffnen</Button>
                                </div>
                            </div>
                            <div className="card-pad">
                                <Input id="lic-token-inline" label="Lizenz-Token" value={licenseToken} onChange={(e) => setLicenseToken(e.target.value)} placeholder="Token einfügen" />
                                {licenseStatus ? (
                                    <p style={{ color: licenseStatus.valid ? "var(--accent)" : "var(--red)", margin: "8px 0 0", fontSize: 13 }}>
                                        {licenseStatus.valid ? "Lizenz gültig" : `Ungültig: ${licenseStatus.reason ?? "Fehler"}`}
                                    </p>
                                ) : null}
                            </div>
                            <div className="card-head" style={{ marginTop: 8 }}><div><div className="card-title">Über &amp; Updates</div><div className="card-sub">Installierte Version</div></div></div>
                            <div className="settings-row"><div><b>App-Version</b><div className="card-sub">MeDoc {appVersion}</div></div><Button variant="ghost" type="button" onClick={() => void handleCheckUpdates()} disabled={updateBusy} loading={updateBusy}>Nach Updates suchen</Button></div>
                            <div className="card-head" style={{ marginTop: 16 }}><div><div className="card-title">Zahlungsmethode</div><div className="card-sub">Provider-Token (PCI-sicher)</div></div></div>
                            <div className="settings-row" style={{ alignItems: "flex-end", gap: 12 }}>
                                <div style={{ flex: 1 }}><Input id="pay-token" label="Provider-Token" placeholder="pm_… oder tok_…" value={paymentToken} onChange={(e) => setPaymentToken(e.target.value)} /></div>
                                <Button type="button" onClick={() => void handleAttachPayment()} disabled={paymentBusy || !paymentToken.trim()} loading={paymentBusy}>Hinterlegen</Button>
                            </div>
                        </section>
                    ) : null}

                    {activeSection === "integrationen" ? (
                        <section>
                            <div className="card-head"><div><div className="card-title">Integrationen</div><div className="card-sub">Lokale Kennzeichnung — Detailkonfiguration in den jeweiligen Modulen</div></div></div>
                            <div className="settings-row">
                                <div><b>DATEV-Export</b><div className="card-sub">Export-Pipeline</div></div>
                                <input type="checkbox" checked={integ.datevMonthlyExport} onChange={() => persistClientSilent((c) => {
                                    const x = c.integrations ?? DEFAULT_CLIENT_SETTINGS.integrations!;
                                    return mergeClientSettingsPatch(c, { integrations: { ...x, datevMonthlyExport: !x.datevMonthlyExport } });
                                })} aria-label="DATEV" />
                            </div>
                            <div className="settings-row">
                                <div><b>DocCheck SSO</b><div className="card-sub">Geplant</div></div>
                                <input type="checkbox" checked={integ.doccheckSso} onChange={() => persistClientSilent((c) => {
                                    const x = c.integrations ?? DEFAULT_CLIENT_SETTINGS.integrations!;
                                    return mergeClientSettingsPatch(c, { integrations: { ...x, doccheckSso: !x.doccheckSso } });
                                })} aria-label="DocCheck" />
                            </div>
                            <div className="settings-row">
                                <div><b>TK / KIM</b><div className="card-sub">Abrechnungs-Kennzeichnung</div></div>
                                <input type="checkbox" checked={integ.tkKim} onChange={() => persistClientSilent((c) => {
                                    const x = c.integrations ?? DEFAULT_CLIENT_SETTINGS.integrations!;
                                    return mergeClientSettingsPatch(c, { integrations: { ...x, tkKim: !x.tkKim } });
                                })} aria-label="TK" />
                            </div>
                            <div className="settings-row">
                                <div><b>Labor (Dental Union)</b><div className="card-sub">Beta</div></div>
                                <input type="checkbox" checked={integ.laborDentalUnion} onChange={() => persistClientSilent((c) => {
                                    const x = c.integrations ?? DEFAULT_CLIENT_SETTINGS.integrations!;
                                    return mergeClientSettingsPatch(c, { integrations: { ...x, laborDentalUnion: !x.laborDentalUnion } });
                                })} aria-label="Labor" />
                            </div>
                        </section>
                    ) : null}

                    {activeSection === "migration" ? (
                        <section>
                            <div className="settings-highlight-card" style={{ margin: 18, border: "1px solid #6ea9d8", borderRadius: 16, padding: 16, background: "#f7fbff" }}>
                                <div className="row settings-highlight-head" style={{ justifyContent: "space-between" }}>
                                    <div>
                                        <b>Migration aus Alt-System</b>
                                        <div className="card-sub">Datenübernahme-Assistent — unten eingebettet, ohne die Einstellungen zu verlassen</div>
                                    </div>
                                    <span className="pill blue">Assistent</span>
                                </div>
                            </div>
                            <Suspense fallback={<EmbedSuspenseFallback />}>
                                <SettingsEmbeddedShell>
                                    <LazyMigrationWizardPage embedded onEmbeddedExit={() => undefined} />
                                </SettingsEmbeddedShell>
                            </Suspense>
                            <div className="card-head"><div><div className="card-title">Backups</div><div className="card-sub">Erstellung über Ops-Backend</div></div></div>
                            <div className="settings-row">
                                <div><b>Backup jetzt</b><div className="card-sub">In konfiguriertes Ziel</div></div>
                                <Button type="button" loading={backupBusy} disabled={backupBusy} onClick={async () => {
                                    setBackupBusy(true);
                                    try {
                                        await createBackup();
                                        toast("Backup wurde erstellt.", "success");
                                    } catch (e) {
                                        toast(`Backup fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
                                    } finally {
                                        setBackupBusy(false);
                                    }
                                }}
                                >Jetzt sichern</Button>
                            </div>
                        </section>
                    ) : null}

                    {activeSection === "ablauf" ? (
                        <section>
                            <div className="card-head">
                                <div>
                                    <div className="card-title">Module &amp; Arbeitsabläufe</div>
                                    <div className="card-sub">Arbeitsbereiche hier öffnen — eingebettet, ohne andere Route zu laden.</div>
                                </div>
                            </div>
                            <div className="card-pad">
                                <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                                    {ABL_MODULE_CHIPS.map((c) => (
                                        <Button
                                            key={c.id}
                                            type="button"
                                            variant={ablaufPanel === c.id ? undefined : "ghost"}
                                            onClick={() => setAblaufPanel((p) => (p === c.id ? null : c.id))}
                                        >
                                            {c.label}
                                        </Button>
                                    ))}
                                </div>
                                {ablaufPanel ? (
                                    <Suspense fallback={<EmbedSuspenseFallback />}>
                                        <SettingsEmbeddedShell>{renderAblaufEmbed(ablaufPanel)}</SettingsEmbeddedShell>
                                    </Suspense>
                                ) : (
                                    <p className="card-sub" style={{ margin: "14px 0 0" }}>Modul auswählen — Inhalt erscheint darunter.</p>
                                )}
                            </div>
                        </section>
                    ) : null}

                    {activeSection === "darstellung" ? (
                        <section>
                            <div className="card-head"><div><div className="card-title">Darstellung</div><div className="card-sub">Sidebar, Dichte, Akzent</div></div></div>
                            <div className="settings-row">
                                <div><b>Sidebar dunkel</b><div className="card-sub">Nur Navigation; Inhalt bleibt hell</div></div>
                                <input type="checkbox" checked={appearance.darkSidebar} onChange={() => persistClientSilent((c) => {
                                    const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                    return mergeClientSettingsPatch(c, { appearance: { ...a, darkSidebar: !a.darkSidebar } });
                                })} aria-label="Dark sidebar" />
                            </div>
                            <div className="settings-row" style={{ alignItems: "flex-start" }}>
                                <div style={{ flex: 1, paddingTop: 4 }}><b>Raster-Dichte</b><div className="card-sub">Schrift und Abstände global</div></div>
                                <div style={{ minWidth: 200 }}>
                                    <Select
                                        label="Dichte"
                                        value={appearance.density}
                                        onChange={(e) => persistClientSilent((c) => {
                                            const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                            return mergeClientSettingsPatch(c, { appearance: { ...a, density: e.target.value as DensityId } });
                                        })}
                                        options={[
                                            { value: "compact", label: "Kompakt" },
                                            { value: "cozy", label: "Standard" },
                                            { value: "spacious", label: "Weit" },
                                        ]}
                                    />
                                </div>
                            </div>
                            <div className="settings-row">
                                <div><b>Akzentfarbe</b><div className="card-sub">Markenfarbe (CSS-Variablen)</div></div>
                                <Button type="button" variant="secondary" onClick={() => setAccentDialogOpen(true)}>{accentLabel}</Button>
                            </div>

                            <div className="card-head" style={{ marginTop: 20 }}>
                                <div>
                                    <div className="card-title">Akten-Anlagen</div>
                                    <div className="card-sub">Programm für „Extern öffnen…“ in der Patientenakte (Register Extra Anlagen)</div>
                                </div>
                            </div>
                            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 0 }}>
                                <Input
                                    id="set-akte-open-app"
                                    label="App / Programm (optional)"
                                    placeholder="Leer lassen für Systemstandard · z. B. /System/Applications/Preview.app"
                                    value={akteClient.openImagesWithApp ?? ""}
                                    onChange={(e) =>
                                        persistClientSilent((c) => {
                                            const ak = c.akte ?? DEFAULT_CLIENT_SETTINGS.akte!;
                                            return mergeClientSettingsPatch(c, {
                                                akte: { ...ak, openImagesWithApp: e.target.value },
                                            });
                                        })
                                    }
                                />
                                <p className="card-sub" style={{ margin: 0 }}>
                                    macOS: vollständiger Pfad zur .app. Windows: Pfad zur .exe. Linux: Programm mit Dateipfad als
                                    Argument oder leer lassen für den Systemstandard (xdg-open).
                                </p>
                            </div>

                            <div className="card-head" style={{ marginTop: 20 }}><div><div className="card-title">Sicherheitsabfragen (Akte)</div><div className="card-sub">Löschen und kritische Änderungen in der Patientenakte</div></div></div>
                            {!hydratedUi ? (
                                <p className="card-sub" style={{ margin: "0 18px 12px" }}>Lade Einstellungen …</p>
                            ) : (
                                <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    <Select
                                        label="Standard für alle Bereiche"
                                        value={confirmations.defaultMode}
                                        onChange={async (e) => {
                                            const v = e.target.value as ConfirmationPresentMode;
                                            await setDefaultConfirmationMode(v);
                                            toast(`Standard: ${v === "modal" ? "Dialog" : "Inline"}`, "info");
                                        }}
                                        options={[
                                            { value: "modal", label: "Dialog (Modal)" },
                                            { value: "inline", label: "Inline im Kontext" },
                                        ]}
                                    />
                                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-2)" }}>Pro Bereich</div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2" style={{ maxHeight: 320, overflow: "auto", paddingRight: 4 }}>
                                        {CONFIRMATION_AREA_KEYS.map((key: ConfirmationAreaKey) => (
                                            <Select
                                                key={key}
                                                label={CONFIRMATION_AREA_LABELS[key]}
                                                value={confirmations.areas[key] ?? "inherit"}
                                                onChange={async (e) => {
                                                    const v = e.target.value as "inherit" | ConfirmationPresentMode;
                                                    await setAreaConfirmationOverride(key, v);
                                                }}
                                                options={[
                                                    { value: "inherit", label: "Standard" },
                                                    { value: "modal", label: "Dialog" },
                                                    { value: "inline", label: "Inline" },
                                                ]}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>
                    ) : null}

                    {activeSection === "hilfe" ? (
                        <section>
                            <Suspense fallback={<EmbedSuspenseFallback />}>
                                <SettingsEmbeddedShell>
                                    <LazyHilfePage embedded />
                                </SettingsEmbeddedShell>
                            </Suspense>
                        </section>
                    ) : null}
                </div>
            </div>

            <Dialog
                open={pwDialogOpen}
                onClose={() => setPwDialogOpen(false)}
                title="Passwort ändern"
                footer={(
                    <>
                        <Button variant="ghost" type="button" onClick={() => setPwDialogOpen(false)}>Abbrechen</Button>
                        <Button type="button" onClick={() => void handleChangePassword()} disabled={pwBusy || !oldPw || !newPw} loading={pwBusy}>Speichern</Button>
                    </>
                )}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <Input id="old-pw" type="password" label="Aktuelles Passwort" autoComplete="current-password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
                    <Input id="new-pw" type="password" label="Neues Passwort (min. 8 Zeichen)" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                    <Input id="conf-pw" type="password" label="Neues Passwort wiederholen" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
                </div>
            </Dialog>

            <Dialog
                open={accentDialogOpen}
                onClose={() => setAccentDialogOpen(false)}
                title="Akzentfarbe"
                footer={<Button variant="ghost" type="button" onClick={() => setAccentDialogOpen(false)}>Schließen</Button>}
            >
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    {(["mint", "ocean", "plum"] as const).map((id) => (
                        <Button
                            key={id}
                            type="button"
                            variant={accentLabel === ACCENT_LABELS[id] ? undefined : "ghost"}
                            onClick={() => {
                                applyAccentPreset(id);
                                setAccentLabel(ACCENT_LABELS[id]);
                                toast(`Akzent: ${ACCENT_LABELS[id]}`, "success");
                            }}
                        >
                            {ACCENT_LABELS[id]}
                        </Button>
                    ))}
                </div>
            </Dialog>
        </div>
    );
}

function PraxisAddressArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <label className="input-wrap" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="input-label">{label}</span>
            <textarea className="input-edit" rows={4} value={value} onChange={(e) => onChange(e.target.value)} />
        </label>
    );
}
