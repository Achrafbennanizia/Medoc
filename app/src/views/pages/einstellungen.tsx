import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ChangeEvent, type FC, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../../models/store/auth-store";
import { useUiPreferencesStore } from "../../models/store/ui-preferences-store";
import {
    attachPaymentMethod,
    changePassword,
    checkForUpdates,
    companyPortalBillingPortalUrl,
    companyPortalFetchFeatureFlags,
    companyPortalFetchIntegrations,
    companyPortalFetchSummary,
    createBackup,
    currentAppVersion,
    getPerfThresholdMs,
    listMyDeviceSessions,
    openSubscriptionPortal,
    revokeMyOtherDeviceSessions,
    setPerfThresholdMs,
    systemHealthCheck,
    type DeviceSessionRow,
    type HealthCheck,
    type LicenseStatus,
    verifyLicense,
} from "@/controllers/settings-page.controller";
import { errorMessage } from "../../lib/utils";
import { useLocale } from "../../lib/i18n";
import {
    DEFAULT_CLIENT_SETTINGS,
    loadClientSettings,
    mergeClientSettingsPatch,
    saveClientSettings,
    applyAppearanceFromSettings,
    normalizeColorScheme,
    resolveAppearanceTheme,
    type ClientSettingsV1,
    type FontStackId,
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
import {
    buildInvoiceHeaderAddressLines,
    getInvoicePraxisFromStorage,
    hydrateInvoicePraxisFromAppKv,
    isValidPraxisDigitId,
    isValidPraxisIban,
    praxisRechnungPflichtMissing,
    saveInvoicePraxisToStorage,
    syncInvoicePraxisToAppKv,
    type InvoicePraxis,
} from "../../lib/invoice-leistung";
import {
    loadPraxisHeaderPrivacy,
    savePraxisHeaderPrivacy,
    maskPraxisExportToken,
    type PraxisHeaderPrivacyKey,
    type PraxisHeaderPrivacyV1,
} from "../../lib/praxis-header-privacy";
import { allowed, parseRole, type Role } from "@/lib/rbac";
import { getAppKv, setAppKv } from "@/controllers/settings-page.controller";
import { persistAutocompleteSuggestionsToPraxisKv } from "@/lib/praxis-search-prefs-sync";
import { getOwnProfile, updateOwnProfile, type OwnProfileDto } from "@/controllers/personal.controller";
import { Button } from "../components/ui/button";
import { Input, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { Dialog } from "../components/ui/dialog";
import { EinstellungenExportDruckSection } from "./einstellungen-export-druck";
import { EinstellungenPraxisBillingSection } from "./einstellungen-praxis-billing";
import { EinstellungenCompanyPortalSection } from "./einstellungen-company-portal-section";
import { EinstellungenLanHostSection } from "./einstellungen-lan-host";
import { ACCENT_HINTS, ACCENT_LABELS, ACCENT_ORDER, accentColorCircle, normalizeAccentId, type AccentId } from "../../lib/accent-preset";
import {
    BellIcon,
    BoltIcon,
    ChevronRightIcon,
    DownloadIcon,
    ExportIcon,
    EyeIcon,
    EyeOffIcon,
    InfoIcon,
    KeyRoundIcon,
    SettingsIcon,
    ShieldIcon,
    SlidersHorizontalIcon,
    StethoscopeIcon,
    SunIcon,
    UploadCircleIcon,
    UsersIcon,
} from "@/lib/icons";

function formatEurFromCents(cents: unknown): string {
    const n = typeof cents === "number" ? cents : Number(cents);
    if (!Number.isFinite(n)) return "—";
    try {
        return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n / 100);
    } catch {
        return "—";
    }
}

function formatDeDateShort(iso: unknown): string {
    const s = typeof iso === "string" ? iso : "";
    if (!s.trim()) return "—";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString("de-DE");
}

function portalIntegrationPill(status: string | undefined): { className: string; label: string } {
    const s = (status ?? "").toLowerCase();
    if (s === "active" || s === "connected") return { className: "settings-pill-green", label: "Verbunden" };
    if (s === "beta") return { className: "settings-pill-blue", label: "Beta" };
    return { className: "settings-pill-gray", label: "Nicht verbunden" };
}

const LazyOpsPage = lazy(() => import("./ops").then((m) => ({ default: m.OpsPage })));

/** Zum Einbetten der Ops-Vorschau (vollständiger Inhalt — nur auf Wunsch). */
function SettingsEmbeddedShell({ children }: { children: ReactNode }) {
    return (
        <div style={{ marginTop: 12, border: "1px solid var(--line-strong)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
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

/** Kurzüberblick nur bei einspaltiger Einstellungen-Ansicht (s. CSS: .settings-page-breadcrumb). */
const SETTINGS_BREADCRUMB =
    "Praxis · Konto · Benachrichtigungen · Darstellung · Sicherheit · Lizenz — weitere unten in der Liste";

const PW_CHANGED_LS = "medoc-settings-pw-changed-at-ms";

function passwordChangedDaysAgo(): number | null {
    try {
        const raw = localStorage.getItem(PW_CHANGED_LS);
        if (!raw) return null;
        const ms = Number.parseInt(raw, 10);
        if (!Number.isFinite(ms)) return null;
        return Math.max(0, Math.floor((Date.now() - ms) / 86400000));
    } catch {
        return null;
    }
}

function formatAddrOneLine(addr: string): string {
    return addr
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .join(", ");
}

function rolePresentation(rolle: string | undefined): { line: string; badge: string } {
    const r = parseRole(rolle);
    const map: Record<Role, { line: string; badge: string }> = {
        ARZT: { line: "Behandelnde:r · Vollzugriff", badge: "Admin" },
        REZEPTION: { line: "Empfang · Termine & Verwaltung", badge: "Team" },
        STEUERBERATER: { line: "Auswertung · eingeschränkt", badge: "Berater" },
        PHARMABERATER: { line: "Bestellwesen · eingeschränkt", badge: "Berater" },
    };
    if (r && map[r]) return map[r];
    return { line: rolle ?? "—", badge: "—" };
}

function SettingsSwitch({
    checked,
    onChange,
    ariaLabel,
    disabled,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    ariaLabel: string;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            className={`settings-switch${checked ? " settings-switch--on" : ""}`}
            onClick={() => {
                if (disabled) return;
                onChange(!checked);
            }}
        >
            <span className="settings-switch__thumb" aria-hidden />
        </button>
    );
}

type SettingsSection =
    | "praxis"
    | "konto"
    | "benachrichtigungen"
    | "sicherheit"
    | "lizenz"
    | "integrationen"
    | "migration"
    | "darstellung"
    | "arbeitsablaeufe"
    | "exportDruck"
    | "system"
    | "ueber";

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
    exportDruck: "export",
    system: "system",
    ueber: "ueber",
};

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
    const setSession = useAuthStore((s) => s.setSession);
    const locale = useLocale((s) => s.locale);
    const setLocale = useLocale((s) => s.setLocale);
    const toast = useToastStore((s) => s.add);
    const role = parseRole(session?.rolle);
    const canMigration = role != null && allowed("ops.migration", role);
    const canLanHost = role != null && allowed("ops.system", role);

    const hydrateConfirmations = useUiPreferencesStore((s) => s.hydrate);
    const confirmations = useUiPreferencesStore((s) => s.confirmations);
    const hydratedUi = useUiPreferencesStore((s) => s.hydrated);
    const setDefaultConfirmationMode = useUiPreferencesStore((s) => s.setDefaultConfirmationMode);
    const setAreaConfirmationOverride = useUiPreferencesStore((s) => s.setAreaConfirmationOverride);

    const [activeSection, setActiveSection] = useState<SettingsSection>("praxis");
    const [pwAgeTick, setPwAgeTick] = useState(0);
    const [editPraxisName, setEditPraxisName] = useState(false);
    const [draftPraxisName, setDraftPraxisName] = useState("");
    const [editPraxisAddr, setEditPraxisAddr] = useState(false);
    const [draftPraxisAddr, setDraftPraxisAddr] = useState("");
    const [editPraxisOeffnungszeiten, setEditPraxisOeffnungszeiten] = useState(false);
    const [draftPraxisOeffnungszeiten, setDraftPraxisOeffnungszeiten] = useState("");
    const [editPraxisKv, setEditPraxisKv] = useState(false);
    const [draftPraxisKv, setDraftPraxisKv] = useState("");
    const [editPraxisExtra, setEditPraxisExtra] = useState(false);
    const [praxisExtraSnapshot, setPraxisExtraSnapshot] = useState<InvoicePraxis | null>(null);
    const [editPraxisBilling, setEditPraxisBilling] = useState(false);
    const [praxisBillingSnapshot, setPraxisBillingSnapshot] = useState<InvoicePraxis | null>(null);
    const [logoBusy, setLogoBusy] = useState(false);
    const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
    const [client, setClient] = useState<ClientSettingsV1>(() => loadClientSettings());

    const [praxis, setPraxis] = useState<InvoicePraxis>(() => getInvoicePraxisFromStorage());

    const [praef, setPraef] = useState<PraxisPraeferenzen>(() => ({ ...DEFAULT_PRAXIS_PRAEFERENZEN }));
    const [praefDirty, setPraefDirty] = useState(false);

    const [oldPw, setOldPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [pwBusy, setPwBusy] = useState(false);
    const [pwDialogOpen, setPwDialogOpen] = useState(false);

    const [ownProfile, setOwnProfile] = useState<OwnProfileDto | null>(null);
    const [ownProfileLoadError, setOwnProfileLoadError] = useState<string | null>(null);
    const [kontoProfileLoading, setKontoProfileLoading] = useState(false);
    const [editKontoName, setEditKontoName] = useState(false);
    const [editKontoEmail, setEditKontoEmail] = useState(false);
    const [editKontoTelefon, setEditKontoTelefon] = useState(false);
    const [draftKontoName, setDraftKontoName] = useState("");
    const [draftKontoEmail, setDraftKontoEmail] = useState("");
    const [draftKontoTelefon, setDraftKontoTelefon] = useState("");
    const [kontoSaveNameBusy, setKontoSaveNameBusy] = useState(false);
    const [kontoSaveEmailBusy, setKontoSaveEmailBusy] = useState(false);
    const [kontoSaveTelefonBusy, setKontoSaveTelefonBusy] = useState(false);

    const [licenseToken, setLicenseToken] = useState("");
    const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
    const [licBusy, setLicBusy] = useState(false);
    const [appVersion, setAppVersion] = useState<string>("…");
    const [updateBusy, setUpdateBusy] = useState(false);
    const [paymentToken, setPaymentToken] = useState("");
    const [paymentBusy, setPaymentBusy] = useState(false);

    const [backupBusy, setBackupBusy] = useState(false);
    const [healthBusy, setHealthBusy] = useState(false);
    const [healthLast, setHealthLast] = useState<HealthCheck | null>(null);

    const [perfMs, setPerfMs] = useState<string>("");
    const [perfBusy, setPerfBusy] = useState(false);

    const [opsEmbed, setOpsEmbed] = useState(false);
    const [photoViewerApps, setPhotoViewerApps] = useState<DetectedPhotoViewerApp[]>([]);
    const [aboutExpanded, setAboutExpanded] = useState(false);

    const [portalSummary, setPortalSummary] = useState<Record<string, unknown> | null>(null);
    const [portalIntegrations, setPortalIntegrations] = useState<Record<string, unknown> | null>(null);
    const [portalFlags, setPortalFlags] = useState<Record<string, unknown> | null>(null);
    const [portalFetchBusy, setPortalFetchBusy] = useState(false);
    const [deviceSessions, setDeviceSessions] = useState<DeviceSessionRow[]>([]);
    const [deviceSessionsBusy, setDeviceSessionsBusy] = useState(false);
    const [revokeOtherBusy, setRevokeOtherBusy] = useState(false);

    useEffect(() => {
        if (activeSection !== "konto" || !session?.user_id) return;
        let cancelled = false;
        setOwnProfileLoadError(null);
        setKontoProfileLoading(true);
        void getOwnProfile()
            .then((p) => {
                if (cancelled) return;
                setOwnProfile(p);
                setDraftKontoName(p.name);
                setDraftKontoEmail(p.email);
                setDraftKontoTelefon(p.telefon ?? "");
                setEditKontoName(false);
                setEditKontoEmail(false);
                setEditKontoTelefon(false);
            })
            .catch((e) => {
                if (!cancelled) setOwnProfileLoadError(errorMessage(e));
            })
            .finally(() => {
                if (!cancelled) setKontoProfileLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [activeSection, session?.user_id]);

    useEffect(() => {
        if (searchParams.get("tab") === "hilfe") {
            setSearchParams({}, { replace: true });
            navigate("/hilfe", { replace: true });
        }
    }, [searchParams, setSearchParams, navigate]);

    useEffect(() => {
        const t = searchParams.get("tab");
        if (!t) return;
        const hit = (Object.keys(TAB_QUERY) as SettingsSection[]).find((k) => TAB_QUERY[k] === t);
        if (hit) setActiveSection(hit);
    }, [searchParams]);

    useEffect(() => {
        let c = false;
        void (async () => {
            try {
                const raw = await getAppKv("praxis.logo.v1");
                if (c || !raw) return;
                const j = JSON.parse(raw) as { mime?: string; data?: string };
                if (j.mime && j.data) setLogoPreviewUrl(`data:${j.mime};base64,${j.data}`);
            } catch {
                /* Web / fehlend */
            }
        })();
        return () => {
            c = true;
        };
    }, []);

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

    useEffect(() => {
        const editingPraxis =
            editPraxisName ||
            editPraxisAddr ||
            editPraxisOeffnungszeiten ||
            editPraxisKv ||
            editPraxisExtra ||
            editPraxisBilling;
        if (activeSection !== "praxis" || !session?.user_id || editingPraxis) return;
        let cancelled = false;
        void hydrateInvoicePraxisFromAppKv().then((fromKv) => {
            if (cancelled || !fromKv) return;
            setPraxis(fromKv);
            setDraftPraxisName(fromKv.name);
            setDraftPraxisAddr(fromKv.addr);
            setDraftPraxisOeffnungszeiten(fromKv.oeffnungszeiten ?? "");
            setDraftPraxisKv(fromKv.kv_nummer ?? "");
        });
        return () => {
            cancelled = true;
        };
    }, [
        activeSection,
        session?.user_id,
        editPraxisName,
        editPraxisAddr,
        editPraxisOeffnungszeiten,
        editPraxisKv,
        editPraxisExtra,
        editPraxisBilling,
    ]);

    useEffect(() => {
        if (!session?.user_id) return;
        const portalSections = new Set(["lizenz", "integrationen", "sicherheit", "benachrichtigungen"]);
        if (!portalSections.has(activeSection)) return;
        let cancelled = false;
        setPortalFetchBusy(true);
        void (async () => {
            try {
                if (activeSection === "lizenz") {
                    const sum = await companyPortalFetchSummary().catch(() => null);
                    if (!cancelled && sum && typeof sum === "object") setPortalSummary(sum as Record<string, unknown>);
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
                } else if (activeSection === "sicherheit") {
                    const [ff, integ] = await Promise.all([
                        companyPortalFetchFeatureFlags().catch(() => null),
                        companyPortalFetchIntegrations().catch(() => null),
                    ]);
                    if (!cancelled) {
                        if (ff && typeof ff === "object") setPortalFlags(ff as Record<string, unknown>);
                        if (integ && typeof integ === "object") setPortalIntegrations(integ as Record<string, unknown>);
                    }
                    setDeviceSessionsBusy(true);
                    const rows = await listMyDeviceSessions().catch(() => []);
                    if (!cancelled) setDeviceSessions(Array.isArray(rows) ? rows : []);
                    if (!cancelled) setDeviceSessionsBusy(false);
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

    function applyOwnProfileToStores(profile: OwnProfileDto) {
        setOwnProfile(profile);
        const cur = useAuthStore.getState().session;
        if (cur) {
            setSession({
                ...cur,
                name: profile.name,
                email: profile.email,
                rolle: profile.rolle,
            });
        }
    }

    async function saveKontoName() {
        const t = draftKontoName.trim();
        if (!t) {
            toast("Name ist erforderlich", "error");
            return;
        }
        setKontoSaveNameBusy(true);
        try {
            const p = await updateOwnProfile({ name: t });
            applyOwnProfileToStores(p);
            toast("Name gespeichert (Praxis-Datenbank)", "success");
            setEditKontoName(false);
        } catch (e) {
            toast(`Speichern fehlgeschlagen: ${errorMessage(e)}`, "error");
        } finally {
            setKontoSaveNameBusy(false);
        }
    }

    async function saveKontoEmail() {
        const t = draftKontoEmail.trim();
        if (!t) {
            toast("E-Mail ist erforderlich", "error");
            return;
        }
        setKontoSaveEmailBusy(true);
        try {
            const p = await updateOwnProfile({ email: t });
            applyOwnProfileToStores(p);
            toast("E-Mail gespeichert (Praxis-Datenbank)", "success");
            setEditKontoEmail(false);
        } catch (e) {
            toast(`Speichern fehlgeschlagen: ${errorMessage(e)}`, "error");
        } finally {
            setKontoSaveEmailBusy(false);
        }
    }

    async function saveKontoTelefon() {
        setKontoSaveTelefonBusy(true);
        try {
            const p = await updateOwnProfile({ telefon: draftKontoTelefon.trim() });
            applyOwnProfileToStores(p);
            toast("Telefon gespeichert (Praxis-Datenbank)", "success");
            setEditKontoTelefon(false);
        } catch (e) {
            toast(`Speichern fehlgeschlagen: ${errorMessage(e)}`, "error");
        } finally {
            setKontoSaveTelefonBusy(false);
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

    const savePraef = async () => {
        try {
            await savePraxisPraeferenzen(praef);
            setPraefDirty(false);
            toast("Termin-Präferenzen gespeichert (Praxis-weit in der Datenbank)", "success");
        } catch (e) {
            toast(`Speichern fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    function applyPraxisPatch(patch: Partial<InvoicePraxis>) {
        setPraxis((p) => {
            const next = { ...p, ...patch };
            saveInvoicePraxisToStorage(next);
            void syncInvoicePraxisToAppKv(next).catch(() => {
                /* offline / Web */
            });
            return next;
        });
    }

    function savePraxisName() {
        const t = draftPraxisName.trim();
        if (!t) {
            toast("Praxisname erforderlich", "error");
            return;
        }
        applyPraxisPatch({ name: t });
        toast("Praxisname gespeichert", "success");
        setEditPraxisName(false);
    }

    function savePraxisAddr() {
        const t = draftPraxisAddr.trim();
        if (!t) {
            toast("Adresse erforderlich", "error");
            return;
        }
        applyPraxisPatch({ addr: draftPraxisAddr });
        toast("Adresse gespeichert", "success");
        setEditPraxisAddr(false);
    }

    function savePraxisOeffnungszeiten() {
        applyPraxisPatch({ oeffnungszeiten: draftPraxisOeffnungszeiten.trim() || undefined });
        toast("Öffnungszeiten gespeichert", "success");
        setEditPraxisOeffnungszeiten(false);
    }

    function savePraxisKv() {
        const t = draftPraxisKv.trim();
        if (!t) {
            toast("KV-Nummer erforderlich", "error");
            return;
        }
        applyPraxisPatch({ kv_nummer: t });
        toast("KV-Nummer gespeichert", "success");
        setEditPraxisKv(false);
    }

    function startEditPraxisExtra() {
        setPraxisExtraSnapshot({ ...praxis });
        setEditPraxisExtra(true);
    }

    function cancelPraxisExtra() {
        if (praxisExtraSnapshot) setPraxis(praxisExtraSnapshot);
        setEditPraxisExtra(false);
        setPraxisExtraSnapshot(null);
    }

    function savePraxisExtra() {
        saveInvoicePraxisToStorage(praxis);
        void syncInvoicePraxisToAppKv(praxis).catch(() => {
            /* offline / Web */
        });
        toast("Kontakt & Steuern gespeichert", "success");
        setEditPraxisExtra(false);
        setPraxisExtraSnapshot(null);
    }

    const praxisBillingIncomplete = useMemo(() => praxisRechnungPflichtMissing(praxis), [praxis]);

    function startEditPraxisBilling() {
        setPraxisBillingSnapshot({ ...praxis });
        setEditPraxisBilling(true);
    }

    function cancelPraxisBilling() {
        if (praxisBillingSnapshot) setPraxis(praxisBillingSnapshot);
        setEditPraxisBilling(false);
        setPraxisBillingSnapshot(null);
    }

    function savePraxisBilling() {
        const zanr = (praxis.zanr ?? "").trim();
        const bsnr = (praxis.bsnr ?? "").trim();
        const iban = (praxis.bankverbindung_iban ?? "").trim();
        if (zanr && !isValidPraxisDigitId(zanr)) {
            toast("ZANR: genau 9 Ziffern erforderlich", "error");
            return;
        }
        if (bsnr && !isValidPraxisDigitId(bsnr)) {
            toast("BSNR: genau 9 Ziffern erforderlich", "error");
            return;
        }
        if (iban && !isValidPraxisIban(iban)) {
            toast("IBAN: ungültiges Format (DE: DE + 20 Ziffern)", "error");
            return;
        }
        const zt = praxis.zahlungsziel_tage ?? 14;
        const next: InvoicePraxis = {
            ...praxis,
            zahlungsziel_tage: Number.isFinite(zt) && zt > 0 ? Math.round(zt) : 14,
            ust_befreiung_hinweis:
                (praxis.ust_befreiung_hinweis ?? "").trim() || "Umsatzsteuerbefreit gem. § 4 Nr. 14 UStG",
        };
        setPraxis(next);
        saveInvoicePraxisToStorage(next);
        void syncInvoicePraxisToAppKv(next).catch(() => {
            /* offline / Web */
        });
        toast("Rechnungs-Stammdaten gespeichert", "success");
        setEditPraxisBilling(false);
        setPraxisBillingSnapshot(null);
    }

    const refreshDeviceSessions = useCallback(async () => {
        try {
            setDeviceSessionsBusy(true);
            const rows = await listMyDeviceSessions();
            setDeviceSessions(Array.isArray(rows) ? rows : []);
        } catch {
            setDeviceSessions([]);
        } finally {
            setDeviceSessionsBusy(false);
        }
    }, []);

    const revokeOtherDeviceSessions = async () => {
        setRevokeOtherBusy(true);
        try {
            const n = await revokeMyOtherDeviceSessions();
            toast(`${n} andere Geräte abgemeldet`, "success");
            await refreshDeviceSessions();
        } catch (e) {
            toast(`Abmelden: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setRevokeOtherBusy(false);
        }
    };

    async function onPraxisLogoFile(e: ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        if (f.size > 750_000) {
            toast("Datei zu groß (max. ca. 750 KB)", "error");
            return;
        }
        setLogoBusy(true);
        try {
            const buf = await f.arrayBuffer();
            let bin = "";
            const bytes = new Uint8Array(buf);
            const chunk = 0x8000;
            for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
            const data = btoa(bin);
            const mime = f.type && f.type.startsWith("image/") ? f.type : "image/png";
            await setAppKv("praxis.logo.v1", JSON.stringify({ mime, data }));
            setLogoPreviewUrl(`data:${mime};base64,${data}`);
            toast("Logo gespeichert", "success");
        } catch (err) {
            toast(`Logo: ${err instanceof Error ? err.message : String(err)}`, "error");
        } finally {
            setLogoBusy(false);
        }
    }

    const rolePresent = useMemo(() => rolePresentation(session?.rolle), [session?.rolle]);
    const pwDays = useMemo(() => {
        void pwAgeTick;
        void pwDialogOpen;
        return passwordChangedDaysAgo();
    }, [pwAgeTick, pwDialogOpen]);

    const setSection = useCallback(
        (id: SettingsSection) => {
            setActiveSection(id);
            setSearchParams({ tab: TAB_QUERY[id] }, { replace: true });
        },
        [setSearchParams],
    );

    const primaryNav: Array<{ id: SettingsSection; label: string; icon: FC<{ size?: number }> }> = [
        { id: "praxis", label: "Praxis", icon: StethoscopeIcon },
        { id: "konto", label: "Konto", icon: UsersIcon },
        { id: "benachrichtigungen", label: "Benachrichtigungen", icon: BellIcon },
        { id: "sicherheit", label: "Sicherheit", icon: ShieldIcon },
        { id: "lizenz", label: "Lizenz & Abo", icon: KeyRoundIcon },
        { id: "integrationen", label: "Integrationen", icon: BoltIcon },
        { id: "migration", label: "Migration", icon: DownloadIcon },
        { id: "darstellung", label: "Darstellung", icon: SunIcon },
    ];

    const advancedNav: Array<{ id: SettingsSection; label: string; icon: FC<{ size?: number }> }> = [
        { id: "arbeitsablaeufe", label: "Arbeitsabläufe", icon: SlidersHorizontalIcon },
        { id: "exportDruck", label: "Export & Druck", icon: ExportIcon },
        { id: "system", label: "System", icon: SettingsIcon },
        { id: "ueber", label: "Über die Anwendung", icon: InfoIcon },
    ];

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
    const akteClient = client.akte ?? DEFAULT_CLIENT_SETTINGS.akte!;

    const colorSchemePref = normalizeColorScheme(appearance.colorScheme);
    const resolvedTheme = resolveAppearanceTheme(client);

    const cardReaderRemote = portalIntegrations?.card_reader as { status?: string; detail?: string } | undefined;
    const cardReaderPill = portalIntegrationPill(cardReaderRemote?.status);

    const photoAppSelectOptions = useMemo(() => {
        const opts = photoViewerAppOptionsForSelect(photoViewerApps);
        const cur = (akteClient.openImagesWithApp ?? "").trim();
        if (cur && cur !== OPEN_IMAGE_SYSTEM_ONLY && !opts.some((o) => o.value === cur)) {
            return [...opts, { value: cur, label: `Gespeichert: ${cur}` }];
        }
        return opts;
    }, [photoViewerApps, akteClient.openImagesWithApp]);

    const portalLicId =
        typeof portalSummary?.practice_slug === "string" && portalSummary.practice_slug.trim()
            ? `MD-PORTAL-${portalSummary.practice_slug.trim().toUpperCase()}`
            : "MD-PRO-DE-2026-0448-MR";
    const portalMaxUsers = typeof portalSummary?.max_users === "number" ? portalSummary.max_users : 8;
    const portalActiveUsers = typeof portalSummary?.active_users === "number" ? portalSummary.active_users : 4;
    const userBarPct = portalMaxUsers > 0 ? Math.min(100, Math.round((portalActiveUsers / portalMaxUsers) * 100)) : 50;
    const portalStorageGb = typeof portalSummary?.storage_gb === "number" ? portalSummary.storage_gb : 100;
    const portalStorageUsed = typeof portalSummary?.storage_used_gb === "number" ? portalSummary.storage_used_gb : 12.4;
    const storageBarPct = portalStorageGb > 0 ? Math.min(100, Math.round((portalStorageUsed / portalStorageGb) * 100)) : 12;
    const erUsed = typeof portalSummary?.erezept_month_used === "number" ? portalSummary.erezept_month_used : 142;
    const erQuota = typeof portalSummary?.erezept_month_quota === "number" ? portalSummary.erezept_month_quota : 0;
    const erLabel = erQuota > 0 ? `${erUsed} / ${erQuota}` : `${erUsed} / ∞`;
    const erBarPct = erQuota > 0 ? Math.min(100, Math.round((erUsed / erQuota) * 100)) : 8;

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
                    {activeSection === "praxis" ? (
                        <>
                            <section className="settings-subcard">
                                <div className="card-head">
                                    <div>
                                        <div className="card-title">Praxis</div>
                                        <p className="card-sub">Grunddaten · werden auf Rezepten und Rechnungen gedruckt</p>
                                    </div>
                                </div>
                                {praxisBillingIncomplete ? (
                                    <div
                                        className="card-pad"
                                        role="status"
                                        style={{
                                            margin: "0 var(--card-pad-x) var(--space-3)",
                                            padding: "var(--space-3)",
                                            borderRadius: 8,
                                            background: "var(--warn-bg, #fff8e6)",
                                            border: "1px solid var(--warn-border, #e6c200)",
                                            color: "var(--text)",
                                            fontSize: "0.92rem",
                                        }}
                                    >
                                        <strong>Wichtig:</strong> Pflichtangaben für Rechnungen/Rezepte fehlen. Bitte füllen Sie
                                        Behandler-Name, ZANR, BSNR und IBAN aus.
                                    </div>
                                ) : null}
                                <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                                    <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                                        <span className="settings-field-label">
                                            <b>Praxisname</b>
                                            <span className="req" aria-hidden>
                                                *
                                            </span>
                                        </span>
                                        <div className="settings-row-muted">{(praxis.name ?? "").trim() || "—"}</div>
                                    </div>
                                    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                                        {editPraxisName ? (
                                            <>
                                                <Input
                                                    value={draftPraxisName}
                                                    onChange={(e) => setDraftPraxisName(e.target.value)}
                                                    aria-label="Praxisname"
                                                    style={{ minWidth: 160, maxWidth: 280 }}
                                                />
                                                <Button type="button" onClick={() => void savePraxisName()}>Speichern</Button>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={() => {
                                                        setDraftPraxisName(praxis.name);
                                                        setEditPraxisName(false);
                                                    }}
                                                >
                                                    Abbrechen
                                                </Button>
                                            </>
                                        ) : (
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={() => {
                                                    setDraftPraxisName(praxis.name);
                                                    setEditPraxisName(true);
                                                }}
                                            >
                                                Bearbeiten
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12, flexDirection: "column" }}>
                                    <div className="row" style={{ width: "100%", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
                                        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                                            <span className="settings-field-label">
                                                <b>Adresse</b>
                                                <span className="req" aria-hidden>
                                                    *
                                                </span>
                                            </span>
                                            <div className="settings-row-muted">{formatAddrOneLine(praxis.addr) || "—"}</div>
                                        </div>
                                        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                                            {editPraxisAddr ? (
                                                <>
                                                    <Button type="button" onClick={() => void savePraxisAddr()}>Speichern</Button>
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        onClick={() => {
                                                            setDraftPraxisAddr(praxis.addr);
                                                            setEditPraxisAddr(false);
                                                        }}
                                                    >
                                                        Abbrechen
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={() => {
                                                        setDraftPraxisAddr(praxis.addr);
                                                        setEditPraxisAddr(true);
                                                    }}
                                                >
                                                    Bearbeiten
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    {editPraxisAddr ? (
                                        <PraxisAddressArea label="Adresse bearbeiten" value={draftPraxisAddr} onChange={setDraftPraxisAddr} />
                                    ) : null}
                                </div>
                                <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                                    <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                                        <b>Öffnungszeiten</b>
                                        <div className="settings-row-muted">{(praxis.oeffnungszeiten ?? "").trim() || "—"}</div>
                                    </div>
                                    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                                        {editPraxisOeffnungszeiten ? (
                                            <>
                                                <Input
                                                    value={draftPraxisOeffnungszeiten}
                                                    onChange={(e) => setDraftPraxisOeffnungszeiten(e.target.value)}
                                                    aria-label="Öffnungszeiten"
                                                    placeholder="z. B. Mo–Fr 08:00–18:00 · Sa 09:00–13:00"
                                                    style={{ minWidth: 160, maxWidth: 320 }}
                                                />
                                                <Button type="button" onClick={() => void savePraxisOeffnungszeiten()}>Speichern</Button>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={() => {
                                                        setDraftPraxisOeffnungszeiten(praxis.oeffnungszeiten ?? "");
                                                        setEditPraxisOeffnungszeiten(false);
                                                    }}
                                                >
                                                    Abbrechen
                                                </Button>
                                            </>
                                        ) : (
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={() => {
                                                    setDraftPraxisOeffnungszeiten(praxis.oeffnungszeiten ?? "");
                                                    setEditPraxisOeffnungszeiten(true);
                                                }}
                                            >
                                                Bearbeiten
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                                    <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                                        <span className="settings-field-label">
                                            <b>KV-Nummer</b>
                                            <span className="req" aria-hidden>
                                                *
                                            </span>
                                        </span>
                                        <div className="settings-row-muted">{(praxis.kv_nummer ?? "").trim() || "—"}</div>
                                    </div>
                                    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                                        {editPraxisKv ? (
                                            <>
                                                <Input
                                                    value={draftPraxisKv}
                                                    onChange={(e) => setDraftPraxisKv(e.target.value)}
                                                    aria-label="KV-Nummer"
                                                    style={{ minWidth: 160, maxWidth: 220 }}
                                                />
                                                <Button type="button" onClick={() => void savePraxisKv()}>Speichern</Button>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={() => {
                                                        setDraftPraxisKv(praxis.kv_nummer ?? "");
                                                        setEditPraxisKv(false);
                                                    }}
                                                >
                                                    Abbrechen
                                                </Button>
                                            </>
                                        ) : (
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={() => {
                                                    setDraftPraxisKv(praxis.kv_nummer ?? "");
                                                    setEditPraxisKv(true);
                                                }}
                                            >
                                                Bearbeiten
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="settings-row" style={{ alignItems: "center" }}>
                                    <div>
                                        <b>Logo</b>
                                        <div className="card-sub">Wird auf Dokumenten im PDF-Export verwendet</div>
                                    </div>
                                    <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                                        {logoPreviewUrl ? (
                                            <img src={logoPreviewUrl} alt="" style={{ height: 40, width: "auto", borderRadius: 8, border: "1px solid var(--line-strong)" }} />
                                        ) : null}
                                        <input id="praxis-logo-file" className="sr-only" type="file" accept="image/*" onChange={(e) => void onPraxisLogoFile(e)} />
                                        <Button type="button" variant="secondary" loading={logoBusy} disabled={logoBusy} onClick={() => document.getElementById("praxis-logo-file")?.click()}>
                                            <span className="row" style={{ gap: 8, alignItems: "center" }}>
                                                <UploadCircleIcon size={18} />
                                                Hochladen
                                            </span>
                                        </Button>
                                    </div>
                                </div>
                                <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                                    <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                                        <b>Kontakt, Web &amp; Steuern</b>
                                        <div className="settings-row-muted">Telefon, E-Mail, USt-IdNr. … für PDF-Kopf</div>
                                    </div>
                                    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                                        {editPraxisExtra ? (
                                            <>
                                                <Button type="button" onClick={() => void savePraxisExtra()}>Speichern</Button>
                                                <Button type="button" variant="secondary" onClick={() => void cancelPraxisExtra()}>
                                                    Abbrechen
                                                </Button>
                                            </>
                                        ) : (
                                            <Button type="button" variant="secondary" onClick={() => void startEditPraxisExtra()}>
                                                Bearbeiten
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                {editPraxisExtra ? (
                                    <div className="card-pad" style={{ borderTop: "1px solid var(--line-strong)", paddingTop: "var(--space-3)" }}>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <Input
                                                id="px-tel"
                                                label="Telefon"
                                                type="tel"
                                                value={praxis.telefon ?? ""}
                                                onChange={(e) => setPraxis((p) => ({ ...p, telefon: e.target.value }))}
                                            />
                                            <Input id="px-fax" label="Fax" value={praxis.fax ?? ""} onChange={(e) => setPraxis((p) => ({ ...p, fax: e.target.value }))} />
                                            <Input
                                                id="px-em"
                                                label="E-Mail"
                                                type="email"
                                                value={praxis.email ?? ""}
                                                onChange={(e) => setPraxis((p) => ({ ...p, email: e.target.value }))}
                                            />
                                            <Input id="px-web" label="Webseite" type="url" value={praxis.web ?? ""} onChange={(e) => setPraxis((p) => ({ ...p, web: e.target.value }))} />
                                            <Input id="px-ust" label="USt-IdNr." value={praxis.ust_id ?? ""} onChange={(e) => setPraxis((p) => ({ ...p, ust_id: e.target.value }))} />
                                            <Input id="px-st" label="Steuernummer" value={praxis.steuernummer ?? ""} onChange={(e) => setPraxis((p) => ({ ...p, steuernummer: e.target.value }))} />
                                        </div>
                                    </div>
                                ) : null}
                                <EinstellungenPraxisBillingSection
                                    praxis={praxis}
                                    editing={editPraxisBilling}
                                    onStartEdit={startEditPraxisBilling}
                                    onCancel={cancelPraxisBilling}
                                    onSave={savePraxisBilling}
                                    onChange={(patch) => setPraxis((p) => ({ ...p, ...patch }))}
                                />
                                <button type="button" className="settings-row-clickable" onClick={() => setSection("arbeitsablaeufe")}>
                                    <div>
                                        <b>Termine &amp; Kalender</b>
                                        <div className="settings-row-muted">Puffer, Erinnerungen, Standardansicht</div>
                                    </div>
                                    <span className="settings-chevron" aria-hidden>
                                        <ChevronRightIcon size={18} />
                                    </span>
                                </button>
                            </section>
                            <details className="settings-subcard">
                                <summary style={{ padding: "var(--space-4) var(--card-pad-x)", cursor: "pointer", fontWeight: 650, listStyle: "none" }} className="settings-details-summary">
                                    Briefkopf-Vorschau
                                </summary>
                                <div className="card-pad settings-praxis-body" style={{ borderTop: "1px solid var(--line-strong)", paddingTop: "var(--space-3)" }}>
                                    <PraxisBriefkopfPreview praxis={praxis} />
                                </div>
                            </details>
                        </>
                    ) : null}

                    {activeSection === "konto" ? (
                        <section className="settings-subcard">
                            <div className="card-head">
                                <div>
                                    <div className="card-title">Mein Konto</div>
                                    <div className="card-sub">
                                        {kontoProfileLoading
                                            ? "Profil wird geladen …"
                                            : ownProfileLoadError
                                              ? `Profil konnte nicht geladen werden: ${ownProfileLoadError}`
                                              : `${ownProfile?.name ?? session?.name ?? "—"}${ownProfile?.email || session?.email ? ` · ${ownProfile?.email ?? session?.email}` : ""}`}
                                    </div>
                                </div>
                            </div>
                            <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                                    <b>Name</b>
                                    <div className="settings-row-muted">{ownProfile?.name ?? session?.name ?? "—"}</div>
                                </div>
                                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                                    {editKontoName ? (
                                        <>
                                            <Input
                                                value={draftKontoName}
                                                onChange={(e) => setDraftKontoName(e.target.value)}
                                                aria-label="Name"
                                                autoComplete="name"
                                                disabled={kontoProfileLoading}
                                                style={{ minWidth: 160, maxWidth: 280 }}
                                            />
                                            <Button
                                                type="button"
                                                loading={kontoSaveNameBusy}
                                                disabled={kontoSaveNameBusy || kontoProfileLoading}
                                                onClick={() => void saveKontoName()}
                                            >
                                                Speichern
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                disabled={kontoSaveNameBusy}
                                                onClick={() => {
                                                    setDraftKontoName(ownProfile?.name ?? session?.name ?? "");
                                                    setEditKontoName(false);
                                                }}
                                            >
                                                Abbrechen
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            disabled={kontoProfileLoading || Boolean(ownProfileLoadError)}
                                            onClick={() => {
                                                setDraftKontoName(ownProfile?.name ?? session?.name ?? "");
                                                setEditKontoName(true);
                                            }}
                                        >
                                            Bearbeiten
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                                    <b>E-Mail</b>
                                    <div className="settings-row-muted">{ownProfile?.email ?? session?.email ?? "—"}</div>
                                </div>
                                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                                    {editKontoEmail ? (
                                        <>
                                            <Input
                                                type="email"
                                                value={draftKontoEmail}
                                                onChange={(e) => setDraftKontoEmail(e.target.value)}
                                                aria-label="E-Mail"
                                                autoComplete="email"
                                                disabled={kontoProfileLoading}
                                                style={{ minWidth: 160, maxWidth: 280 }}
                                            />
                                            <Button
                                                type="button"
                                                loading={kontoSaveEmailBusy}
                                                disabled={kontoSaveEmailBusy || kontoProfileLoading}
                                                onClick={() => void saveKontoEmail()}
                                            >
                                                Speichern
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                disabled={kontoSaveEmailBusy}
                                                onClick={() => {
                                                    setDraftKontoEmail(ownProfile?.email ?? session?.email ?? "");
                                                    setEditKontoEmail(false);
                                                }}
                                            >
                                                Abbrechen
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            disabled={kontoProfileLoading || Boolean(ownProfileLoadError)}
                                            onClick={() => {
                                                setDraftKontoEmail(ownProfile?.email ?? session?.email ?? "");
                                                setEditKontoEmail(true);
                                            }}
                                        >
                                            Bearbeiten
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                                    <b>Telefon</b>
                                    <div className="settings-row-muted">{(ownProfile?.telefon ?? "").trim() || "—"}</div>
                                </div>
                                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                                    {editKontoTelefon ? (
                                        <>
                                            <Input
                                                type="tel"
                                                value={draftKontoTelefon}
                                                onChange={(e) => setDraftKontoTelefon(e.target.value)}
                                                aria-label="Telefon"
                                                autoComplete="tel"
                                                disabled={kontoProfileLoading}
                                                style={{ minWidth: 160, maxWidth: 280 }}
                                            />
                                            <Button
                                                type="button"
                                                loading={kontoSaveTelefonBusy}
                                                disabled={kontoSaveTelefonBusy || kontoProfileLoading}
                                                onClick={() => void saveKontoTelefon()}
                                            >
                                                Speichern
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                disabled={kontoSaveTelefonBusy}
                                                onClick={() => {
                                                    setDraftKontoTelefon(ownProfile?.telefon ?? "");
                                                    setEditKontoTelefon(false);
                                                }}
                                            >
                                                Abbrechen
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            disabled={kontoProfileLoading || Boolean(ownProfileLoadError)}
                                            onClick={() => {
                                                setDraftKontoTelefon(ownProfile?.telefon ?? "");
                                                setEditKontoTelefon(true);
                                            }}
                                        >
                                            Bearbeiten
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="settings-row">
                                <div>
                                    <b>Rolle</b>
                                    <div className="settings-row-muted">{rolePresent.line}</div>
                                </div>
                                <span className="settings-pill-blue">{rolePresent.badge}</span>
                            </div>
                            <div className="settings-row">
                                <div>
                                    <b>Passwort</b>
                                    <div className="settings-row-muted">
                                        {pwDays != null ? `Zuletzt geändert vor ${pwDays} Tag${pwDays === 1 ? "" : "en"}` : "Zuletzt geändert — über „Ändern“ aktualisieren"}
                                    </div>
                                </div>
                                <Button variant="secondary" type="button" onClick={() => setPwDialogOpen(true)}>
                                    Ändern
                                </Button>
                            </div>
                            <div className="settings-row">
                                <div>
                                    <b>Abmelden</b>
                                    <div className="settings-row-muted">Sitzung beenden</div>
                                </div>
                                <Button type="button" variant="secondary" onClick={() => window.dispatchEvent(new Event("medoc-request-logout"))}>
                                    Abmelden…
                                </Button>
                            </div>
                        </section>
                    ) : null}

                    {activeSection === "benachrichtigungen" ? (
                        <section className="settings-subcard">
                            <div className="card-head">
                                <div>
                                    <div className="card-title">Benachrichtigungen</div>
                                    <div className="card-sub">Hinweise und Erinnerungen in der App</div>
                                </div>
                            </div>
                            <div className="settings-row">
                                <div>
                                    <b>Push-Benachrichtigungen</b>
                                    <div className="card-sub">Neue Freigaben, Termine, Bestellungen</div>
                                </div>
                                <SettingsSwitch
                                    ariaLabel="Push-Benachrichtigungen"
                                    checked={notifications.push !== false}
                                    onChange={() =>
                                        persistClientSilent((c) => {
                                            const n = c.notifications ?? DEFAULT_CLIENT_SETTINGS.notifications!;
                                            const cur = n.push !== false;
                                            return mergeClientSettingsPatch(c, { notifications: { ...n, push: !cur } });
                                        })
                                    }
                                />
                            </div>
                            <div className="settings-row">
                                <div>
                                    <b>E-Mail-Zusammenfassung</b>
                                    <div className="card-sub">Täglich um 18:00</div>
                                </div>
                                <SettingsSwitch
                                    ariaLabel="E-Mail-Zusammenfassung"
                                    checked={notifications.emailSummary !== false}
                                    onChange={() =>
                                        persistClientSilent((c) => {
                                            const n = c.notifications ?? DEFAULT_CLIENT_SETTINGS.notifications!;
                                            const cur = n.emailSummary !== false;
                                            return mergeClientSettingsPatch(c, { notifications: { ...n, emailSummary: !cur } });
                                        })
                                    }
                                />
                            </div>
                            <div className="settings-row">
                                <div>
                                    <b>Kritische Warnungen</b>
                                    <div className="card-sub">Lagerbestand, Freigaben über 24h</div>
                                </div>
                                <SettingsSwitch
                                    ariaLabel="Kritische Warnungen"
                                    checked={notifications.criticalWarnings !== false}
                                    onChange={() =>
                                        persistClientSilent((c) => {
                                            const n = c.notifications ?? DEFAULT_CLIENT_SETTINGS.notifications!;
                                            const cur = n.criticalWarnings !== false;
                                            return mergeClientSettingsPatch(c, { notifications: { ...n, criticalWarnings: !cur } });
                                        })
                                    }
                                />
                            </div>
                            <div className="settings-row">
                                <div>
                                    <b>Patienten-SMS (Erinnerungen)</b>
                                    <div className="card-sub">24h vor dem Termin</div>
                                </div>
                                <SettingsSwitch
                                    ariaLabel="Patienten-SMS"
                                    checked={notifications.patientSms === true}
                                    onChange={() =>
                                        persistClientSilent((c) => {
                                            const n = c.notifications ?? DEFAULT_CLIENT_SETTINGS.notifications!;
                                            const cur = n.patientSms === true;
                                            return mergeClientSettingsPatch(c, { notifications: { ...n, patientSms: !cur } });
                                        })
                                    }
                                />
                            </div>
                            {portalFlags && typeof portalFlags === "object" ? (
                                <div className="card-pad" style={{ borderTop: "1px solid var(--line-strong)", paddingTop: 12 }}>
                                    <div className="card-sub" style={{ margin: 0, fontSize: 12.5 }}>
                                        <b>Hersteller-Lieferung</b> (bei aktivem Hersteller-Portal): Push{" "}
                                        {portalFlags.notifications_push_delivery === true ? "live" : "aus"}, E-Mail-Digest{" "}
                                        {portalFlags.notifications_email_digest_delivery === true ? "live" : "aus"}, Patienten-SMS{" "}
                                        {portalFlags.notifications_patient_sms_delivery === true ? "live" : "aus"}.
                                    </div>
                                </div>
                            ) : null}
                        </section>
                    ) : null}

                    {activeSection === "sicherheit" ? (
                        <>
                            <section className="settings-subcard">
                                <div className="card-head">
                                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                                        <div>
                                            <div className="card-title">Sicherheit</div>
                                            <div className="card-sub">DSGVO-Status · Audit-Protokolle · Zugriffskontrolle</div>
                                        </div>
                                        <span className="settings-pill-green">Konform</span>
                                    </div>
                                </div>
                                <div className="settings-row">
                                    <div>
                                        <b>Zwei-Faktor-Authentifizierung (2FA)</b>
                                        <div className="card-sub">
                                            Per Authenticator-App · Umstellung mit IT abstimmen
                                            {portalFlags?.two_factor_auth_enforced === true
                                                ? " — Hersteller-Richtlinie: 2FA wird bei voller Portal-Anbindung empfohlen."
                                                : ""}
                                        </div>
                                    </div>
                                    <SettingsSwitch
                                        ariaLabel="2FA"
                                        checked={security.twoFactorEnabled !== false}
                                        onChange={() =>
                                            persistClientSilent((c) => {
                                                const s = c.security ?? DEFAULT_CLIENT_SETTINGS.security!;
                                                const cur = s.twoFactorEnabled !== false;
                                                return mergeClientSettingsPatch(c, { security: { ...s, twoFactorEnabled: !cur } });
                                            })
                                        }
                                    />
                                </div>
                                <div className="settings-row">
                                    <div>
                                        <b>Auto-Sperre nach Inaktivität</b>
                                        <div className="card-sub">
                                            {(security.idleLogoutMinutes ?? 0) > 0
                                                ? `Nach ${security.idleLogoutMinutes} Minuten — sperrt Arbeitsplatz & Akten`
                                                : "Aus — bei Bedarf Minuten wählen (Abschnitt System)"}
                                        </div>
                                    </div>
                                    <SettingsSwitch
                                        ariaLabel="Auto-Sperre"
                                        checked={(security.idleLogoutMinutes ?? 0) > 0}
                                        onChange={() =>
                                            persistClientSilent((c) => {
                                                const s = c.security ?? DEFAULT_CLIENT_SETTINGS.security!;
                                                const on = (s.idleLogoutMinutes ?? 0) > 0;
                                                return mergeClientSettingsPatch(c, {
                                                    security: { ...s, idleLogoutMinutes: on ? 0 : 5 },
                                                });
                                            })
                                        }
                                    />
                                </div>
                                <div className="settings-row">
                                    <div>
                                        <b>HBA / eGK Kartenleser</b>
                                        <div className="card-sub">
                                            {cardReaderRemote?.detail?.trim()
                                                ? cardReaderRemote.detail
                                                : "Orga 6141 · Terminal-ID 8800-4421 (Beispiel — Status vom Hersteller-Portal, wenn konfiguriert)"}
                                        </div>
                                    </div>
                                    <span className={cardReaderPill.className}>{cardReaderPill.label}</span>
                                </div>
                                <div className="settings-row">
                                    <div>
                                        <b>Audit-Protokoll</b>
                                        <div className="card-sub">
                                            {healthLast ? `Letzte 90 Tage · ${healthLast.audit_chain_ok ? "Kette intakt" : "Prüfung ausstehend"}` : "Letzte 90 Tage · Ereignisse"}
                                        </div>
                                    </div>
                                    <Link to="/audit" className="btn btn-subtle" style={{ whiteSpace: "nowrap" }}>
                                        Anzeigen
                                    </Link>
                                </div>
                                <div className="settings-row">
                                    <div>
                                        <b>Datenexport (DSGVO)</b>
                                        <div className="card-sub">Patientendaten auf Anfrage exportieren</div>
                                    </div>
                                    <Link to="/datenschutz" className="btn btn-subtle" style={{ whiteSpace: "nowrap" }}>
                                        Anfordern
                                    </Link>
                                </div>
                            </section>
                            <section className="settings-subcard settings-team-card">
                                <div className="card-head">
                                    <div>
                                        <div className="card-title">Team-Sitzungen</div>
                                        <div className="card-sub">
                                            {deviceSessionsBusy
                                                ? "Geräte werden geladen …"
                                                : "Aktive Anmeldungen dieses Benutzers (SQLite `device_session`)"}
                                        </div>
                                    </div>
                                </div>
                                {deviceSessions.length === 0 && !deviceSessionsBusy ? (
                                    <div className="card-pad" style={{ color: "var(--fg-3)", fontSize: 13 }}>
                                        Keine Einträge — nach erneutem Anmelden erscheint dieses Gerät hier, sobald die Datenbank die Sitzung speichert.
                                    </div>
                                ) : null}
                                {deviceSessions.map((row) => (
                                    <div key={row.id} className="settings-row" style={{ alignItems: "flex-start" }}>
                                        <span className={`settings-team-lock${row.is_current ? "" : " is-muted"}`} aria-hidden>
                                            <ShieldIcon size={18} />
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                                <b>{(row.device_label ?? "").trim() || "Gerät"}</b>
                                                {row.is_current ? <span className="settings-pill-green">Diese Sitzung</span> : null}
                                            </div>
                                            <div className="settings-team-meta">
                                                {(row.user_agent ?? "").slice(0, 120) || "—"} · zuletzt {row.last_seen_at}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div className="settings-row" style={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                                    <div className="settings-team-meta" style={{ flex: "1 1 200px" }}>
                                        Andere Geräte dieses Kontos abmelden (Passwort bleibt gültig).
                                    </div>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        loading={revokeOtherBusy}
                                        disabled={revokeOtherBusy || deviceSessionsBusy}
                                        onClick={() => void revokeOtherDeviceSessions()}
                                    >
                                        Andere abmelden
                                    </Button>
                                </div>
                            </section>
                        </>
                    ) : null}

                    {activeSection === "lizenz" ? (
                        <>
                            <section className="settings-subcard settings-license-hero-wrap" style={{ overflow: "hidden", padding: 0 }}>
                                <div className="settings-license-hero">
                                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                                        <span className="settings-pill-accent">{portalFetchBusy ? "…" : "Aktiv"}</span>
                                        <span style={{ fontSize: 12, color: "var(--fg-3)" }}>Ihr Plan</span>
                                    </div>
                                    <p style={{ margin: "12px 0 0", fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>
                                        {typeof portalSummary?.plan_name === "string" && portalSummary.plan_name.trim() ? (
                                            portalSummary.plan_name.trim()
                                        ) : (
                                            <>
                                                MeDoc Praxis <span style={{ color: "var(--accent)" }}>Pro</span>
                                            </>
                                        )}
                                    </p>
                                    <p className="card-sub" style={{ margin: "8px 0 0", maxWidth: "42rem" }}>
                                        {portalSummary
                                            ? `${typeof portalSummary.display_name === "string" ? portalSummary.display_name : "Praxis"} · bis zu ${portalMaxUsers} Behandler · Speicher bis ${portalStorageGb} GB · eRezept-Kontingent siehe unten`
                                            : "Bis zu 8 Behandler · Unbegrenzt Patienten · eRezept · DATEV-Export · Premium Support (Beispiel — mit Hersteller-Portal werden Live-Daten geladen)"}
                                    </p>
                                    <div className="settings-license-hero__grid">
                                        <div className="settings-license-metric">
                                            Monatsgebühr
                                            <strong>
                                                {portalSummary ? formatEurFromCents(portalSummary.monthly_fee_cents) : "€ 189,00"}
                                            </strong>
                                        </div>
                                        <div className="settings-license-metric">
                                            Nächste Abbuchung
                                            <strong>{portalSummary ? formatDeDateShort(portalSummary.next_billing_iso) : "01.05.2026"}</strong>
                                        </div>
                                        <div className="settings-license-metric">
                                            Zahlungsmethode
                                            <strong>{portalSummary ? "Im Abrechnungsportal" : "SEPA · · 4821"}</strong>
                                        </div>
                                    </div>
                                    <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onClick={async () => {
                                                try {
                                                    const url = await companyPortalBillingPortalUrl();
                                                    window.open(url, "_blank", "noopener,noreferrer");
                                                } catch {
                                                    toast("Hersteller-Portal nicht konfiguriert — Rechnungen ggf. im klassischen Abo-Portal.", "info");
                                                }
                                            }}
                                        >
                                            Rechnungen
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={async () => {
                                                const p = await openSubscriptionPortal();
                                                window.open(p.url, "_blank", "noopener,noreferrer");
                                            }}
                                        >
                                            Plan wechseln
                                        </Button>
                                    </div>
                                </div>
                            </section>
                            <section className="settings-subcard">
                                <div className="card-head">
                                    <div className="card-title">Nutzung diesen Monat</div>
                                </div>
                                <div className="card-pad" style={{ display: "grid", gap: 16 }}>
                                    <div>
                                        <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                                            <span>Aktive Behandler</span>
                                            <span style={{ fontWeight: 650 }}>
                                                {portalActiveUsers} / {portalMaxUsers}
                                            </span>
                                        </div>
                                        <div className="settings-progress" aria-hidden>
                                            <span style={{ width: `${userBarPct}%` }} />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                                            <span>Speicher</span>
                                            <span style={{ fontWeight: 650 }}>
                                                {portalStorageUsed} GB / {portalStorageGb} GB
                                            </span>
                                        </div>
                                        <div className="settings-progress" aria-hidden>
                                            <span style={{ width: `${storageBarPct}%` }} />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                                            <span>eRezepte / Monat</span>
                                            <span style={{ fontWeight: 650 }}>{erLabel}</span>
                                        </div>
                                        <div className="settings-progress" aria-hidden>
                                            <span style={{ width: `${erBarPct}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </section>
                            <section className="settings-subcard">
                                <div className="card-head">
                                    <div className="card-title">Lizenz-Details</div>
                                </div>
                                <div className="settings-row" style={{ alignItems: "flex-start" }}>
                                    <div>
                                        <b>Lizenznummer</b>
                                        <div className="settings-row-muted">{portalLicId}</div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                            void navigator.clipboard?.writeText(portalLicId).then(
                                                () => toast("Kopiert", "success"),
                                                () => toast("Kopieren nicht möglich", "error"),
                                            );
                                        }}
                                    >
                                        Kopieren
                                    </Button>
                                </div>
                                <div className="settings-row">
                                    <div>
                                        <b>KBV-Zulassung</b>
                                        <div className="settings-row-muted">Zugelassen bis 31.12.2027</div>
                                    </div>
                                    <span className="settings-pill-green">Aktiv</span>
                                </div>
                                <div className="settings-row">
                                    <div>
                                        <b>Support-Vertrag</b>
                                        <div className="settings-row-muted">Premium · 24/7 · Antwort unter 2h</div>
                                    </div>
                                    <span className="settings-chevron" aria-hidden>
                                        <ChevronRightIcon size={18} />
                                    </span>
                                </div>
                                <div className="card-pad" style={{ paddingTop: 0 }}>
                                    <Input id="lic-token-card" label="Lizenz-Token prüfen" value={licenseToken} onChange={(e) => setLicenseToken(e.target.value)} placeholder="Token einfügen" />
                                    {licenseStatus ? (
                                        <p style={{ color: licenseStatus.valid ? "var(--accent)" : "var(--red)", margin: "8px 0 0", fontSize: 13 }}>
                                            {licenseStatus.valid ? "Lizenz gültig" : `Ungültig: ${licenseStatus.reason ?? "Fehler"}`}
                                        </p>
                                    ) : null}
                                </div>
                            </section>
                        </>
                    ) : null}

                    {activeSection === "integrationen" ? (
                        <section className="settings-subcard">
                            <div className="card-head">
                                <div>
                                    <div className="card-title">Integrationen</div>
                                    <div className="card-sub">
                                        Anbindungen und Schnittstellen — Statuszeilen vom Hersteller-Portal, wenn unter System konfiguriert.
                                    </div>
                                </div>
                            </div>
                            {(() => {
                                const ep = portalIntegrations?.eprescription as { status?: string; detail?: string } | undefined;
                                const epP = portalIntegrationPill(ep?.status);
                                return (
                                    <div className="settings-row">
                                        <div>
                                            <b>eRezept (Gematik)</b>
                                            <div className="card-sub">{ep?.detail ?? "Status wird vom Hersteller-Portal geladen, sobald angebunden."}</div>
                                        </div>
                                        <span className={epP.className}>{epP.label}</span>
                                    </div>
                                );
                            })()}
                            <div className="settings-row">
                                <div>
                                    <b>DATEV</b>
                                    <div className="card-sub">
                                        Monatlicher Buchhaltungsexport
                                        {(() => {
                                            const d = portalIntegrations?.datev as { status?: string; detail?: string } | undefined;
                                            return d?.detail ? (
                                                <>
                                                    <br />
                                                    <span style={{ fontSize: 12, color: "var(--fg-3)" }}>Hersteller: {d.detail}</span>
                                                </>
                                            ) : null;
                                        })()}
                                    </div>
                                </div>
                                <SettingsSwitch
                                    ariaLabel="DATEV"
                                    checked={integrations.datev !== false}
                                    onChange={() =>
                                        persistClientSilent((c) => {
                                            const i = c.integrations ?? DEFAULT_CLIENT_SETTINGS.integrations!;
                                            const cur = i.datev !== false;
                                            return mergeClientSettingsPatch(c, { integrations: { ...i, datev: !cur } });
                                        })
                                    }
                                />
                            </div>
                            {(() => {
                                const dc = portalIntegrations?.doccheck_sso as { status?: string; detail?: string } | undefined;
                                const p = portalIntegrationPill(dc?.status);
                                return (
                                    <div className="settings-row">
                                        <div>
                                            <b>DocCheck SSO</b>
                                            <div className="card-sub">{dc?.detail ?? "Single Sign-On für Team"}</div>
                                        </div>
                                        <span className={p.className}>{p.label}</span>
                                    </div>
                                );
                            })()}
                            {(() => {
                                const tk = portalIntegrations?.kim_tk as { status?: string; detail?: string } | undefined;
                                const p = portalIntegrationPill(tk?.status);
                                return (
                                    <div className="settings-row">
                                        <div>
                                            <b>TK-Direktabrechnung</b>
                                            <div className="card-sub">{tk?.detail ?? "Kassenärztliche Abrechnung via KIM"}</div>
                                        </div>
                                        <span className={p.className}>{p.label}</span>
                                    </div>
                                );
                            })()}
                            {(() => {
                                const lab = portalIntegrations?.labor_dental_union as { status?: string; detail?: string } | undefined;
                                const p = portalIntegrationPill(lab?.status);
                                return (
                                    <div className="settings-row">
                                        <div>
                                            <b>Labor (Dental Union)</b>
                                            <div className="card-sub">{lab?.detail ?? "Auftragsweiterleitung"}</div>
                                        </div>
                                        <span className={p.className}>{p.label}</span>
                                    </div>
                                );
                            })()}
                        </section>
                    ) : null}

                    {activeSection === "migration" ? (
                        <section className="settings-subcard">
                            <div className="card-head">
                                <div>
                                    <div className="card-title">Migration</div>
                                    <div className="card-sub">Datenimport aus Fremdsystemen</div>
                                </div>
                            </div>
                            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <p className="card-sub" style={{ margin: 0 }}>
                                    Assistent für strukturierte Datenübernahme — nur mit entsprechender Berechtigung.
                                </p>
                                {canMigration ? (
                                    <Button type="button" onClick={() => navigate("/migration")}>
                                        Zur Datenmigration
                                    </Button>
                                ) : (
                                    <p className="card-sub" style={{ margin: 0 }}>
                                        Für diese Rolle nicht freigeschaltet.
                                    </p>
                                )}
                            </div>
                        </section>
                    ) : null}

                    {activeSection === "darstellung" ? (
                        <section className="settings-subcard settings-subcard--segment-safe">
                            <div className="card-head">
                                <div className="card-title">Darstellung</div>
                            </div>
                            <div className="settings-row settings-row--wrap">
                                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                                    <b>Erscheinungsbild</b>
                                    <div className="card-sub">
                                        {colorSchemePref === "system"
                                            ? "Folgt Hell/Dunkel der Systemeinstellung"
                                            : colorSchemePref === "dark"
                                              ? "Dunkle Oberfläche in der gesamten App"
                                              : "Helle Oberfläche"}
                                    </div>
                                </div>
                                <div className="settings-lang-seg" role="group" aria-label="Erscheinungsbild">
                                    <button
                                        type="button"
                                        className={`settings-lang-seg__btn${colorSchemePref === "light" ? " is-active" : ""}`}
                                        onClick={() =>
                                            persistClientSilent((c) => {
                                                const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                                return mergeClientSettingsPatch(c, { appearance: { ...a, colorScheme: "light" } });
                                            })
                                        }
                                    >
                                        Hell
                                    </button>
                                    <button
                                        type="button"
                                        className={`settings-lang-seg__btn${colorSchemePref === "dark" ? " is-active" : ""}`}
                                        onClick={() =>
                                            persistClientSilent((c) => {
                                                const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                                return mergeClientSettingsPatch(c, { appearance: { ...a, colorScheme: "dark" } });
                                            })
                                        }
                                    >
                                        Dunkel
                                    </button>
                                    <button
                                        type="button"
                                        className={`settings-lang-seg__btn${colorSchemePref === "system" ? " is-active" : ""}`}
                                        onClick={() =>
                                            persistClientSilent((c) => {
                                                const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                                return mergeClientSettingsPatch(c, { appearance: { ...a, colorScheme: "system" } });
                                            })
                                        }
                                    >
                                        System
                                    </button>
                                </div>
                            </div>
                            <div className="settings-row">
                                <div>
                                    <b>Dunkle Seitenleiste</b>
                                    <div className="card-sub">
                                        {resolvedTheme === "dark"
                                            ? "Bei dunklem Erscheinungsbild immer aktiv"
                                            : "Nur die linke Navigation dunkel darstellen"}
                                    </div>
                                </div>
                                <SettingsSwitch
                                    ariaLabel="Dunkle Seitenleiste"
                                    disabled={resolvedTheme === "dark"}
                                    checked={appearance.darkSidebar}
                                    onChange={() =>
                                        persistClientSilent((c) => {
                                            const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                            return mergeClientSettingsPatch(c, { appearance: { ...a, darkSidebar: !a.darkSidebar } });
                                        })
                                    }
                                />
                            </div>
                            <div className="settings-row settings-row--wrap">
                                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                                    <b>Systemschrift</b>
                                    <div className="card-sub">{fontStack === "system" ? "System · 14 pt" : "Inter · 14 pt"}</div>
                                </div>
                                <div className="settings-lang-seg" role="group" aria-label="Systemschrift">
                                    <button
                                        type="button"
                                        className={`settings-lang-seg__btn${fontStack === "inter" ? " is-active" : ""}`}
                                        onClick={() => {
                                            if (fontStack === "inter") return;
                                            persistClientSilent((c) => {
                                                const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                                return mergeClientSettingsPatch(c, { appearance: { ...a, fontStack: "inter" } });
                                            });
                                            toast("Schrift: Inter", "success");
                                        }}
                                    >
                                        Inter
                                    </button>
                                    <button
                                        type="button"
                                        className={`settings-lang-seg__btn${fontStack === "system" ? " is-active" : ""}`}
                                        onClick={() => {
                                            if (fontStack === "system") return;
                                            persistClientSilent((c) => {
                                                const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                                return mergeClientSettingsPatch(c, { appearance: { ...a, fontStack: "system" } });
                                            });
                                            toast("Schrift: System", "success");
                                        }}
                                    >
                                        System
                                    </button>
                                </div>
                            </div>
                            <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                                <div>
                                    <b>Dichte</b>
                                    <div className="card-sub">Gemütlich · Kompakt · Weit — aktuell {densityLabel}</div>
                                </div>
                                <div className="settings-density-seg" role="group" aria-label="Raster-Dichte" style={{ width: "100%", justifyContent: "stretch" }}>
                                    {(
                                        [
                                            { id: "cozy" as const, label: "Gemütlich" },
                                            { id: "compact" as const, label: "Kompakt" },
                                            { id: "spacious" as const, label: "Weit" },
                                        ] as const
                                    ).map((opt) => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            className={`settings-density-seg__btn${appearance.density === opt.id ? " is-active" : ""}`}
                                            style={{ flex: 1 }}
                                            onClick={() => {
                                                if (appearance.density === opt.id) return;
                                                persistClientSilent((c) => {
                                                    const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                                    return mergeClientSettingsPatch(c, { appearance: { ...a, density: opt.id } });
                                                });
                                                toast(`Dichte: ${opt.label}`, "info");
                                            }}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="settings-row">
                                <div>
                                    <b>Sprache</b>
                                    <div className="card-sub">Oberfläche</div>
                                </div>
                                <div className="settings-lang-seg" role="group" aria-label="Sprache">
                                    <button type="button" className={`settings-lang-seg__btn${locale === "de" ? " is-active" : ""}`} onClick={() => setLocale("de")}>
                                        DE
                                    </button>
                                    <button type="button" className={`settings-lang-seg__btn${locale === "en" ? " is-active" : ""}`} onClick={() => setLocale("en")}>
                                        EN
                                    </button>
                                </div>
                            </div>
                            <div className="settings-row settings-row--wrap settings-row--accent">
                                <div className="settings-row-clickable__label">
                                    <b>Akzentfarbe</b>
                                    <div className="settings-row-muted">
                                        {ACCENT_LABELS[accentPresetId]} · Buttons, Links und Fokus
                                    </div>
                                </div>
                                <div role="radiogroup" aria-label="Akzentfarbe" className="settings-accent-inline">
                                    {ACCENT_ORDER.map((id: AccentId) => (
                                        <button
                                            key={id}
                                            type="button"
                                            role="radio"
                                            aria-checked={accentPresetId === id}
                                            aria-label={`${ACCENT_LABELS[id]}: ${ACCENT_HINTS[id]}`}
                                            title={ACCENT_HINTS[id]}
                                            className={`settings-accent-inline__swatch${accentPresetId === id ? " is-selected" : ""}`}
                                            style={{ background: accentColorCircle(id) }}
                                            onClick={() => {
                                                if (accentPresetId === id) return;
                                                persistClientSilent((c) => {
                                                    const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                                    return mergeClientSettingsPatch(c, { appearance: { ...a, accentPreset: id } });
                                                });
                                                toast(`Akzent: ${ACCENT_LABELS[id]}`, "success");
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </section>
                    ) : null}

                    {activeSection === "arbeitsablaeufe" ? (
                        <section className="settings-subcard">
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
                                <label className="row" style={{ gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={praef.kalenderDragDropEnabled}
                                        onChange={(e) => {
                                            setPraef((p) => ({ ...p, kalenderDragDropEnabled: e.target.checked }));
                                            setPraefDirty(true);
                                        }}
                                        style={{ marginTop: 3 }}
                                    />
                                    <span>
                                        <span className="text-title" style={{ display: "block", fontSize: 14 }}>Kalender: Drag &amp; Drop (Termine)</span>
                                        <span className="card-sub" style={{ display: "block", marginTop: 4 }}>
                                            Tages- und Wochenansicht: Termine per Maus verschieben. Aus = nur öffnen und bearbeiten.
                                        </span>
                                    </span>
                                </label>
                                <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                                    <Button type="button" onClick={savePraef} disabled={!praefDirty}>Speichern</Button>
                                </div>

                                <div style={{ borderTop: "1px solid var(--line-strong)", paddingTop: 14 }}>
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

                                <div style={{ borderTop: "1px solid var(--line-strong)", paddingTop: 14 }}>
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

                                <div style={{ borderTop: "1px solid var(--line-strong)", paddingTop: 14 }}>
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

                                <div className="settings-row" style={{ marginTop: 10 }}>
                                    <div>
                                        <b>Autocomplete-Vorschläge</b>
                                        <div className="card-sub">
                                            „Meinten Sie …“ bei leerer Patientensuche und im Schnellzugriff (⌘K); nur lokale Schreibhilfe, keine Backend-Suche.
                                            Zustand wird in der Praxisdatenbank gespeichert und bei anderen Arbeitsplätzen nach Login übernommen.
                                        </div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={searchPrefs.autocompleteSuggestionsEnabled !== false}
                                        onChange={() =>
                                            persistClientSilent((c) => {
                                                const s = c.search ?? DEFAULT_CLIENT_SETTINGS.search!;
                                                const cur = s.autocompleteSuggestionsEnabled !== false;
                                                const next = !cur;
                                                void persistAutocompleteSuggestionsToPraxisKv(next).catch((e) => {
                                                    toast(
                                                        `Praxisdatenbank: Autocomplete-Einstellung nicht gespeichert (${errorMessage(e)}). Lokal weiter aktiv.`,
                                                        "warning",
                                                    );
                                                });
                                                return mergeClientSettingsPatch(c, {
                                                    search: { ...s, autocompleteSuggestionsEnabled: next },
                                                });
                                            })}
                                        aria-label="Autocomplete-Vorschläge"
                                    />
                                </div>

                                <div style={{ borderTop: "1px solid var(--line-strong)", paddingTop: 14 }}>
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
                        <section className="settings-subcard">
                            <div className="card-head">
                                <div>
                                    <div className="card-title">System</div>
                                    <div className="card-sub">Diagnose, Performance, Daten</div>
                                </div>
                            </div>
                            <div className="settings-row">
                                <div>
                                    <b>Benutzeravatar in der Kopfleiste</b>
                                    <div className="card-sub">Kreis mit Initialen rechts oben</div>
                                </div>
                                <SettingsSwitch
                                    ariaLabel="Benutzeravatar in der Kopfleiste"
                                    checked={appearance.showHeaderAvatar !== false}
                                    onChange={() =>
                                        persistClientSilent((c) => {
                                            const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                            const on = a.showHeaderAvatar !== false;
                                            return mergeClientSettingsPatch(c, { appearance: { ...a, showHeaderAvatar: on ? false : true } });
                                        })
                                    }
                                />
                            </div>
                            <div className="settings-row">
                                <div>
                                    <b>Tastenkürzel anzeigen</b>
                                    <div className="card-sub">z. B. ⌘K in der Suche</div>
                                </div>
                                <SettingsSwitch
                                    ariaLabel="Tastenkürzel anzeigen"
                                    checked={appearance.showKeyboardHints !== false}
                                    onChange={() =>
                                        persistClientSilent((c) => {
                                            const a = c.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!;
                                            const on = a.showKeyboardHints !== false;
                                            return mergeClientSettingsPatch(c, { appearance: { ...a, showKeyboardHints: on ? false : true } });
                                        })
                                    }
                                />
                            </div>
                            <div className="card-head" style={{ marginTop: 4 }}>
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
                            <div className="card-head" style={{ marginTop: 12 }}>
                                <div>
                                    <div className="card-title">Sitzung &amp; Diagnose</div>
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
                            {canLanHost ? <EinstellungenLanHostSection /> : null}
                            {canLanHost ? <EinstellungenCompanyPortalSection /> : null}
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
                                <Link to="/hilfe" className="btn btn-subtle">Hilfe</Link>
                                <Link to="/compliance" className="btn btn-subtle">Compliance</Link>
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
                        <section className="settings-subcard">
                            <div className="card-head"><div><div className="card-title">Über die Anwendung</div><div className="card-sub">Version, Lizenz, Drittanbieter</div></div></div>
                            <div className="settings-row"><div><b>App-Version</b><div className="card-sub">MeDoc {appVersion}</div></div><Button variant="ghost" type="button" onClick={() => void handleCheckUpdates()} disabled={updateBusy} loading={updateBusy}>Nach Updates suchen</Button></div>
                            <div className="settings-row" style={{ flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
                                <div>
                                    <b>Über &amp; Lizenzen</b>
                                    <div className="card-sub">Kurzinfo und Symbol-Bibliotheken</div>
                                </div>
                                <Button type="button" variant="secondary" onClick={() => setAboutExpanded((v) => !v)}>
                                    {aboutExpanded ? "Weniger anzeigen" : "Details anzeigen"}
                                </Button>
                            </div>
                            {aboutExpanded ? (
                                <div className="card-pad" style={{ borderTop: "1px solid var(--line-strong)", paddingTop: "var(--space-3)" }}>
                                    <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600 }}>MeDoc Praxisverwaltung</p>
                                    <p style={{ color: "var(--fg-3)", fontSize: 13.5, lineHeight: 1.55, margin: "0 0 16px" }}>
                                        Desktop-Anwendung für Termine, Patientenakten, Finanzen und Compliance — mit klarem Fokus auf
                                        Datenschutz und Nachvollziehbarkeit.
                                    </p>
                                    <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: 0 }}>
                                        Version <span className="font-mono">{appVersion}</span>
                                    </p>
                                    <p style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.5, margin: "12px 0 0" }}>
                                        Symbole:{" "}
                                        <a href="https://lucide.dev" target="_blank" rel="noopener noreferrer">
                                            Lucide
                                        </a>{" "}
                                        (ISC License).
                                    </p>
                                </div>
                            ) : null}
                            <div className="settings-highlight-card settings-lic-promo">
                                <div className="row settings-highlight-head" style={{ justifyContent: "space-between" }}>
                                    <span className="pill accent">Lizenz</span>
                                    <span className="settings-lic-promo__meta">Token prüfen</span>
                                </div>
                                <p className="card-sub" style={{ margin: "8px 0 0" }}>Lizenz-Token zur Prüfung eingeben.</p>
                                <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                                    <Button
                                        variant="secondary"
                                        type="button"
                                        onClick={() => void handleVerifyLicense()}
                                        disabled={licBusy || !licenseToken.trim()}
                                        loading={licBusy}
                                    >
                                        Jetzt prüfen
                                    </Button>
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

        </div>
    );
}

function PraxisAddressArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    const id = "praxis-addr";
    return (
        <label className="input-wrap" htmlFor={id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="input-label">{label}</span>
            <textarea
                id={id}
                className="input-edit settings-praxis-addr-ta"
                rows={5}
                autoComplete="street-address"
                spellCheck={false}
                placeholder={"Straße Hausnummer\nPLZ Ort"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            <p className="card-sub settings-praxis-field-hint" style={{ margin: 0 }}>
                Eine Zeile pro Zeile wie auf dem Briefpapier; Leerzeilen mit Enter.
            </p>
        </label>
    );
}

/** Eine Zeile in der Briefkopf-Vorschau: Wert per Auge maskierbar — dieselbe Einstellung wirkt auf Export & Druck. */
function PraxisPreviewRevealRow({
    label,
    value,
    revealed,
    onToggle,
    dense,
}: {
    label: string;
    value: string;
    revealed: boolean;
    onToggle: () => void;
    dense?: boolean;
}) {
    const v = value.trim();
    if (!v) return null;
    const title = revealed ? `${label} in der Vorschau ausblenden` : `${label} in der Vorschau einblenden`;
    return (
        <div
            className={`settings-praxis-preview__reveal-row${dense ? " settings-praxis-preview__reveal-row--dense" : ""}`}
            role="group"
            aria-label={label}
        >
            <span className="settings-praxis-preview__reveal-label">{label}</span>
            <span className={`settings-praxis-preview__reveal-value${revealed ? "" : " is-masked"}`}>
                {revealed ? v : maskPraxisExportToken(v)}
            </span>
            <button
                type="button"
                className="settings-praxis-preview__reveal-btn"
                onClick={onToggle}
                aria-pressed={revealed}
                title={title}
            >
                <span className="settings-praxis-preview__reveal-ic" aria-hidden>
                    {revealed ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </span>
                <span className="sr-only">{title}</span>
            </button>
        </div>
    );
}

function PraxisBriefkopfPreview({ praxis }: { praxis: InvoicePraxis }) {
    const [revealed, setRevealed] = useState<PraxisHeaderPrivacyV1>(() => loadPraxisHeaderPrivacy());

    useEffect(() => {
        savePraxisHeaderPrivacy(revealed);
    }, [revealed]);

    const pdfAddressLines = useMemo(() => buildInvoiceHeaderAddressLines(praxis, revealed), [praxis, revealed]);
    const name = (praxis.name ?? "").trim();
    const addrLines = (praxis.addr ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const tel = (praxis.telefon ?? "").trim();
    const fax = (praxis.fax ?? "").trim();
    const em = (praxis.email ?? "").trim();
    const web = (praxis.web ?? "").trim().replace(/^https?:\/\//i, "");
    const kv = (praxis.kv_nummer ?? "").trim();
    const ust = (praxis.ust_id ?? "").trim();
    const st = (praxis.steuernummer ?? "").trim();
    const oz = (praxis.oeffnungszeiten ?? "").trim();

    const hasContact = Boolean(tel || fax || em || web);
    const hasRegister = Boolean(kv || ust || st || oz);
    const hasAny = Boolean(name || addrLines.length || hasContact || hasRegister);

    const activeRevealKeys = useMemo(() => {
        const keys: PraxisHeaderPrivacyKey[] = [];
        if (tel) keys.push("tel");
        if (fax) keys.push("fax");
        if (em) keys.push("email");
        if (web) keys.push("web");
        if (kv) keys.push("kv");
        if (ust) keys.push("ust");
        if (st) keys.push("steuer");
        if (oz) keys.push("oz");
        return keys;
    }, [tel, fax, em, web, kv, ust, st, oz]);

    const allRevealedForPresent = useMemo(
        () => activeRevealKeys.length === 0 || activeRevealKeys.every((k) => revealed[k]),
        [activeRevealKeys, revealed],
    );

    const toggleReveal = useCallback((k: PraxisHeaderPrivacyKey) => {
        setRevealed((r) => ({ ...r, [k]: !r[k] }));
    }, []);

    const onBulkRevealToggle = useCallback(() => {
        setRevealed((r) => {
            if (activeRevealKeys.length === 0) return r;
            const everyOn = activeRevealKeys.every((k) => r[k]);
            const target = !everyOn;
            const next = { ...r };
            for (const k of activeRevealKeys) next[k] = target;
            return next;
        });
    }, [activeRevealKeys]);

    return (
        <aside className="settings-praxis-preview" aria-label="Vorschau Briefkopf">
            <div className="settings-praxis-preview__toolbar">
                <div className="settings-praxis-preview__kicker">Vorschau</div>
                {activeRevealKeys.length > 0 ? (
                    <button
                        type="button"
                        className={`settings-praxis-preview__bulk${allRevealedForPresent ? " is-all-on" : ""}`}
                        onClick={onBulkRevealToggle}
                        title={allRevealedForPresent ? "Kontakt und Register in der Vorschau maskieren" : "Alle maskierten Zeilen wieder einblenden"}
                    >
                        {allRevealedForPresent ? "Alle maskieren" : "Alle einblenden"}
                    </button>
                ) : null}
            </div>
            <p className="settings-praxis-preview__sub">
                Lesefreundliches Briefpapier: Praxisname zuerst, darunter Anschrift. Pro Zeile kannst du Werte
                maskieren — dieselben Schalter gelten für Rechnungs-PDF, Tagesbericht und den Praxis-Kopf bei Attest,
                Rezept und Quittung (Export &amp; Druck). Stammdaten bleiben gespeichert. Unten: technische
                PDF-Reihenfolge der kleinen Kopfzeile.
            </p>
            <div className="settings-praxis-preview__paper">
                {!hasAny ? (
                    <p className="settings-praxis-preview__empty">Stammdaten eintragen — die Vorschau aktualisiert sich live.</p>
                ) : (
                    <div className="settings-praxis-preview__letter">
                        {name ? <div className="settings-praxis-preview__brand">{name}</div> : (
                            <div className="settings-praxis-preview__muted settings-praxis-preview__muted--block">(kein Praxisname)</div>
                        )}

                        {addrLines.length ? (
                            <div className="settings-praxis-preview__address">
                                {addrLines.map((line, i) => (
                                    <div key={i}>{line}</div>
                                ))}
                            </div>
                        ) : name ? (
                            <p className="settings-praxis-preview__muted settings-praxis-preview__muted--block">(keine Anschrift)</p>
                        ) : null}

                        {hasContact ? (
                            <div className="settings-praxis-preview__reveal-group" aria-label="Kontakt in der Vorschau">
                                <PraxisPreviewRevealRow label="Tel." value={tel} revealed={revealed.tel} onToggle={() => toggleReveal("tel")} />
                                <PraxisPreviewRevealRow label="Fax" value={fax} revealed={revealed.fax} onToggle={() => toggleReveal("fax")} />
                                <PraxisPreviewRevealRow label="E-Mail" value={em} revealed={revealed.email} onToggle={() => toggleReveal("email")} />
                                <PraxisPreviewRevealRow label="Web" value={web} revealed={revealed.web} onToggle={() => toggleReveal("web")} />
                            </div>
                        ) : null}

                        {hasRegister ? (
                            <div
                                className="settings-praxis-preview__reveal-group settings-praxis-preview__reveal-group--register"
                                aria-label="Register und Hinweise in der Vorschau"
                            >
                                <PraxisPreviewRevealRow
                                    label="KV- / Betriebsnr."
                                    value={kv}
                                    revealed={revealed.kv}
                                    onToggle={() => toggleReveal("kv")}
                                    dense
                                />
                                <PraxisPreviewRevealRow
                                    label="USt-IdNr."
                                    value={ust}
                                    revealed={revealed.ust}
                                    onToggle={() => toggleReveal("ust")}
                                    dense
                                />
                                <PraxisPreviewRevealRow
                                    label="St.-Nr."
                                    value={st}
                                    revealed={revealed.steuer}
                                    onToggle={() => toggleReveal("steuer")}
                                    dense
                                />
                                <PraxisPreviewRevealRow label="Öffn." value={oz} revealed={revealed.oz} onToggle={() => toggleReveal("oz")} dense />
                            </div>
                        ) : null}

                        {pdfAddressLines.length > 0 ? (
                            <div className="settings-praxis-preview__pdf-ref">
                                <div className="settings-praxis-preview__pdf-ref-label">PDF: Reihenfolge der kleinen Kopfzeile (9&nbsp;pt)</div>
                                <div className="settings-praxis-preview__pdf-ref-lines">
                                    {pdfAddressLines.map((line, i) => (
                                        <div key={i} className="settings-praxis-preview__pdf-ref-line">
                                            {line}
                                        </div>
                                    ))}
                                </div>
                                <p className="settings-praxis-preview__pdf-ref-note">Direkt darunter folgt im PDF der Praxisname (größer) — wie oben dargestellt.</p>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        </aside>
    );
}
