import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { passwordPolicyError } from "@/lib/password-policy";
import { clearDesktopLicenseClientState } from "@/systems/practice-host/lib/clear-desktop-license-client-state";
import { useAuthStore } from "../../models/store/auth-store";
import { useClusterStore } from "@/models/store/cluster-store";
import { PasswordPolicyHints } from "../components/password-policy-hints";
import { WorkspacePageHeader } from "../components/administration-page-header";
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
    DEFAULT_PRACTICE_PREFERENCES,
    hydratePracticePreferencesFromKv,
    savePracticePreferences,
    type PracticePreferences,
} from "@/lib/practice-preferences-storage";
import type { SettingsSectionId } from "@/lib/rbac";
import { useRbac } from "@/lib/use-rbac";
import { AccessDeniedView } from "@/views/components/rbac-gate";
import { normalizeAccentId } from "@/lib/accent-preset";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { Dialog } from "../components/ui/dialog";
import { SettingsPracticeSection } from "@/systems/practice-host/pages/settings/settings-practice-section";
import { SettingsNotificationsSection } from "@/systems/practice-host/pages/settings/settings-notifications-section";
import { SettingsAppearanceSection } from "@/systems/practice-host/pages/settings/settings-appearance-section";
import { SettingsWorkflowsSection } from "@/systems/practice-host/pages/settings/settings-workflows-section";
import { SettingsAccountSection } from "@/systems/practice-host/pages/settings/settings-account-section";
import { SettingsSecuritySection } from "@/systems/practice-host/pages/settings/settings-security-section";
import { SettingsSystemSection } from "@/systems/practice-host/pages/settings/settings-system-section";
import { SettingsMigrationSection } from "@/systems/practice-host/pages/settings/settings-migration-section";
import { SettingsAboutSection } from "@/systems/practice-host/pages/settings/settings-about-section";
import { SettingsLicenseSection } from "@/systems/practice-host/pages/settings/settings-license-section";
import { SettingsIntegrationsSection } from "@/systems/practice-host/pages/settings/settings-integrations-section";
import { StethoscopeIcon, UsersIcon, BellIcon, ShieldIcon, KeyRoundIcon, BoltIcon, DownloadIcon, SunIcon, SlidersHorizontalIcon, SettingsIcon, InfoIcon, ICON_SIZE_LG } from "@/lib/icons";

const SETTINGS_BREADCRUMB_FALLBACK = "settings.breadcrumb_fallback";

const PW_CHANGED_LS = "medoc-settings-pw-changed-at-ms";

type SettingsSection = SettingsSectionId;

const TAB_QUERY: Record<SettingsSection, string> = {
    practice: "practice",
    account: "account",
    notifications: "notifications",
    security: "security",
    license: "license",
    integrations: "integrations",
    migration: "migration",
    appearance: "appearance",
    workflows: "workflows",
    system: "system",
    about: "about",
};

export function SettingsPage() {
    const t = useT();
    const tp = useTParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const session = useAuthStore((s) => s.session);
    const { can, canSettingsSection, canOpsSystem } = useRbac();
    const locale = useLocale((s) => s.locale);
    const setLocale = useLocale((s) => s.setLocale);
    const toast = useToastStore((s) => s.add);
    const clearAuth = useAuthStore((s) => s.clear);
    const setClusterStatus = useClusterStore((s) => s.setStatus);
    const canMigration = can("ops.migration");
    const canLanHost = can("ops.system");
    const canClearLicense = can("ops.system");

    const hydrateConfirmations = useUiPreferencesStore((s) => s.hydrate);

    const [activeSection, setActiveSection] = useState<SettingsSection>("practice");
    const [pwAgeTick, setPwAgeTick] = useState(0);

    const [client, setClient] = useState<ClientSettingsV1>(() => loadClientSettings());
    const [prefs, setPrefs] = useState<PracticePreferences>(() => ({ ...DEFAULT_PRACTICE_PREFERENCES }));
    const [prefsDirty, setPrefsDirty] = useState(false);

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
        if (searchParams.get("tab") === "hilfe" || searchParams.get("tab") === "help") {
            setSearchParams({}, { replace: true });
            navigate("/help", { replace: true });
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
        const mapped = (Object.keys(TAB_QUERY) as SettingsSection[]).find((k) => TAB_QUERY[k] === t);
        if (mapped) setActiveSection(mapped);
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        let cancelled = false;
        void hydratePracticePreferencesFromKv().then((version) => {
            if (!cancelled) {
                setPrefs(version);
                setPrefsDirty(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!session?.user_id) return;
        const portalSections = new Set<SettingsSection>(["license", "integrations", "notifications"]);
        if (!portalSections.has(activeSection)) return;
        let cancelled = false;
        setPortalFetchBusy(true);
        void (async () => {
            try {
                // Portal optional (offline / no company host): `null` is intentional, not a silent failure.
                if (activeSection === "license") {
                    const sum = await companyPortalFetchSummary().catch(() => null);
                    const lic = await currentLicenseStatus().catch(() => null);
                    if (!cancelled) {
                        if (sum && typeof sum === "object") setPortalSummary(sum as Record<string, unknown>);
                        if (lic) setLicenseStatus(lic);
                    }
                } else if (activeSection === "integrations") {
                    const [sum, integ] = await Promise.all([
                        companyPortalFetchSummary().catch(() => null),
                        companyPortalFetchIntegrations().catch(() => null),
                    ]);
                    if (!cancelled) {
                        if (sum && typeof sum === "object") setPortalSummary(sum as Record<string, unknown>);
                        if (integ && typeof integ === "object") setPortalIntegrations(integ as Record<string, unknown>);
                    }
                } else if (activeSection === "notifications") {
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
        const policyErr = passwordPolicyError(t, newPw);
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
            clearDesktopLicenseClientState();
            await clearLicense();
            clearAuth();
            setClusterStatus(null);
            toast(t("settings.network_reset.restarting"), "info");
        } catch (e) {
            toast(tp("common.error_with_message", { message: (e as Error).message ?? String(e) }), "error");
        } finally {
            setLicBusy(false);
        }
    }

    const savePrefs = async () => {
        try {
            await savePracticePreferences(prefs);
            setPrefsDirty(false);
            toast(t("settings.prefs.saved"), "success");
        } catch (e) {
            toast(tp("settings.prefs.save_failed", { message: e instanceof Error ? e.message : String(e) }), "error");
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
        { id: "practice", labelKey: "settings.nav.practice", icon: StethoscopeIcon },
        { id: "account", labelKey: "settings.nav.account", icon: UsersIcon },
        { id: "notifications", labelKey: "settings.nav.notifications", icon: BellIcon },
        { id: "security", labelKey: "settings.nav.security", icon: ShieldIcon },
        { id: "license", labelKey: "settings.nav.license", icon: KeyRoundIcon },
        { id: "integrations", labelKey: "settings.nav.integrations", icon: BoltIcon },
        { id: "migration", labelKey: "settings.nav.migration", icon: DownloadIcon },
        { id: "appearance", labelKey: "settings.nav.appearance", icon: SunIcon },
    ];

    const advancedNavAll: Array<{ id: SettingsSection; labelKey: string; icon: FC<{ size?: number }> }> = [
        { id: "workflows", labelKey: "settings.nav.workflows", icon: SlidersHorizontalIcon },
        { id: "system", labelKey: "settings.nav.system", icon: SettingsIcon },
        { id: "about", labelKey: "settings.nav.about", icon: InfoIcon },
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
    }, [activeSection, session?.role, session?.permission_overrides, primaryNav, advancedNav, setSection, canSettingsSection]);

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
                                    <Icon size={ICON_SIZE_LG} aria-hidden />
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
                                    <Icon size={ICON_SIZE_LG} aria-hidden />
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
                    {canSettingsSection(activeSection) && activeSection === "practice" ? (
                        <SettingsPracticeSection
                            sessionUserId={session?.user_id}
                            onOpenWorkflows={() => setSection("workflows")}
                            canEditPractice={canOpsSystem}
                        />
                    ) : null}

                    {canSettingsSection(activeSection) && activeSection === "account" ? (
                        <SettingsAccountSection
                            onOpenPasswordDialog={() => setPwDialogOpen(true)}
                            passwordChangedTick={pwAgeTick}
                        />
                    ) : null}

                    {canSettingsSection(activeSection) && activeSection === "notifications" ? (
                        <SettingsNotificationsSection
                            notifications={notifications}
                            portalFlags={portalFlags}
                            onPersistClient={persistClientSilent}
                        />
                    ) : null}

                    {canSettingsSection(activeSection) && activeSection === "security" ? (
                        <SettingsSecuritySection
                            security={security}
                            onPersistClient={persistClientSilent}
                        />
                    ) : null}

                    {canSettingsSection(activeSection) && activeSection === "license" ? (
                        <SettingsLicenseSection
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

                    {canSettingsSection(activeSection) && activeSection === "integrations" ? (
                        <SettingsIntegrationsSection
                            portalIntegrations={portalIntegrations}
                            integrations={integrations}
                            onPersistClient={persistClientSilent}
                        />
                    ) : null}

                    {canSettingsSection(activeSection) && activeSection === "migration" ? (
                        <SettingsMigrationSection canMigration={canMigration} />
                    ) : null}

                    {canSettingsSection(activeSection) && activeSection === "appearance" ? (
                        <SettingsAppearanceSection
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

                    {canSettingsSection(activeSection) && activeSection === "workflows" ? (
                        <SettingsWorkflowsSection
                            prefs={prefs}
                            prefsDirty={prefsDirty}
                            onPrefsChange={setPrefs}
                            onPrefsDirty={() => setPrefsDirty(true)}
                            onSavePrefs={savePrefs}
                            workflows={wf}
                            searchPrefs={searchPrefs}
                            onPersistClient={persistClientSilent}
                            role={session?.role}
                        />
                    ) : null}

                    {canSettingsSection(activeSection) && activeSection === "system" ? (
                        <SettingsSystemSection canOpsSystem={canLanHost} />
                    ) : null}

                    {canSettingsSection(activeSection) && activeSection === "about" ? (
                        <SettingsAboutSection />
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
