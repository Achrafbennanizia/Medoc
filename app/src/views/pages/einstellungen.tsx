import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
    DEFAULT_PRAXIS_PRAEFERENZEN,
    hydratePraxisPraeferenzenFromKv,
    savePraxisPraeferenzen,
    type PraxisPraeferenzen,
} from "../../lib/praxis-praeferenzen-storage";
import {
    CONFIRMATION_AREA_KEYS,
    CONFIRMATION_AREA_LABELS,
    resolveConfirmationPresentation,
    type ConfirmationAreaKey,
    type AreaOverride,
    type ConfirmationPrefs,
} from "../../lib/confirmation-preferences";
import {
    loadDetectedPhotoViewerApps,
    photoViewerAppOptionsForSelect,
    OPEN_IMAGE_SYSTEM_ONLY,
    type DetectedPhotoViewerApp,
} from "@/lib/photo-viewer-apps";
import { getInvoicePraxisFromStorage, saveInvoicePraxisToStorage, type InvoicePraxis } from "../../lib/invoice-leistung";
import { allowed, parseRole } from "@/lib/rbac";
import { Button } from "../components/ui/button";
import { Input, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { Dialog } from "../components/ui/dialog";
import { AboutAppDialog } from "../components/app-help-dialogs";
import { EinstellungenExportDruckSection } from "./einstellungen-export-druck";

const LazyOpsPage = lazy(() => import("./ops").then((m) => ({ default: m.OpsPage })));

/** Zum Einbetten der Ops-Vorschau (vollständiger Inhalt — nur auf Wunsch). */
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

type SettingsSection = "praxis" | "konto" | "darstellung" | "arbeitsablaeufe" | "exportDruck" | "system" | "ueber";

function cycleAreaOverride(cur: AreaOverride | undefined): AreaOverride {
    if (cur == null || cur === "inherit") return "modal";
    if (cur === "modal") return "inline";
    return "inherit";
}

function modeDisplayLabel(prefs: ConfirmationPrefs, key: ConfirmationAreaKey): string {
    const o = prefs.areas[key];
    const resolved = resolveConfirmationPresentation(prefs, key);
    if (o == null || o === "inherit") {
        return resolved === "modal" ? "Standard → Modal" : "Standard → Inline";
    }
    return o === "modal" ? "Modal" : "Inline";
}

export function EinstellungenPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const session = useAuthStore((s) => s.session);
    const locale = useLocale((s) => s.locale);
    const setLocale = useLocale((s) => s.setLocale);
    const toast = useToastStore((s) => s.add);
    const role = parseRole(session?.rolle);
    const canMigration = role != null && allowed("ops.migration", role);

    const hydrateConfirmations = useUiPreferencesStore((s) => s.hydrate);
    const confirmations = useUiPreferencesStore((s) => s.confirmations);
    const hydratedUi = useUiPreferencesStore((s) => s.hydrated);
    const setDefaultConfirmationMode = useUiPreferencesStore((s) => s.setDefaultConfirmationMode);
    const setAreaConfirmationOverride = useUiPreferencesStore((s) => s.setAreaConfirmationOverride);

    const [activeSection, setActiveSection] = useState<SettingsSection>("praxis");
    const [client, setClient] = useState<ClientSettingsV1>(() => loadClientSettings());

    const [praxis, setPraxis] = useState<InvoicePraxis>(() => getInvoicePraxisFromStorage());
    const [praxisDirty, setPraxisDirty] = useState(false);

    const [praef, setPraef] = useState<PraxisPraeferenzen>(() => ({ ...DEFAULT_PRAXIS_PRAEFERENZEN }));
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

    const [opsEmbed, setOpsEmbed] = useState(false);
    const [photoViewerApps, setPhotoViewerApps] = useState<DetectedPhotoViewerApp[]>([]);
    const [aboutOpen, setAboutOpen] = useState(false);

    useEffect(() => {
        if (searchParams.get("tab") === "hilfe") {
            setSearchParams({}, { replace: true });
            navigate("/hilfe", { replace: true });
        }
    }, [searchParams, setSearchParams, navigate]);

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

    useEffect(() => {
        if (activeSection !== "darstellung") return;
        let cancelled = false;
        void loadDetectedPhotoViewerApps(true).then((apps) => {
            if (!cancelled) setPhotoViewerApps(apps);
        });
        return () => {
            cancelled = true;
        };
    }, [activeSection]);

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
            .then((v) => {
                if (!cancelled) setAppVersion(v);
            })
            .catch(() => {
                if (!cancelled) setAppVersion("?");
            });
        getPerfThresholdMs()
            .then((ms) => {
                if (!cancelled) setPerfMs(String(ms));
            })
            .catch(() => {
                if (!cancelled) setPerfMs("");
            });
        return () => {
            cancelled = true;
        };
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
        { id: "darstellung", label: "Darstellung" },
        { id: "arbeitsablaeufe", label: "Arbeitsabläufe" },
        { id: "exportDruck", label: "Export & Druck" },
        { id: "system", label: "System" },
        { id: "ueber", label: "Über die Anwendung" },
    ];

    const appearance = client.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
    const wf = client.workflows ?? DEFAULT_CLIENT_SETTINGS.workflows!;
    const searchPrefs = client.search ?? DEFAULT_CLIENT_SETTINGS.search!;
    const security = client.security ?? DEFAULT_CLIENT_SETTINGS.security!;
    const akteClient = client.akte ?? DEFAULT_CLIENT_SETTINGS.akte!;

    const photoAppSelectOptions = useMemo(() => {
        const opts = photoViewerAppOptionsForSelect(photoViewerApps);
        const cur = (akteClient.openImagesWithApp ?? "").trim();
        if (cur && cur !== OPEN_IMAGE_SYSTEM_ONLY && !opts.some((o) => o.value === cur)) {
            return [...opts, { value: cur, label: `Gespeichert: ${cur}` }];
        }
        return opts;
    }, [photoViewerApps, akteClient.openImagesWithApp]);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in--sticky-safe">
            <h2 className="page-title">Einstellungen</h2>
            <p className="page-sub">Praxis · Darstellung · Abläufe · System</p>

            <div className="split settings-shell" style={{ gridTemplateColumns: "minmax(200px, 240px) 1fr", alignItems: "start" }}>
                <div className="card card-pad settings-nav">
                    <div className="col">
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className={`sb-item settings-nav-item ${activeSection === item.id ? "active" : ""}`}
                                onClick={() => setActiveSection(item.id)}
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
                                    <div className="card-title">Konto</div>
                                    <div className="card-sub">Profil und Anmeldung</div>
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
                            <div className="settings-row">
                                <div><b>Abmelden</b><div className="card-sub">Sitzung beenden (Anmeldedialog)</div></div>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => window.dispatchEvent(new Event("medoc-request-logout"))}
                                >
                                    Abmelden…
                                </Button>
                            </div>
                            <div className="card-head" style={{ marginTop: 16 }}><div><div className="card-title">Hilfe &amp; Compliance</div><div className="card-sub">Eigenständige Seiten</div></div></div>
                            <div className="card-pad row" style={{ gap: 10, flexWrap: "wrap" }}>
                                <Link to="/hilfe" className="btn btn-subtle">Hilfe &amp; Kurzbefehle</Link>
                                <Link to="/compliance" className="btn btn-subtle">Compliance</Link>
                            </div>
                        </section>
                    ) : null}

                    {activeSection === "darstellung" ? (
                        <section>
                            <div className="card-head"><div><div className="card-title">Darstellung</div><div className="card-sub">Dichte, Navigation, Akzent</div></div></div>
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
                                <div><b>Benutzeravatar in der Kopfleiste</b><div className="card-sub">Kreis mit Initialen rechts oben</div></div>
                                <input type="checkbox" checked={appearance.showHeaderAvatar !== false} onChange={() => persistClientSilent((c) => {
                                    const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                    const on = a.showHeaderAvatar !== false;
                                    return mergeClientSettingsPatch(c, { appearance: { ...a, showHeaderAvatar: on ? false : true } });
                                })} aria-label="Avatar Header" />
                            </div>
                            <div className="settings-row">
                                <div><b>Tastenkürzel anzeigen</b><div className="card-sub">z. B. ⌘K in der Suche</div></div>
                                <input type="checkbox" checked={appearance.showKeyboardHints !== false} onChange={() => persistClientSilent((c) => {
                                    const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                    const on = a.showKeyboardHints !== false;
                                    return mergeClientSettingsPatch(c, { appearance: { ...a, showKeyboardHints: on ? false : true } });
                                })} aria-label="Tastenkürzel" />
                            </div>
                            <div className="settings-row">
                                <div><b>Akzentfarbe</b><div className="card-sub">Markenfarbe (CSS-Variablen)</div></div>
                                <Button type="button" variant="secondary" onClick={() => setAccentDialogOpen(true)}>{accentLabel}</Button>
                            </div>

                            <div className="card-head" style={{ marginTop: 20 }}>
                                <div>
                                    <div className="card-title">Akten-Anlagen</div>
                                    <div className="card-sub">Programm für „Extern öffnen…“ in der Patientenakte</div>
                                </div>
                            </div>
                            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 0 }}>
                                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
                                    <p className="card-sub" style={{ margin: 0, flex: "1 1 220px" }}>
                                        Es werden nur auf diesem Rechner installierte Programme angezeigt. Leer = erste gefundene App;
                                        „Nur Systemstandard“ = wie Doppelklick im Finder.
                                    </p>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={() =>
                                            void loadDetectedPhotoViewerApps(true).then((a) => {
                                                setPhotoViewerApps(a);
                                                toast(`${a.length} Viewer gefunden`, "info");
                                            })
                                        }
                                    >
                                        Neu scannen
                                    </Button>
                                </div>
                                <Select
                                    id="set-akte-open-app"
                                    label="App zum externen Öffnen"
                                    value={akteClient.openImagesWithApp ?? ""}
                                    options={photoAppSelectOptions}
                                    onChange={(e) =>
                                        persistClientSilent((c) => {
                                            const ak = c.akte ?? DEFAULT_CLIENT_SETTINGS.akte!;
                                            return mergeClientSettingsPatch(c, {
                                                akte: { ...ak, openImagesWithApp: e.target.value },
                                            });
                                        })
                                    }
                                />
                            </div>
                        </section>
                    ) : null}

                    {activeSection === "arbeitsablaeufe" ? (
                        <section>
                            <div className="card-head">
                                <div>
                                    <div className="card-title">Arbeitsabläufe</div>
                                    <div className="card-sub">Termine, Suche, Sicherheitsabfragen</div>
                                </div>
                            </div>
                            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                <h3 className="text-title" style={{ margin: 0, fontSize: 15 }}>Terminregeln (Praxis-Präferenzen)</h3>
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
                                        label="Standard-Kalenderansicht für „Termine“"
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
                                    <p className="card-sub" style={{ margin: "8px 0 0" }}>Wird beim ersten Öffnen von /termine verwendet; die Ansicht in der Terminübersicht aktualisiert diesen Standard.</p>
                                </div>

                                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                                    <Select
                                        label="Standard-Termindauer (Min)"
                                        value={String(wf.defaultTerminDauerMin ?? 30)}
                                        onChange={(e) => persistClientSilent((c) => {
                                            const w = c.workflows ?? DEFAULT_CLIENT_SETTINGS.workflows!;
                                            const n = Number.parseInt(e.target.value, 10);
                                            return mergeClientSettingsPatch(c, { workflows: { ...w, defaultTerminDauerMin: Number.isFinite(n) ? n : 30 } });
                                        })}
                                        options={[
                                            { value: "15", label: "15" },
                                            { value: "20", label: "20" },
                                            { value: "30", label: "30" },
                                            { value: "45", label: "45" },
                                            { value: "60", label: "60" },
                                        ]}
                                    />
                                    <p className="card-sub" style={{ margin: "8px 0 0" }}>Vorauswahl bei „Neuer Termin“ (lokaler Entwurf kann abweichen).</p>
                                </div>

                                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                                    <Input
                                        id="ta-reminder"
                                        label="Tagesabschluss: Erinnerung (HH:MM, lokal)"
                                        value={wf.tagesabschlussReminderTime ?? "18:00"}
                                        onChange={(e) => persistClientSilent((c) => {
                                            const w = c.workflows ?? DEFAULT_CLIENT_SETTINGS.workflows!;
                                            return mergeClientSettingsPatch(c, { workflows: { ...w, tagesabschlussReminderTime: e.target.value } });
                                        })}
                                        placeholder="18:00"
                                    />
                                    <p className="card-sub" style={{ margin: "8px 0 0" }}>Hinweis-Toast auf dem Dashboard (einmal pro Tag).</p>
                                </div>

                                <div className="settings-row" style={{ marginTop: 8 }}>
                                    <div>
                                        <b>Patientensuche: Versicherungsnummer</b>
                                        <div className="card-sub">Suchbegriff auch gegen Versicherungsnummer prüfen</div>
                                    </div>
                                    <input type="checkbox" checked={searchPrefs.patientIncludeVersicherungsnummer !== false} onChange={() => persistClientSilent((c) => {
                                        const s = c.search ?? DEFAULT_CLIENT_SETTINGS.search!;
                                        const cur = s.patientIncludeVersicherungsnummer !== false;
                                        return mergeClientSettingsPatch(c, { search: { ...s, patientIncludeVersicherungsnummer: !cur } });
                                    })} aria-label="Suche VN" />
                                </div>

                                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                                    <div className="card-head" style={{ paddingTop: 0 }}>
                                        <div>
                                            <div className="card-title">Bestätigung bei kritischen Aktionen (Akte)</div>
                                            <div className="card-sub">Ein Klick pro Zeile wechselt Standard → Modal → Inline → Standard</div>
                                        </div>
                                    </div>
                                    {!hydratedUi ? (
                                        <p className="card-sub" style={{ margin: "0 0 12px" }}>Lade Einstellungen …</p>
                                    ) : (
                                        <>
                                            <div className="settings-row" style={{ marginBottom: 10 }}>
                                                <div><b>Globaler Standard</b><div className="card-sub">wenn „Standard“ in der Tabelle</div></div>
                                                <div className="row" style={{ gap: 8 }}>
                                                    <Button type="button" size="sm" variant={confirmations.defaultMode === "modal" ? "secondary" : "ghost"} onClick={() => void setDefaultConfirmationMode("modal").then(() => toast("Standard: Modal", "info"))}>Modal</Button>
                                                    <Button type="button" size="sm" variant={confirmations.defaultMode === "inline" ? "secondary" : "ghost"} onClick={() => void setDefaultConfirmationMode("inline").then(() => toast("Standard: Inline", "info"))}>Inline</Button>
                                                </div>
                                            </div>
                                            <div className="tbl-scroll">
                                                <table className="tbl" style={{ fontSize: 13 }}>
                                                    <thead>
                                                        <tr>
                                                            <th scope="col">Bereich</th>
                                                            <th scope="col">Modus</th>
                                                            <th scope="col" style={{ width: 120 }}>Wechseln</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {CONFIRMATION_AREA_KEYS.map((key: ConfirmationAreaKey) => (
                                                            <tr key={key}>
                                                                <td>{CONFIRMATION_AREA_LABELS[key]}</td>
                                                                <td>{modeDisplayLabel(confirmations, key)}</td>
                                                                <td>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => void (async () => {
                                                                            const next = cycleAreaOverride(confirmations.areas[key]);
                                                                            await setAreaConfirmationOverride(key, next);
                                                                            toast(`${CONFIRMATION_AREA_LABELS[key]}: ${next === "inherit" ? "Standard" : next === "modal" ? "Modal" : "Inline"}`, "info");
                                                                        })()}
                                                                    >
                                                                        Nächster
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </section>
                    ) : null}

                    {activeSection === "exportDruck" ? <EinstellungenExportDruckSection /> : null}

                    {activeSection === "system" ? (
                        <section>
                            <div className="card-head">
                                <div>
                                    <div className="card-title">System</div>
                                    <div className="card-sub">Diagnose, Performance, Daten</div>
                                </div>
                            </div>
                            <div className="settings-row" style={{ alignItems: "flex-start" }}>
                                <div style={{ flex: 1 }}>
                                    <b>Auto-Abmeldung bei Inaktivität</b>
                                    <div className="card-sub">Nur auf diesem Gerät; 0 = aus. Bei Ablauf wird abgemeldet (wie Abmelden).</div>
                                </div>
                                <div style={{ minWidth: 160 }}>
                                    <Select
                                        label="Minuten"
                                        value={String(security.idleLogoutMinutes ?? 0)}
                                        onChange={(e) => persistClientSilent((c) => {
                                            const s = c.security ?? DEFAULT_CLIENT_SETTINGS.security!;
                                            const n = Number.parseInt(e.target.value, 10);
                                            return mergeClientSettingsPatch(c, { security: { ...s, idleLogoutMinutes: Number.isFinite(n) ? n : 0 } });
                                        })}
                                        options={[
                                            { value: "0", label: "Aus" },
                                            { value: "5", label: "5" },
                                            { value: "15", label: "15" },
                                            { value: "30", label: "30" },
                                            { value: "60", label: "60" },
                                        ]}
                                    />
                                </div>
                            </div>
                            <div className="settings-row">
                                <div>
                                    <b>Health-Check</b>
                                    <div className="card-sub">
                                        {healthLast
                                            ? `DB ${healthLast.db_ok ? "OK" : "Fehler"} (${healthLast.db_latency_ms} ms) · Audit ${healthLast.audit_chain_ok ? "OK" : "Bruch"} · v${healthLast.version}`
                                            : "Datenbank, Audit-Kette"}
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
                            <div className="card-head" style={{ marginTop: 12 }}><div><div className="card-title">Backup</div></div></div>
                            <div className="settings-row">
                                <div><b>Backup jetzt</b><div className="card-sub">In konfiguriertes Ziel (Ops)</div></div>
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
                            <div className="card-head" style={{ marginTop: 12 }}><div><div className="card-title">Weitere Seiten</div></div></div>
                            <div className="card-pad row" style={{ gap: 10, flexWrap: "wrap" }}>
                                <Link to="/audit" className="btn btn-subtle">Audit-Log</Link>
                                <Link to="/logs" className="btn btn-subtle">Technische Logs</Link>
                                <Link to="/ops" className="btn btn-subtle">Betrieb / Ops</Link>
                                {canMigration ? <Link to="/migration" className="btn btn-subtle">Datenmigration</Link> : null}
                                <Button type="button" variant={opsEmbed ? "secondary" : "ghost"} onClick={() => setOpsEmbed((v) => !v)}>Ops-Vorschau {opsEmbed ? "ausblenden" : "einblenden"}</Button>
                            </div>
                            {opsEmbed ? (
                                <Suspense fallback={<EmbedSuspenseFallback />}>
                                    <SettingsEmbeddedShell>
                                        <LazyOpsPage embedded onOpenMigration={() => navigate("/migration")} />
                                    </SettingsEmbeddedShell>
                                </Suspense>
                            ) : null}
                        </section>
                    ) : null}

                    {activeSection === "ueber" ? (
                        <section>
                            <div className="card-head"><div><div className="card-title">Über die Anwendung</div><div className="card-sub">Version, Lizenz, Drittanbieter</div></div></div>
                            <div className="settings-row"><div><b>App-Version</b><div className="card-sub">MeDoc {appVersion}</div></div><Button variant="ghost" type="button" onClick={() => void handleCheckUpdates()} disabled={updateBusy} loading={updateBusy}>Nach Updates suchen</Button></div>
                            <div className="settings-row"><div><b>Über &amp; Lizenzen</b><div className="card-sub">Kurzinfo und Symbol-Bibliotheken</div></div><Button type="button" variant="secondary" onClick={() => setAboutOpen(true)}>Dialog öffnen</Button></div>
                            <div className="settings-highlight-card" style={{ margin: 18, border: "1px solid #6ea9d8", borderRadius: 16, padding: 16, background: "#f7fbff" }}>
                                <div className="row settings-highlight-head" style={{ justifyContent: "space-between" }}>
                                    <span className="pill blue">Lizenz</span>
                                    <span style={{ color: "var(--fg-3)", fontSize: 12 }}>Token prüfen</span>
                                </div>
                                <p className="card-sub" style={{ margin: "8px 0 0" }}>Lizenz-Token zur Prüfung eingeben.</p>
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
                            <div className="card-head" style={{ marginTop: 16 }}><div><div className="card-title">Zahlungsmethode</div><div className="card-sub">Provider-Token (PCI-sicher)</div></div></div>
                            <div className="settings-row" style={{ alignItems: "flex-end", gap: 12 }}>
                                <div style={{ flex: 1 }}><Input id="pay-token" label="Provider-Token" placeholder="pm_… oder tok_…" value={paymentToken} onChange={(e) => setPaymentToken(e.target.value)} /></div>
                                <Button type="button" onClick={() => void handleAttachPayment()} disabled={paymentBusy || !paymentToken.trim()} loading={paymentBusy}>Hinterlegen</Button>
                            </div>
                            <div className="card-pad">
                                <p className="card-sub" style={{ margin: 0, lineHeight: 1.55 }}>
                                    <strong>Drittanbieter:</strong> Symbole über <a href="https://lucide.dev" target="_blank" rel="noopener noreferrer">Lucide</a>{" "}
                                    (ISC License). Weitere OSS-Bestandteile siehe mitgelieferte Dokumentation der Plattform (Tauri, React).
                                </p>
                            </div>
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

            <AboutAppDialog open={aboutOpen} onClose={() => setAboutOpen(false)} appVersion={appVersion} />
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
