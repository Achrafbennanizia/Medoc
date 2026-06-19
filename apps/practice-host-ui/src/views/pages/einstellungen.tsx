import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { passwordPolicyError } from "@/lib/password-policy";
import { useAuthStore } from "../../models/store/auth-store";
import { PasswordPolicyHints } from "../components/password-policy-hints";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";
import { useUiPreferencesStore } from "../../models/store/ui-preferences-store";
import {
    changePassword,
    companyPortalFetchFeatureFlags,
    companyPortalFetchIntegrations,
    companyPortalFetchSummary,
    type LicenseStatus,
    verifyLicense,
    activateLicense,
    currentLicenseStatus,
    clearLicense,
} from "@/systems/practice-host/controllers/settings-page.controller";
import { useLocale, useT, useTParams } from "@/lib/i18n";
import {
    DEFAULT_CLIENT_SETTINGS,
    loadClientSettings,
    saveClientSettings,
    applyAppearanceFromSettings,
    normalizeColorScheme,
    normalizeFontStack,
    resolveAppearanceTheme,
    type ClientSettingsV1,
} from "@/lib/client-settings";
import {
    DEFAULT_PRAXIS_PRAEFERENZEN,
    hydratePraxisPraeferenzenFromKv,
    savePraxisPraeferenzen,
    type PraxisPraeferenzen,
} from "@/lib/praxis-praeferenzen-storage";
import type { SettingsSectionId } from "@/lib/rbac";
import { useRbac } from "@/lib/use-rbac";
import { AccessDeniedView } from "@/views/components/rbac-gate";
import { normalizeAccentId } from "@/lib/accent-preset";
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

const SETTINGS_BREADCRUMB_FALLBACK = "settings.breadcrumb_fallback";

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
    const t = useT();
    const tp = useTParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const session = useAuthStore((s) => s.session);
    const { can, canSettingsSection, canOpsSystem } = useRbac();
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
            toast(t("settings.password.mismatch"));
            return;
        }
        setPwBusy(true);
        try {
            await changePassword(oldPw, newPw);
            toast(t("settings.password.changed"));
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
            toast(tp("common.error_with_message", { message: (e as Error).message ?? String(e) }), "error");
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
            toast(st.valid ? t("settings.license.valid") : tp("settings.license.invalid", { reason: st.reason ?? "—" }), st.valid ? "success" : "info");
        } catch (e) {
            toast(tp("common.error_with_message", { message: (e as Error).message ?? String(e) }), "error");
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
                toast(t("settings.license.activated"), "success");
                setLicenseToken("");
            } else {
                toast(tp("settings.license.activate_failed", { reason: st.reason ?? "—" }), "error");
            }
        } catch (e) {
            toast(tp("common.error_with_message", { message: (e as Error).message ?? String(e) }), "error");
        } finally {
            setLicBusy(false);
        }
    }

    async function handleClearLicense() {
        if (!window.confirm(t("settings.license.clear_confirm"))) {
            return;
        }
        setLicBusy(true);
        try {
            await clearLicense();
            const st = await currentLicenseStatus();
            setLicenseStatus(st);
            setLicenseToken("");
            toast(t("settings.license.cleared"), "success");
        } catch (e) {
            toast(tp("common.error_with_message", { message: (e as Error).message ?? String(e) }), "error");
        } finally {
            setLicBusy(false);
        }
    }

    const savePraef = async () => {
        try {
            await savePraxisPraeferenzen(praef);
            setPraefDirty(false);
            toast(t("settings.praef.saved"), "success");
        } catch (e) {
            toast(tp("settings.praef.save_failed", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const setSection = useCallback(
        (id: SettingsSection) => {
            setActiveSection(id);
            setSearchParams({ tab: TAB_QUERY[id] }, { replace: true });
        },
        [setSearchParams],
    );

    const primaryNavAll: Array<{ id: SettingsSection; labelKey: string; icon: FC<{ size?: number }> }> = [
        { id: "praxis", labelKey: "settings.nav.praxis", icon: StethoscopeIcon },
        { id: "konto", labelKey: "settings.nav.konto", icon: UsersIcon },
        { id: "benachrichtigungen", labelKey: "settings.nav.benachrichtigungen", icon: BellIcon },
        { id: "sicherheit", labelKey: "settings.nav.sicherheit", icon: ShieldIcon },
        { id: "lizenz", labelKey: "settings.nav.lizenz", icon: KeyRoundIcon },
        { id: "integrationen", labelKey: "settings.nav.integrationen", icon: BoltIcon },
        { id: "migration", labelKey: "settings.nav.migration", icon: DownloadIcon },
        { id: "darstellung", labelKey: "settings.nav.darstellung", icon: SunIcon },
    ];

    const advancedNavAll: Array<{ id: SettingsSection; labelKey: string; icon: FC<{ size?: number }> }> = [
        { id: "arbeitsablaeufe", labelKey: "settings.nav.arbeitsablaeufe", icon: SlidersHorizontalIcon },
        { id: "system", labelKey: "settings.nav.system", icon: SettingsIcon },
        { id: "ueber", labelKey: "settings.nav.ueber", icon: InfoIcon },
    ];

    const primaryNav = primaryNavAll.filter((item) => canSettingsSection(item.id));
    const advancedNav = advancedNavAll.filter((item) => canSettingsSection(item.id));

    const settingsBreadcrumb = useMemo(() => {
        const labels = [...primaryNav, ...advancedNav].slice(0, 5).map((i) => t(i.labelKey));
        if (labels.length === 0) return t(SETTINGS_BREADCRUMB_FALLBACK);
        return `${labels.join(" · ")}${labels.length >= 5 ? " — …" : ""}`;
    }, [primaryNav, advancedNav, t]);

    useEffect(() => {
        if (canSettingsSection(activeSection)) return;
        const first = primaryNav[0]?.id ?? advancedNav[0]?.id ?? null;
        if (first) setSection(first);
    }, [activeSection, session?.rolle, session?.permission_overrides, primaryNav, advancedNav, setSection, canSettingsSection]);

    const appearance = client.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
    const accentPresetId = normalizeAccentId(appearance.accentPreset);
    const fontStack = normalizeFontStack(appearance.fontStack);
    const densityLabel =
        appearance.density === "compact" ? t("settings.density.compact") : appearance.density === "spacious" ? t("settings.density.spacious") : t("settings.density.comfortable");
    const wf = client.workflows ?? DEFAULT_CLIENT_SETTINGS.workflows!;
    const searchPrefs = client.search ?? DEFAULT_CLIENT_SETTINGS.search!;
    const security = client.security ?? DEFAULT_CLIENT_SETTINGS.security!;
    const notifications = client.notifications ?? DEFAULT_CLIENT_SETTINGS.notifications!;
    const integrations = client.integrations ?? DEFAULT_CLIENT_SETTINGS.integrations!;
    const colorSchemePref = normalizeColorScheme(appearance.colorScheme);
    const resolvedTheme = resolveAppearanceTheme(client);

    return (
        <div className="settings-page animate-fade-in--sticky-safe">
            <WorkspacePageHeader
                title={t("settings.page.title")}
                subtitle={<p className="page-sub settings-page-breadcrumb">{settingsBreadcrumb}</p>}
            />

            <div className="split settings-shell" style={{ gridTemplateColumns: "minmax(220px, 260px) 1fr", alignItems: "start" }}>
                <nav className="settings-nav-card settings-nav" aria-label={t("settings.nav.sections_aria")}>
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
                                    <span className="settings-nav-label">{t(item.labelKey)}</span>
                                </button>
                            );
                        })}
                        {advancedNav.length > 0 ? (
                            <>
                        <div className="settings-nav-sep" aria-hidden />
                        <div className="settings-nav-muted">{t("settings.nav.advanced")}</div>
                            </>
                        ) : null}
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
                                    <span className="settings-nav-label">{t(item.labelKey)}</span>
                                </button>
                            );
                        })}
                    </div>
                </nav>
                <div className="settings-panel-stack">
                    {!canSettingsSection(activeSection) ? (
                        <AccessDeniedView detail={t("settings.access_denied")} />
                    ) : null}
                    {canSettingsSection(activeSection) && activeSection === "praxis" ? (
                        <EinstellungenPraxisSection
                            sessionUserId={session?.user_id}
                            onOpenArbeitsablaeufe={() => setSection("arbeitsablaeufe")}
                            canEditPraxis={canOpsSystem}
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
                        <EinstellungenSystemSection canOpsSystem={canLanHost} />
                    ) : null}

                    {canSettingsSection(activeSection) && activeSection === "ueber" ? (
                        <EinstellungenUeberSection />
                    ) : null}
                </div>
            </div>

            <Dialog
                open={pwDialogOpen}
                onClose={() => setPwDialogOpen(false)}
                title={t("settings.password.change_title")}
                footer={(
                    <>
                        <Button variant="ghost" type="button" onClick={() => setPwDialogOpen(false)}>
                            {t("common.cancel")}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => void handleChangePassword()}
                            disabled={pwBusy || !oldPw || !newPw}
                            loading={pwBusy}
                        >
                            {t("common.save")}
                        </Button>
                    </>
                )}
            >
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <Input
                        id="old-pw"
                        type="password"
                        label={t("settings.password.current")}
                        autoComplete="current-password"
                        value={oldPw}
                        onChange={(e) => setOldPw(e.target.value)}
                    />
                    <Input
                        id="new-pw"
                        type="password"
                        label={t("settings.password.new")}
                        autoComplete="new-password"
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                    />
                    <PasswordPolicyHints password={newPw} idPrefix="einst-pw" />
                    <Input
                        id="conf-pw"
                        type="password"
                        label={t("settings.password.confirm")}
                        autoComplete="new-password"
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                    />
                </div>
            </Dialog>
        </div>
    );
}
