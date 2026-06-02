import { useCallback, useEffect, useState, type FC } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { passwordPolicyError } from "@/lib/password-policy";
import { useAuthStore } from "../../models/store/auth-store";
import { PasswordPolicyHints } from "../components/password-policy-hints";
import { useUiPreferencesStore } from "../../models/store/ui-preferences-store";
import {
    changePassword,
    companyPortalFetchFeatureFlags,
    companyPortalFetchIntegrations,
    companyPortalFetchSummary,
    type HealthCheck,
    type LicenseStatus,
    verifyLicense,
    activateLicense,
    currentLicenseStatus,
    clearLicense,
} from "@/systems/practice-host/controllers/settings-page.controller";
import { useLocale } from "../../lib/i18n";
import {
    DEFAULT_CLIENT_SETTINGS,
    loadClientSettings,
    saveClientSettings,
    applyAppearanceFromSettings,
    normalizeColorScheme,
    resolveAppearanceTheme,
    type ClientSettingsV1,
    type FontStackId,
} from "../../lib/client-settings";
import {
    DEFAULT_PRAXIS_PRAEFERENZEN,
    hydratePraxisPraeferenzenFromKv,
    savePraxisPraeferenzen,
    type PraxisPraeferenzen,
} from "../../lib/praxis-praeferenzen-storage";
import type { SettingsSectionId } from "@/lib/rbac";
import { useRbac } from "@/lib/use-rbac";
import { AccessDeniedView } from "@/views/components/rbac-gate";
import { normalizeAccentId } from "../../lib/accent-preset";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { Dialog } from "../components/ui/dialog";
import { EinstellungenPraxisSection } from "@/systems/practice-host/pages/einstellungen/einstellungen-praxis-section";
import { EinstellungenBenachrichtigungenSection } from "@/systems/practice-host/pages/einstellungen/einstellungen-benachrichtigungen-section";
import { EinstellungenDarstellungSection } from "@/systems/practice-host/pages/einstellungen/einstellungen-darstellung-section";
import { EinstellungenArbeitsablaeufeSection } from "@/systems/practice-host/pages/einstellungen/einstellungen-arbeitsablaeufe-section";
import { EinstellungenKontoSection } from "@/systems/practice-host/pages/einstellungen/einstellungen-konto-section";
import { EinstellungenSicherheitSection } from "@/systems/practice-host/pages/einstellungen/einstellungen-sicherheit-section";
import { EinstellungenSystemSection } from "@/systems/practice-host/pages/einstellungen/einstellungen-system-section";
import { EinstellungenMigrationSection } from "@/systems/practice-host/pages/einstellungen/einstellungen-migration-section";
import { EinstellungenUeberSection } from "@/systems/practice-host/pages/einstellungen/einstellungen-ueber-section";
import { EinstellungenLizenzSection } from "@/systems/practice-host/pages/einstellungen/einstellungen-lizenz-section";
import { EinstellungenIntegrationenSection } from "@/systems/practice-host/pages/einstellungen/einstellungen-integrationen-section";
import {
    BellIcon,
    BoltIcon,
    DownloadIcon,
    InfoIcon,
    KeyRoundIcon,
    SettingsIcon,
    ShieldIcon,
    SlidersHorizontalIcon,
    StethoscopeIcon,
    SunIcon,
    UsersIcon,
} from "@/lib/icons";

const SETTINGS_BREADCRUMB =
    "Praxis · Konto · Benachrichtigungen · Darstellung · Sicherheit · Lizenz — weitere unten in der Liste";

const PW_CHANGED_LS = "medoc-settings-pw-changed-at-ms";

type SettingsSection = SettingsSectionId;

const TAB_QUERY: Record<SettingsSection, string> = {
    praxis: "praxis",
    konto: "konto",
    benachrichtigungen: "benachrichtigungen",
    sicherheit: "sicherheit",
    lizenz: "lizenz",
    integrationen: "integrationen",
    migration: "migration",
    darstellung: "darstellung",
    arbeitsablaeufe: "arbeitsablaeufe",
    system: "system",
    ueber: "ueber",
};

export function EinstellungenPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const session = useAuthStore((s) => s.session);
    const { can, canSettingsSection } = useRbac();
    const locale = useLocale((s) => s.locale);
    const setLocale = useLocale((s) => s.setLocale);
    const toast = useToastStore((s) => s.add);
    const canMigration = can("ops.migration");
    const canLanHost = can("ops.system");
    const canClearLicense = can("ops.system");

    const hydrateConfirmations = useUiPreferencesStore((s) => s.hydrate);

    const [activeSection, setActiveSection] = useState<SettingsSection>("praxis");
    const [pwAgeTick, setPwAgeTick] = useState(0);

    const [client, setClient] = useState<ClientSettingsV1>(() => loadClientSettings());
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

    const [healthLast, setHealthLast] = useState<HealthCheck | null>(null);

    const [portalSummary, setPortalSummary] = useState<Record<string, unknown> | null>(null);
    const [portalIntegrations, setPortalIntegrations] = useState<Record<string, unknown> | null>(null);
    const [portalFlags, setPortalFlags] = useState<Record<string, unknown> | null>(null);
    const [portalFetchBusy, setPortalFetchBusy] = useState(false);

    useEffect(() => {
        if (searchParams.get("tab") === "hilfe") {
            setSearchParams({}, { replace: true });
            navigate("/hilfe", { replace: true });
        }
    }, [searchParams, setSearchParams, navigate]);

    useEffect(() => {
        const t = searchParams.get("tab");
        if (!t) return;
        if (t === "export") {
            setActiveSection("system");
            setSearchParams({ tab: TAB_QUERY.system }, { replace: true });
            return;
        }
        const hit = (Object.keys(TAB_QUERY) as SettingsSection[]).find((k) => TAB_QUERY[k] === t);
        if (hit) setActiveSection(hit);
    }, [searchParams, setSearchParams]);

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
        if (!session?.user_id) return;
        const portalSections = new Set<SettingsSection>(["lizenz", "integrationen", "benachrichtigungen"]);
        if (!portalSections.has(activeSection)) return;
        let cancelled = false;
        setPortalFetchBusy(true);
        void (async () => {
            try {
                // Portal optional (offline / no company host): `null` is intentional, not a silent failure.
                if (activeSection === "lizenz") {
                    const sum = await companyPortalFetchSummary().catch(() => null);
                    const lic = await currentLicenseStatus().catch(() => null);
                    if (!cancelled) {
                        if (sum && typeof sum === "object") setPortalSummary(sum as Record<string, unknown>);
                        if (lic) setLicenseStatus(lic);
                    }
                } else if (activeSection === "integrationen") {
                    const [sum, integ] = await Promise.all([
                        companyPortalFetchSummary().catch(() => null),
                        companyPortalFetchIntegrations().catch(() => null),
                    ]);
                    if (!cancelled) {
                        if (sum && typeof sum === "object") setPortalSummary(sum as Record<string, unknown>);
                        if (integ && typeof integ === "object") setPortalIntegrations(integ as Record<string, unknown>);
                    }
                } else if (activeSection === "benachrichtigungen") {
                    const ff = await companyPortalFetchFeatureFlags().catch(() => null);
                    if (!cancelled && ff && typeof ff === "object") setPortalFlags(ff as Record<string, unknown>);
                }
            } finally {
                if (!cancelled) setPortalFetchBusy(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeSection, session?.user_id]);

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

    async function handleChangePassword() {
        const policyErr = passwordPolicyError(newPw);
        if (policyErr) {
            toast(policyErr, "error");
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
            try {
                localStorage.setItem(PW_CHANGED_LS, String(Date.now()));
            } catch {
                /* ignore */
            }
            setPwAgeTick((n) => n + 1);
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

    async function handleActivateLicense() {
        if (!licenseToken.trim()) return;
        setLicBusy(true);
        try {
            const st = await activateLicense(licenseToken.trim());
            setLicenseStatus(st);
            if (st.valid) {
                toast("Lizenz aktiviert", "success");
                setLicenseToken("");
            } else {
                toast(`Aktivierung fehlgeschlagen: ${st.reason ?? "—"}`, "error");
            }
        } catch (e) {
            toast(`Fehler: ${(e as Error).message ?? e}`, "error");
        } finally {
            setLicBusy(false);
        }
    }

    async function handleClearLicense() {
        if (!window.confirm("Desktop-Lizenz wirklich entfernen? Die App startet danach wieder im Aktivierungsmodus.")) {
            return;
        }
        setLicBusy(true);
        try {
            await clearLicense();
            const st = await currentLicenseStatus();
            setLicenseStatus(st);
            setLicenseToken("");
            toast("Lizenz entfernt", "success");
        } catch (e) {
            toast(`Fehler: ${(e as Error).message ?? e}`, "error");
        } finally {
            setLicBusy(false);
        }
    }

    const savePraef = async () => {
        try {
            await savePraxisPraeferenzen(praef);
            setPraefDirty(false);
            toast("Termin-Präferenzen gespeichert (Praxis-weit in der Datenbank)", "success");
        } catch (e) {
            toast(`Speichern fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const setSection = useCallback(
        (id: SettingsSection) => {
            setActiveSection(id);
            setSearchParams({ tab: TAB_QUERY[id] }, { replace: true });
        },
        [setSearchParams],
    );

    const primaryNavAll: Array<{ id: SettingsSection; label: string; icon: FC<{ size?: number }> }> = [
        { id: "praxis", label: "Praxis", icon: StethoscopeIcon },
        { id: "konto", label: "Konto", icon: UsersIcon },
        { id: "benachrichtigungen", label: "Benachrichtigungen", icon: BellIcon },
        { id: "sicherheit", label: "Sicherheit", icon: ShieldIcon },
        { id: "lizenz", label: "Lizenz & Abo", icon: KeyRoundIcon },
        { id: "integrationen", label: "Integrationen", icon: BoltIcon },
        { id: "migration", label: "Migration", icon: DownloadIcon },
        { id: "darstellung", label: "Darstellung", icon: SunIcon },
    ];

    const advancedNavAll: Array<{ id: SettingsSection; label: string; icon: FC<{ size?: number }> }> = [
        { id: "arbeitsablaeufe", label: "Arbeitsabläufe", icon: SlidersHorizontalIcon },
        { id: "system", label: "System", icon: SettingsIcon },
        { id: "ueber", label: "Über die Anwendung", icon: InfoIcon },
    ];

    const primaryNav = primaryNavAll.filter((item) => canSettingsSection(item.id));
    const advancedNav = advancedNavAll.filter((item) => canSettingsSection(item.id));

    useEffect(() => {
        if (canSettingsSection(activeSection)) return;
        const first = primaryNav[0]?.id ?? advancedNav[0]?.id ?? null;
        if (first) setSection(first);
    }, [activeSection, session?.rolle, session?.permission_overrides, primaryNav, advancedNav, setSection, canSettingsSection]);

    const appearance = client.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
    const accentPresetId = normalizeAccentId(appearance.accentPreset);
    const fontStack: FontStackId = appearance.fontStack ?? "inter";
    const densityLabel =
        appearance.density === "compact" ? "Kompakt" : appearance.density === "spacious" ? "Weit" : "Gemütlich";
    const wf = client.workflows ?? DEFAULT_CLIENT_SETTINGS.workflows!;
    const searchPrefs = client.search ?? DEFAULT_CLIENT_SETTINGS.search!;
    const security = client.security ?? DEFAULT_CLIENT_SETTINGS.security!;
    const notifications = client.notifications ?? DEFAULT_CLIENT_SETTINGS.notifications!;
    const integrations = client.integrations ?? DEFAULT_CLIENT_SETTINGS.integrations!;
    const colorSchemePref = normalizeColorScheme(appearance.colorScheme);
    const resolvedTheme = resolveAppearanceTheme(client);

    return (
        <div className="settings-page animate-fade-in--sticky-safe">
            <header className="settings-page-head">
                <h2 className="page-title">Einstellungen</h2>
                <p className="page-sub settings-page-breadcrumb">{SETTINGS_BREADCRUMB}</p>
            </header>

            <div className="split settings-shell" style={{ gridTemplateColumns: "minmax(220px, 260px) 1fr", alignItems: "start" }}>
                <nav className="settings-nav-card settings-nav" aria-label="Einstellungen Abschnitte">
                    <div className="settings-nav-list">
                        {primaryNav.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={`settings-nav-btn${activeSection === item.id ? " active" : ""}`}
                                    onClick={() => setSection(item.id)}
                                >
                                    <Icon size={18} aria-hidden />
                                    <span className="settings-nav-label">{item.label}</span>
                                </button>
                            );
                        })}
                        <div className="settings-nav-sep" aria-hidden />
                        <div className="settings-nav-muted">Erweitert</div>
                        {advancedNav.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={`settings-nav-btn${activeSection === item.id ? " active" : ""}`}
                                    onClick={() => setSection(item.id)}
                                >
                                    <Icon size={18} aria-hidden />
                                    <span className="settings-nav-label">{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </nav>
                <div className="settings-panel-stack">
                    {!canSettingsSection(activeSection) ? (
                        <AccessDeniedView detail="Dieser Einstellungen-Bereich ist für Ihre Rolle nicht freigegeben." />
                    ) : null}
                    {canSettingsSection(activeSection) && activeSection === "praxis" ? (
                        <EinstellungenPraxisSection
                            sessionUserId={session?.user_id}
                            onOpenArbeitsablaeufe={() => setSection("arbeitsablaeufe")}
                        />
                    ) : null}

                    {canSettingsSection(activeSection) && activeSection === "konto" ? (
                        <EinstellungenKontoSection
                            onOpenPasswordDialog={() => setPwDialogOpen(true)}
                            passwordChangedTick={pwAgeTick}
                        />
                    ) : null}

                    {canSettingsSection(activeSection) && activeSection === "benachrichtigungen" ? (
                        <EinstellungenBenachrichtigungenSection
                            notifications={notifications}
                            portalFlags={portalFlags}
                            onPersistClient={persistClientSilent}
                        />
                    ) : null}

                    {canSettingsSection(activeSection) && activeSection === "sicherheit" ? (
                        <EinstellungenSicherheitSection
                            security={security}
                            healthLast={healthLast}
                            onPersistClient={persistClientSilent}
                        />
                    ) : null}

                    {canSettingsSection(activeSection) && activeSection === "lizenz" ? (
                        <EinstellungenLizenzSection
                            portalSummary={portalSummary}
                            portalFetchBusy={portalFetchBusy}
                            licenseToken={licenseToken}
                            onLicenseTokenChange={setLicenseToken}
                            licenseStatus={licenseStatus}
                            licBusy={licBusy}
                            onVerifyLicense={handleVerifyLicense}
                            onActivateLicense={handleActivateLicense}
                            canClearLicense={canClearLicense}
                            onClearLicense={handleClearLicense}
                        />
                    ) : null}

                    {canSettingsSection(activeSection) && activeSection === "integrationen" ? (
                        <EinstellungenIntegrationenSection
                            portalIntegrations={portalIntegrations}
                            integrations={integrations}
                            onPersistClient={persistClientSilent}
                        />
                    ) : null}

                    {canSettingsSection(activeSection) && activeSection === "migration" ? (
                        <EinstellungenMigrationSection canMigration={canMigration} />
                    ) : null}

                    {canSettingsSection(activeSection) && activeSection === "darstellung" ? (
                        <EinstellungenDarstellungSection
                            appearance={appearance}
                            colorSchemePref={colorSchemePref}
                            resolvedTheme={resolvedTheme}
                            fontStack={fontStack}
                            densityLabel={densityLabel}
                            accentPresetId={accentPresetId}
                            locale={locale}
                            onLocaleChange={setLocale}
                            onPersistClient={persistClientSilent}
                        />
                    ) : null}

                    {canSettingsSection(activeSection) && activeSection === "arbeitsablaeufe" ? (
                        <EinstellungenArbeitsablaeufeSection
                            praef={praef}
                            praefDirty={praefDirty}
                            onPraefChange={setPraef}
                            onPraefDirty={() => setPraefDirty(true)}
                            onSavePraef={savePraef}
                            workflows={wf}
                            searchPrefs={searchPrefs}
                            onPersistClient={persistClientSilent}
                            rolle={session?.rolle}
                        />
                    ) : null}

                    {canSettingsSection(activeSection) && activeSection === "system" ? (
                        <EinstellungenSystemSection
                            appearance={appearance}
                            security={security}
                            akteClient={client.akte ?? DEFAULT_CLIENT_SETTINGS.akte!}
                            canLanHost={canLanHost}
                            canMigration={canMigration}
                            onPersistClient={persistClientSilent}
                            onHealthLastChange={setHealthLast}
                        />
                    ) : null}

                    {canSettingsSection(activeSection) && activeSection === "ueber" ? (
                        <EinstellungenUeberSection
                            licenseToken={licenseToken}
                            onLicenseTokenChange={setLicenseToken}
                            licenseStatus={licenseStatus}
                            licBusy={licBusy}
                            onVerifyLicense={handleVerifyLicense}
                        />
                    ) : null}
                </div>
            </div>

            <Dialog
                open={pwDialogOpen}
                onClose={() => setPwDialogOpen(false)}
                title="Passwort ändern"
                footer={(
                    <>
                        <Button variant="ghost" type="button" onClick={() => setPwDialogOpen(false)}>
                            Abbrechen
                        </Button>
                        <Button
                            type="button"
                            onClick={() => void handleChangePassword()}
                            disabled={pwBusy || !oldPw || !newPw}
                            loading={pwBusy}
                        >
                            Speichern
                        </Button>
                    </>
                )}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <Input
                        id="old-pw"
                        type="password"
                        label="Aktuelles Passwort"
                        autoComplete="current-password"
                        value={oldPw}
                        onChange={(e) => setOldPw(e.target.value)}
                    />
                    <Input
                        id="new-pw"
                        type="password"
                        label="Neues Passwort"
                        autoComplete="new-password"
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                    />
                    <PasswordPolicyHints password={newPw} idPrefix="einst-pw" />
                    <Input
                        id="conf-pw"
                        type="password"
                        label="Neues Passwort wiederholen"
                        autoComplete="new-password"
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                    />
                </div>
            </Dialog>
        </div>
    );
}
