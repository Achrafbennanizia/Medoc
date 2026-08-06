import { Fragment, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../models/store/auth-store";
import { useUiPreferencesStore } from "../../models/store/ui-preferences-store";
import { checkSession, logout, touchSession } from "@/systems/practice-host/controllers/auth.controller";
import { listPatienten } from "@/systems/practice-host/controllers/patient.controller";
import { breakGlassActivate } from "@/systems/practice-host/controllers/break-glass.controller";
import { BREAK_GLASS_ENABLED } from "@/lib/mvp-security-config";
import { countAktenZuValidieren } from "@/systems/practice-host/controllers/akte-workflow.controller";
import { countOpenPraxisAufgabenForMe } from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import { NAV_SECTIONS } from "@/lib/nav-sections";
import { NAV_ITEM_DEFINITIONS, navItemVisible, routeChildPathAllowed, allowed, parseRole, type NavItemDefinition } from "@/lib/rbac";
import { useT, useTParams, useLocale, translateLocale, applyDocumentLocale } from "@/lib/i18n";
import { breadcrumbKeysForPath } from "@/lib/breadcrumb-keys";
import type { Patient } from "../../models/types";
import { ExportPreviewHost } from "../components/export-preview-host";
import { shouldShowPraxisSetupWizard } from "@/lib/praxis-completeness";
import { PraxisSetupWizard } from "../components/praxis-setup-wizard";
import { useDesktopChromeMode } from "../components/desktop-chrome";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "../components/ui/toast-store";
import { ToastContainer } from "../components/ui/toast";
import { ConfirmDialog, Dialog } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Select, Textarea } from "../components/ui/input";
import { BellIcon, ChevronDownIcon, ChevronRightIcon, DownloadIcon, ICON_SIZE_LG, ICON_SIZE_MD, ICON_SIZE_SM, MenuIcon, NAV_ICONS, PinIcon, PlusIcon, SearchIcon, WifiIcon } from "@/lib/icons";
import { filterCommandsForRole } from "@/lib/command-palette-data";
import { CommandPalette } from "../components/command-palette";
import { AboutAppDialog, RoleSwitchDialog } from "../components/app-help-dialogs";
import { OnboardingCoachmark } from "../components/onboarding-coachmark";
import { ONBOARDING_COACHMARK_ENABLED } from "@/lib/v1-ui-flags";
import { NotificationsPopover } from "../components/notifications-popover";
import { checkForUpdates, openNativePrintDialog } from "@/systems/practice-host/controllers/system.controller";
import { useDismissibleLayer } from "../components/ui/use-dismissible-layer";
import { UserAccountMenuDropdown } from "../components/user-account-menu";
import { SyncStatusBadge } from "../components/sync-status-badge";
import { AuditChainBanner } from "../components/audit-chain-banner";
import { BreakGlassBanner } from "../components/break-glass-banner";
import { RouteOutletGuard } from "../components/route-outlet-guard";
import { PageLoading } from "../components/ui/page-status";
import { loadClientSettings } from "@/lib/client-settings";
import {
    hydrateInvoicePraxisFromAppKv,
    migrateInvoicePraxisLocalStorageToAppKv,
} from "@/lib/invoice-leistung";
import { buildSyncNativeMenuPayload, MEDOC_PENDING_TERMIN_MENU_KEY } from "@/lib/native-go-menu";
import { syncNativeMenu } from "@/systems/practice-host/controllers/native-menu.controller";
import { workTimeGetPreference, workTimeSetPreference } from "@/systems/practice-host/controllers/work-time.controller";
import { subscribeWorkTimeFocusMode, dispatchWorkTimeFocusMode } from "@/lib/work-time-focus-mode";
import { subscribeAppMenu } from "@/lib/native-app-menu-bridge";
import { countUnreadInAppNotifications } from "@/systems/practice-host/controllers/in-app-notification.controller";
import { useMacWindowDrag } from "@/lib/mac-window-drag";
import { logUiRouteEnter, logUiWorkflowCancel } from "@/services/tauri.service";

const MEDOC_UI_ZOOM_KEY = "medoc-ui-zoom";
const MEDOC_SIDEBAR_RAIL_PREF_KEY = "medoc-sidebar-rail-pref";

type SidebarRailPref = "full" | "icons";

function readSidebarRailPref(): SidebarRailPref {
    try {
        const v = localStorage.getItem(MEDOC_SIDEBAR_RAIL_PREF_KEY);
        return v === "icons" ? "icons" : "full";
    } catch {
        return "full";
    }
}

function readStoredUiZoom(): number {
    try {
        const s = sessionStorage.getItem(MEDOC_UI_ZOOM_KEY);
        const n = s ? parseFloat(s) : 1;
        return Number.isFinite(n) && n >= 0.5 && n <= 2 ? Math.round(n * 100) / 100 : 1;
    } catch {
        return 1;
    }
}

function clampUiZoom(z: number): number {
    const r = Math.round(z * 100) / 100;
    return Math.min(2, Math.max(0.5, r));
}

type SidebarAccountPopoverFixed = { left: number; bottom: number; width: number };

function measureSidebarAccountMenuWidthPx(labels: string[]): number {
    if (typeof document === "undefined") return 168;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return 168;
    ctx.font = "500 13px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    let maxWord = 0;
    for (const lab of labels) {
        for (const word of lab.split(/\s+/)) {
            if (!word) continue;
            maxWord = Math.max(maxWord, ctx.measureText(word).width);
        }
    }
    // Largest word + 2 px horizontal padding (1 px each side); floor at readable minimum for tap targets.
    const wordPx = Math.ceil(maxWord);
    const chrome = 16 + 24; /* popover horizontal padding + row horizontal padding */
    const raw = wordPx + 2 + chrome;
    return Math.min(typeof window !== "undefined" ? window.innerWidth - 24 : raw, Math.max(140, raw));
}

export function AppLayout() {
    const session = useAuthStore((s) => s.session);
    const hydrateUiPreferences = useUiPreferencesStore((s) => s.hydrate);
    const clear = useAuthStore((s) => s.clear);
    const navigate = useNavigate();
    const location = useLocation();
    const lastTouch = useRef<number>(0);
    const t = useT();
    const tp = useTParams();
    const locale = useLocale((s) => s.locale);
    const toast = useToastStore((s) => s.add);
    const [breakOpen, setBreakOpen] = useState(false);
    const [bgReason, setBgReason] = useState("");
    const [bgPatientId, setBgPatientId] = useState("");
    const [bgPatients, setBgPatients] = useState<Patient[]>([]);
    const [bgBusy, setBgBusy] = useState(false);
    const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [updateLatestVersion, setUpdateLatestVersion] = useState("");
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
    const [commandOpen, setCommandOpen] = useState(false);
    const [roleSwitchOpen, setRoleSwitchOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [inAppUnread, setInAppUnread] = useState(0);
    const [aktenZuValidierenCount, setAktenZuValidierenCount] = useState(0);
    const [openPraxisAufgabenCount, setOpenPraxisAufgabenCount] = useState(0);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    /** Matches CSS breakpoint where shell uses persistent narrow sidebar strip vs overlay drawer. */
    const [wideShellLayout, setWideShellLayout] = useState(() =>
        typeof window !== "undefined" ? window.matchMedia("(min-width: 900px)").matches : true,
    );
    /** Help texts from native menu (Windows/Linux menu bar or macOS menu). */
    const [nativeHelpTopic, setNativeHelpTopic] = useState<null | "calendar" | "shortcuts">(null);
    const [praxisSetupOpen, setPraxisSetupOpen] = useState(() => shouldShowPraxisSetupWizard());
    const [aboutOpen, setAboutOpen] = useState(false);
    const [aboutVersion, setAboutVersion] = useState("");
    const [uiZoom, setUiZoom] = useState(readStoredUiZoom);
    const [sidebarRailPref, setSidebarRailPref] = useState<SidebarRailPref>(() =>
        typeof window !== "undefined" ? readSidebarRailPref() : "full",
    );
    const [userMenuAnchor, setUserMenuAnchor] = useState<"sidebar" | "topbar">("sidebar");
    const userMenuAnchorRef = useRef(userMenuAnchor);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const sidebarAccountPopoverRef = useRef<HTMLDivElement>(null);
    const [sidebarAccountPopoverFixed, setSidebarAccountPopoverFixed] = useState<SidebarAccountPopoverFixed | null>(null);
    const topbarMenuRef = useRef<HTMLDivElement>(null);
    const notifWrapRef = useRef<HTMLDivElement>(null);
    const desktopChrome = useDesktopChromeMode();
    useEffect(() => {
        if (!session?.user_id) return;
        void workTimeGetPreference()
            .then(async (p) => {
                if (p.focusMode) {
                    await workTimeSetPreference({ focusMode: false });
                    dispatchWorkTimeFocusMode(false);
                }
            })
            .catch(() => {});
        return subscribeWorkTimeFocusMode(() => {});
    }, [session?.user_id]);
    const paletteCommands = useMemo(
        () => filterCommandsForRole(session?.rolle, session?.permission_overrides),
        [session?.rolle, session?.permission_overrides],
    );
    const breadcrumbKeys = useMemo(() => breadcrumbKeysForPath(location.pathname), [location.pathname]);
    const breadcrumbs = useMemo(() => breadcrumbKeys.map((k) => t(k)), [breadcrumbKeys, t]);
    const isDashboardRoute = location.pathname === "/";
    const isTermineCalendarRoute = location.pathname === "/termine";
    const visibleNavItems = useMemo(
        () =>
            NAV_ITEM_DEFINITIONS.filter((item) =>
                navItemVisible(session?.rolle, item, session?.permission_overrides),
            ),
        [session?.rolle, session?.permission_overrides],
    );
    const visibleByTo = useMemo(
        () => new Map(visibleNavItems.map((item) => [item.to, item])),
        [visibleNavItems],
    );
    const sidebarNavFlat = useMemo((): NavItemDefinition[] => {
        const acc: NavItemDefinition[] = [];
        for (const section of NAV_SECTIONS) {
            for (const to of section.items) {
                const item = visibleByTo.get(to);
                if (item) acc.push(item);
            }
        }
        return acc;
    }, [visibleByTo]);
    const initials = (session?.name ?? "MD").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
    const profileRoleLine = useMemo(() => {
        const r = session?.rolle;
        if (r === "ARZT") return t("app.role_label.ARZT");
        if (r === "REZEPTION") return t("app.role_label.REZEPTION");
        // TODO(deferred-roles): if (r === "STEUERBERATER") return t("app.role_label.STEUERBERATER");
        // TODO(deferred-roles): if (r === "PHARMABERATER") return t("app.role_label.PHARMABERATER");
        return "";
    }, [session?.rolle, t]);

    const refreshInAppUnread = useCallback(async () => {
        if (!session?.user_id) {
            setInAppUnread(0);
            return;
        }
        try {
            const n = await countUnreadInAppNotifications();
            setInAppUnread(typeof n === "number" && n > 0 ? n : 0);
        } catch {
            setInAppUnread(0);
        }
    }, [session?.user_id]);

    const refreshNavBadges = useCallback(async () => {
        const rolle = session?.rolle;
        if (rolle !== "ARZT" && rolle !== "REZEPTION") {
            setAktenZuValidierenCount(0);
            setOpenPraxisAufgabenCount(0);
            return;
        }
        try {
            if (rolle === "ARZT") {
                const [akten, aufgaben] = await Promise.all([
                    countAktenZuValidieren(),
                    countOpenPraxisAufgabenForMe(),
                ]);
                setAktenZuValidierenCount(typeof akten === "number" && akten > 0 ? akten : 0);
                setOpenPraxisAufgabenCount(typeof aufgaben === "number" && aufgaben > 0 ? aufgaben : 0);
            } else {
                const aufgaben = await countOpenPraxisAufgabenForMe();
                setAktenZuValidierenCount(0);
                setOpenPraxisAufgabenCount(typeof aufgaben === "number" && aufgaben > 0 ? aufgaben : 0);
            }
        } catch {
            setAktenZuValidierenCount(0);
            setOpenPraxisAufgabenCount(0);
        }
    }, [session?.rolle]);

    const handleMacWindowDrag = useMacWindowDrag(desktopChrome === "mac-overlay");

    useEffect(() => {
        void refreshInAppUnread();
        void refreshNavBadges();
    }, [refreshInAppUnread, refreshNavBadges, location.pathname]);

    useEffect(() => {
        const id = window.setInterval(() => {
            void refreshInAppUnread();
            void refreshNavBadges();
        }, 120_000);
        return () => window.clearInterval(id);
    }, [refreshInAppUnread, refreshNavBadges]);

    useEffect(() => {
        const onBadges = () => void refreshNavBadges();
        window.addEventListener("medoc-nav-badges-refresh", onBadges);
        return () => window.removeEventListener("medoc-nav-badges-refresh", onBadges);
    }, [refreshNavBadges]);

    useEffect(() => {
        const onNotif = () => void refreshInAppUnread();
        window.addEventListener("medoc-in-app-notifications-refresh", onNotif);
        return () => window.removeEventListener("medoc-in-app-notifications-refresh", onNotif);
    }, [refreshInAppUnread]);

    // Inactivity guard (FA-AUTH-03 / NFA-SEC-09): the backend expires sessions after 30 min.
    // Throttle activity pings to once every 30 s and poll the session status
    // every minute so the UI auto-redirects on expiry.
    useEffect(() => {
        applyDocumentLocale(locale);
    }, [locale]);

    useEffect(() => {
        document.documentElement.style.zoom = String(uiZoom);
        try {
            sessionStorage.setItem(MEDOC_UI_ZOOM_KEY, String(uiZoom));
        } catch {
            /* ignore */
        }
    }, [uiZoom]);

    useEffect(() => {
        if (sidebarRailPref === "icons") {
            document.documentElement.dataset.sidebarRail = "icons";
        } else {
            delete document.documentElement.dataset.sidebarRail;
        }
        try {
            localStorage.setItem(MEDOC_SIDEBAR_RAIL_PREF_KEY, sidebarRailPref);
        } catch {
            /* ignore */
        }
    }, [sidebarRailPref]);

    useEffect(() => {
        const mq = window.matchMedia("(min-width: 900px)");
        const sync = () => setWideShellLayout(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, []);

    /** Narrow strip: no account menu in rail — display only (name); menu via topbar. */
    const sidebarProfileDisplayOnly =
        (wideShellLayout && sidebarRailPref === "icons") || (!wideShellLayout && !mobileNavOpen);

    useEffect(() => {
        if (sidebarProfileDisplayOnly) setUserMenuOpen(false);
    }, [sidebarProfileDisplayOnly]);

    useEffect(() => {
        if (!session) return;
        void hydrateUiPreferences();
    }, [session, hydrateUiPreferences]);

    useEffect(() => {
        userMenuAnchorRef.current = userMenuAnchor;
    }, [userMenuAnchor]);

    useEffect(() => {
        setMobileNavOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        logUiRouteEnter(location.pathname);
    }, [location.pathname]);

    useEffect(() => {
        const onEscape = (ev: KeyboardEvent) => {
            if (ev.key !== "Escape") return;
            if (document.querySelector('[role="dialog"]') == null) return;
            logUiWorkflowCancel("dialog_escape");
        };
        window.addEventListener("keydown", onEscape, true);
        return () => window.removeEventListener("keydown", onEscape, true);
    }, []);

    /** Native menubar: RBAC-aligned payload (desktop); warn-only on browser / IPC failure. */
    useEffect(() => {
        if (!session?.rolle) return;
        const payload = buildSyncNativeMenuPayload(session.rolle, (key) => translateLocale(locale, key));
        void syncNativeMenu(payload).catch((err) => {
            console.error("sync_native_menu failed", err);
        });
    }, [session?.rolle, locale]);

    /** Matches native menu actions (⌘K/⌘⇧P Befehlspalette, ⌘N Termin, Zoom, Neu laden). */
    useEffect(() => {
        const typing = (el: EventTarget | null) => {
            if (!(el instanceof HTMLElement)) return false;
            const tag = el.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
            if (el.isContentEditable) return true;
            return Boolean(el.closest('[role="dialog"]'));
        };
        const onKey = (e: KeyboardEvent) => {
            if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
            if (typing(e.target)) return;

            const key = e.key.toLowerCase();

            if (key === "k" || (key === "p" && e.shiftKey)) {
                e.preventDefault();
                setNotifOpen(false);
                setCommandOpen(true);
                setMobileNavOpen(false);
                return;
            }

            if (key === "r" && !e.shiftKey) {
                e.preventDefault();
                window.location.reload();
                return;
            }

            const step = 0.1;
            if (e.code === "Equal" || e.code === "NumpadAdd") {
                e.preventDefault();
                setUiZoom((z) => clampUiZoom(z + step));
                return;
            }
            if (e.code === "Minus" || e.code === "NumpadSubtract") {
                e.preventDefault();
                setUiZoom((z) => clampUiZoom(z - step));
                return;
            }
            if (e.code === "Digit0" || e.code === "Numpad0") {
                e.preventDefault();
                setUiZoom(1);
                return;
            }

            if (key === "n" && !e.shiftKey) {
                if (location.pathname.startsWith("/termine")) return;
                const acct = useAuthStore.getState().session;
                if (!routeChildPathAllowed("termine/neu", acct?.rolle, acct?.permission_overrides)) return;
                e.preventDefault();
                navigate("/termine/neu");
                setMobileNavOpen(false);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [navigate, location.pathname]);

    useEffect(() => {
        const typing = (el: EventTarget | null) => {
            if (!(el instanceof HTMLElement)) return false;
            const tag = el.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
            if (el.isContentEditable) return true;
            return false;
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey) return;
            if (typing(e.target)) return;
            e.preventDefault();
            navigate("/hilfe");
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [navigate]);

    useEffect(() => {
        const typing = (el: EventTarget | null) => {
            if (!(el instanceof HTMLElement)) return false;
            const tag = el.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
            if (el.isContentEditable) return true;
            return Boolean(el.closest('[role="dialog"]'));
        };
        const onAltNav = (e: KeyboardEvent) => {
            if (!e.altKey || e.repeat || e.ctrlKey || e.metaKey) return;
            const n = Number.parseInt(e.key, 10);
            if (n < 1 || n > 9) return;
            if (typing(e.target)) return;
            const item = sidebarNavFlat[n - 1];
            if (!item) return;
            e.preventDefault();
            navigate(item.to);
            setMobileNavOpen(false);
        };
        window.addEventListener("keydown", onAltNav);
        return () => window.removeEventListener("keydown", onAltNav);
    }, [navigate, sidebarNavFlat]);

    useEffect(() => {
        const onActivity = () => {
            const now = Date.now();
            if (now - lastTouch.current > 30_000) {
                lastTouch.current = now;
                touchSession().catch(() => { });
            }
        };
        const events: (keyof DocumentEventMap)[] = ["mousemove", "keydown", "click", "scroll"];
        events.forEach((e) => document.addEventListener(e, onActivity, { passive: true }));
        const poll = setInterval(async () => {
            const s = await checkSession();
            if (!s) { clear(); navigate("/login"); }
        }, 60_000);
        return () => {
            events.forEach((e) => document.removeEventListener(e, onActivity));
            clearInterval(poll);
        };
    }, [clear, navigate]);

    useEffect(() => {
        const onReq = () => setLogoutConfirmOpen(true);
        window.addEventListener("medoc-request-logout", onReq);
        return () => window.removeEventListener("medoc-request-logout", onReq);
    }, []);

    const sessionUserId = session?.user_id;
    useEffect(() => {
        if (!sessionUserId) return;
        void (async () => {
            try {
                await migrateInvoicePraxisLocalStorageToAppKv();
                await hydrateInvoicePraxisFromAppKv();
            } catch (e) {
                toast(tp("app.layout.praxis_sync_error", { message: errorMessage(e) }), "warning");
            }
        })();
    }, [sessionUserId, toast]);

    useEffect(() => {
        if (!session) return;
        const mins = loadClientSettings().security?.idleLogoutMinutes ?? 0;
        if (mins <= 0) return;
        const ms = mins * 60_000;
        let last = Date.now();
        const bump = () => {
            last = Date.now();
        };
        const events: (keyof DocumentEventMap)[] = ["mousemove", "keydown", "click", "scroll", "touchstart"];
        events.forEach((e) => document.addEventListener(e, bump, { passive: true }));
        const tick = window.setInterval(() => {
            if (Date.now() - last >= ms) {
                void (async () => {
                    await logout();
                    navigate("/login");
                })();
            }
        }, 15_000);
        return () => {
            events.forEach((e) => document.removeEventListener(e, bump));
            window.clearInterval(tick);
        };
    }, [session, navigate]);

    useEffect(() => {
        if (!breakOpen) return;
        listPatienten()
            .then(setBgPatients)
            .catch((e) => {
                setBgPatients([]);
                toast(tp("app.layout.break_glass.toast_patients_error", { message: errorMessage(e) }), "error");
            });
    }, [breakOpen, toast]);

    useEffect(() => {
        const onOnline = () => setIsOnline(true);
        const onOffline = () => setIsOnline(false);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        void checkForUpdates()
            .then((u) => {
                setUpdateAvailable(Boolean(u.update_available));
                setUpdateLatestVersion(u.latest_version ?? "");
            })
            .catch((e) => {
                setUpdateAvailable(false);
                console.warn("Update check failed", e);
            });
        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, []);

    useDismissibleLayer({
        open: userMenuOpen && userMenuAnchor === "sidebar" && !sidebarProfileDisplayOnly,
        rootRef: userMenuRef,
        containRefs: [sidebarAccountPopoverRef],
        onDismiss: () => setUserMenuOpen(false),
    });
    useDismissibleLayer({
        open: userMenuOpen && userMenuAnchor === "topbar",
        rootRef: topbarMenuRef,
        onDismiss: () => setUserMenuOpen(false),
    });

    useDismissibleLayer({
        open: notifOpen,
        rootRef: notifWrapRef,
        onDismiss: () => setNotifOpen(false),
    });

    useLayoutEffect(() => {
        if (!userMenuOpen || userMenuAnchor !== "sidebar" || sidebarRailPref === "icons" || sidebarProfileDisplayOnly) {
            setSidebarAccountPopoverFixed(null);
            return undefined;
        }
        const update = () => {
            const el = userMenuRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const labels = [t("nav.settings")];
            if (BREAK_GLASS_ENABLED && session?.rolle === "ARZT") labels.push(t("app.layout.break_glass.emergency_access"));
            labels.push(t("auth.logout"));
            const widthPx = measureSidebarAccountMenuWidthPx(labels);
            let left = r.left;
            if (typeof window !== "undefined") {
                left = Math.max(8, Math.min(left, window.innerWidth - widthPx - 8));
            }
            const bottom = typeof window !== "undefined" ? window.innerHeight - r.top + 10 : 0;
            setSidebarAccountPopoverFixed({ left, bottom, width: widthPx });
        };
        update();
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => {
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
        };
    }, [userMenuOpen, userMenuAnchor, sidebarRailPref, sidebarProfileDisplayOnly, session?.rolle, t]);

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };
    const requestLogout = () => setLogoutConfirmOpen(true);

    const sidebarAccountMenu = (
        <>
            <button
                type="button"
                role="menuitem"
                className="sidebar-account-popover__item"
                onClick={() => {
                    setUserMenuOpen(false);
                    navigate("/einstellungen");
                }}
            >
                {t("nav.settings")}
            </button>
            {BREAK_GLASS_ENABLED && session?.rolle === "ARZT" ? (
                <button
                    type="button"
                    role="menuitem"
                    className="sidebar-account-popover__item sidebar-account-popover__item--breakglass"
                    onClick={() => {
                        setUserMenuOpen(false);
                        setBreakOpen(true);
                    }}
                >
                    {t("app.layout.break_glass.emergency_access")}
                </button>
            ) : null}
            <button
                type="button"
                role="menuitem"
                className="sidebar-account-popover__item sidebar-account-popover__item--logout"
                onClick={() => {
                    setUserMenuOpen(false);
                    requestLogout();
                }}
            >
                {t("auth.logout")}
            </button>
        </>
    );

    const openCommandPalette = () => {
        setNotifOpen(false);
        setCommandOpen(true);
    };

    const confirmRoleSwitchLogout = async () => {
        setRoleSwitchOpen(false);
        await logout();
        navigate("/login");
    };

    const submitBreakGlass = async () => {
        if (bgReason.trim().length < 10) {
            toast(t("app.layout.break_glass.toast_reason_min"));
            return;
        }
        setBgBusy(true);
        try {
            await breakGlassActivate(bgReason.trim(), bgPatientId || undefined);
            toast(t("app.layout.break_glass.toast_activated"));
            window.dispatchEvent(new Event("medoc-break-glass-refresh"));
            setBreakOpen(false);
            setBgReason("");
            setBgPatientId("");
        } catch (e) {
            toast(`${t("common.error_prefix")} ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setBgBusy(false);
        }
    };

    useEffect(() => {
        let unlisten: (() => void) | undefined;
        let disposed = false;
        void subscribeAppMenu((p) => {
                        if (p.kind === "navigate" && typeof p.path === "string" && p.path.length > 0) {
                            const pathOnly = p.path.split("?")[0];
                            const routeKey =
                                pathOnly === "/" || pathOnly === "" ? "" : pathOnly.replace(/^\//, "");
                            const acct = useAuthStore.getState().session;
                            if (!routeChildPathAllowed(routeKey, acct?.rolle, acct?.permission_overrides)) {
                                useToastStore.getState().add(translateLocale(locale, "app.native_menu.denied"));
                                return;
                            }
                            navigate(p.path);
                            setMobileNavOpen(false);
                            return;
                        }
                        if (p.kind === "termin" && typeof p.action === "string") {
                            const acct = useAuthStore.getState().session;
                            if (!routeChildPathAllowed("termine", acct?.rolle, acct?.permission_overrides)) {
                                useToastStore.getState().add(translateLocale(locale, "app.native_menu.denied"));
                                return;
                            }
                            if (location.pathname !== "/termine") {
                                try {
                                    sessionStorage.setItem(MEDOC_PENDING_TERMIN_MENU_KEY, p.action);
                                } catch {
                                    /* ignore */
                                }
                                navigate("/termine");
                                setMobileNavOpen(false);
                                return;
                            }
                            window.dispatchEvent(new CustomEvent("medoc-native-menu-termin", { detail: p.action }));
                            return;
                        }
                        if (p.kind === "app" && typeof p.action === "string") {
                            const step = 0.1;
                            if (p.action === "reload") {
                                window.location.reload();
                                return;
                            }
                            if (p.action === "command_palette") {
                                setNotifOpen(false);
                                setCommandOpen(true);
                                setMobileNavOpen(false);
                                return;
                            }
                            if (p.action === "zoom_in") {
                                setUiZoom((z) => clampUiZoom(z + step));
                                return;
                            }
                            if (p.action === "zoom_out") {
                                setUiZoom((z) => clampUiZoom(z - step));
                                return;
                            }
                            if (p.action === "zoom_reset") {
                                setUiZoom(1);
                                return;
                            }
                            if (p.action === "print") {
                                void (async () => {
                                    try {
                                        await openNativePrintDialog();
                                    } catch (e) {
                                        try {
                                            window.print();
                                        } catch {
                                            useToastStore.getState().add(
                                                tp("app.layout.print_failed", {
                                                    message: e instanceof Error ? e.message : String(e),
                                                }),
                                                "error",
                                            );
                                        }
                                    }
                                })();
                                return;
                            }
                        }
                        if (p.kind === "help") {
                            if (p.topic === "calendar") setNativeHelpTopic("calendar");
                            else if (p.topic === "shortcuts") setNativeHelpTopic("shortcuts");
                            else if (p.topic === "about") {
                                setAboutVersion(
                                    typeof p.version === "string" && p.version.length > 0
                                        ? p.version
                                        : import.meta.env.VITE_APP_VERSION,
                                );
                                setAboutOpen(true);
                            }
                        }
        }).then((fn) => {
            if (disposed) fn?.();
            else unlisten = fn;
        });
        return () => {
            disposed = true;
            unlisten?.();
        };
    }, [navigate, location.pathname, locale]);

    const isMacUnifiedChrome = desktopChrome === "mac-overlay";

    const sidebarBrandRow = (
        <div className="app-sidebar-brand-row">
            <button
                type="button"
                className="app-sidebar-brand-hit app-sidebar-brand-hit--rail"
                title={
                    sidebarRailPref === "icons"
                        ? tp("app.layout.sidebar_rail.expand_title", { search: t("nav.search_short") })
                        : tp("app.layout.sidebar_rail.collapse_title", { search: t("nav.search_short") })
                }
                aria-label={
                    sidebarRailPref === "icons"
                        ? t("app.layout.sidebar_rail.expand_aria")
                        : t("app.layout.sidebar_rail.collapse_aria")
                }
                onClick={(e) => {
                    setMobileNavOpen(false);
                    if (e.altKey || e.metaKey) {
                        openCommandPalette();
                        return;
                    }
                    setSidebarRailPref((p) => (p === "icons" ? "full" : "icons"));
                }}
            >
                <span className="app-sidebar-brand-mark" aria-hidden>
                    <PinIcon size={18} />
                </span>
                <div className="app-sidebar-brand-meta">
                    <div className="app-sidebar-brand-title">MeDoc</div>
                    <div className="app-sidebar-brand-tag">{t("app.sidebar_tagline")}</div>
                </div>
            </button>
        </div>
    );

    const topbarToolbar = (
        <>
            <button type="button" className="icon-btn mobile-nav-trigger" aria-label={t("app.layout.mobile_nav_open_aria")} onClick={() => setMobileNavOpen(true)}>
                <MenuIcon size={18} />
            </button>
            <div className="crumb">
                {breadcrumbs.map((c, i) => (
                    <Fragment key={`${c}-${i}`}>
                        {i > 0 && (
                            <span style={{ color: "var(--fg-4)" }}>
                                <ChevronRightIcon size={12} />
                            </span>
                        )}
                        {i === breadcrumbs.length - 1 ? <b>{c}</b> : <span>{c}</span>}
                    </Fragment>
                ))}
            </div>
            <div
                className="topbar-actions"
                style={{
                    marginInlineStart: "auto",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                <button type="button" className="input focus-ring topbar-search-trigger" onClick={openCommandPalette}>
                    <SearchIcon size={ICON_SIZE_SM} aria-hidden />
                    <span style={{ flex: 1, textAlign: "left", fontSize: 13, color: "var(--fg-3)" }}>{t("nav.search_short")}</span>
                    <span className="ui-kbd-hint" style={{ fontSize: 11, color: "var(--fg-4)" }}>
                        ⌘K
                    </span>
                </button>
                {updateAvailable ? (
                    <button
                        className="tb-chip update"
                        type="button"
                        onClick={() => navigate("/einstellungen")}
                        title={tp("app.layout.update_available_title", { version: updateLatestVersion })}
                    >
                        <DownloadIcon size={12} />
                        {tp("app.layout.update_available", { version: updateLatestVersion })}
                    </button>
                ) : null}
                <SyncStatusBadge />
                <span className={`tb-chip ${isOnline ? "live" : ""}`}>
                    <WifiIcon size={12} />
                    {isOnline ? t("app.layout.online") : t("app.layout.offline")}
                </span>
                <button
                    type="button"
                    className="icon-btn"
                    aria-label={t("nav.quick_add")}
                    title={t("nav.quick_add")}
                    onClick={openCommandPalette}
                >
                    <PlusIcon size={ICON_SIZE_LG} />
                </button>
                <div ref={notifWrapRef} style={{ position: "relative" }}>
                    <button
                        type="button"
                        className="icon-btn"
                        aria-label={t("a11y.notifications_region")}
                        aria-expanded={notifOpen}
                        onClick={() => {
                            setNotifOpen((o) => !o);
                            setUserMenuOpen(false);
                        }}
                    >
                        <BellIcon size={ICON_SIZE_LG} />
                        {inAppUnread > 0 ? <span className="dot" aria-hidden /> : null}
                    </button>
                    {notifOpen ? (
                        <NotificationsPopover
                            onClose={() => {
                                setNotifOpen(false);
                                void refreshInAppUnread();
                            }}
                            onUnreadChanged={() => void refreshInAppUnread()}
                        />
                    ) : null}
                </div>
                <div ref={topbarMenuRef} style={{ position: "relative" }}>
                    <button
                        type="button"
                        className="btn btn-subtle"
                        style={{
                            padding: "4px 8px 4px 4px",
                            fontSize: 12,
                            borderRadius: 999,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                        }}
                        aria-haspopup="menu"
                        aria-expanded={userMenuOpen && userMenuAnchor === "topbar"}
                        onClick={() => {
                            const switchingFromOther = userMenuAnchorRef.current !== "topbar";
                            setUserMenuAnchor("topbar");
                            setUserMenuOpen((wasOpen) => {
                                if (!wasOpen) return true;
                                if (switchingFromOther) return true;
                                return false;
                            });
                        }}
                    >
                        <span className="av av--accent topbar-user-av" style={{ width: 24, height: 24, fontSize: 10 }}>
                            {initials}
                        </span>
                        <ChevronDownIcon size={12} />
                    </button>
                    {userMenuOpen && userMenuAnchor === "topbar" ? (
                        <UserAccountMenuDropdown
                            placement="below"
                            initials={initials}
                            name={session?.name ?? t("app.layout.user_fallback")}
                            emailFallback={session?.email ?? "praxis@medoc.de"}
                            logoutLabel={t("auth.logout")}
                            onRoleSwitch={() => {
                                setUserMenuOpen(false);
                                setRoleSwitchOpen(true);
                            }}
                            onSettings={() => {
                                navigate("/einstellungen");
                                setUserMenuOpen(false);
                            }}
                            onShortcuts={() => {
                                setUserMenuOpen(false);
                                navigate("/hilfe");
                            }}
                            helpNavLabel={t("account.menu_help")}
                            onLogoutRequest={() => {
                                setUserMenuOpen(false);
                                requestLogout();
                            }}
                        />
                    ) : null}
                </div>
            </div>
        </>
    );

    return (
        <div className="app">
            {/* First in tab order: bypass sidebar (WCAG 2.4.1) */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:px-3 focus:py-2 focus:bg-white focus:text-black focus:rounded"
            >
                {t("a11y.skip_to_main")}
            </a>

            <AuditChainBanner
                canAcknowledge={
                    !!session &&
                    parseRole(session.rolle) != null &&
                    allowed(
                        "ops.audit_chain_ack",
                        parseRole(session.rolle)!,
                        session.permission_overrides,
                    )
                }
            />
            {BREAK_GLASS_ENABLED ? <BreakGlassBanner userId={session?.user_id} /> : null}

            <div className={`app-shell${isMacUnifiedChrome ? " app-shell--mac-unified" : ""}`}>
            <button
                type="button"
                className="app-sidebar-backdrop"
                data-open={mobileNavOpen ? "true" : "false"}
                aria-hidden={!mobileNavOpen}
                tabIndex={-1}
                onClick={() => setMobileNavOpen(false)}
            />
            {isMacUnifiedChrome ? (
                <header
                    className="app-window-chrome topbar topbar--mac-traffic"
                    data-tauri-drag-region
                    onMouseDown={handleMacWindowDrag}
                >
                    <div className="app-window-chrome__brand glass">{sidebarBrandRow}</div>
                    <div className="app-window-chrome__toolbar topbar-mac-content-row">{topbarToolbar}</div>
                </header>
            ) : null}
            <aside className="glass app-sidebar" data-open={mobileNavOpen ? "true" : "false"}>
                {!isMacUnifiedChrome ? sidebarBrandRow : null}
                <nav className="app-sidebar-scroll">
                    {NAV_SECTIONS.map((section) => {
                        const sectionItems = section.items
                            .map((to) => visibleByTo.get(to))
                            .filter((item): item is NonNullable<typeof item> => Boolean(item));
                        if (sectionItems.length === 0) return null;
                        return (
                            <Fragment key={section.labelKey}>
                                <div className="sb-group-label">{t(section.labelKey)}</div>
                                {sectionItems.map((item) => {
                                    const label = t(item.labelKey);
                                    return (
                                        <NavLink
                                            key={item.to}
                                            to={item.to}
                                            end={item.to !== "/patienten"}
                                            className={({ isActive }) => `sb-item ${isActive ? "active" : ""}`}
                                            title={sidebarRailPref === "icons" ? label : undefined}
                                            aria-label={label}
                                        >
                                            {(() => {
                                                const Ic = NAV_ICONS[item.to] ?? PinIcon;
                                                return <Ic size={ICON_SIZE_MD} aria-hidden />;
                                            })()}
                                            <span className="sb-item-label" aria-hidden="true">
                                                {label}
                                            </span>
                                            {item.to === "/akten/zu-validieren" && aktenZuValidierenCount > 0 ? (
                                                <span className="count" aria-label={tp("app.layout.nav_badge_akten_pending", { count: aktenZuValidierenCount })}>
                                                    {aktenZuValidierenCount > 99 ? "99+" : aktenZuValidierenCount}
                                                </span>
                                            ) : null}
                                            {item.to === "/tickets" && openPraxisAufgabenCount > 0 ? (
                                                <span
                                                    className="count"
                                                    aria-label={tp("app.layout.nav_badge_tickets_open", { count: openPraxisAufgabenCount })}
                                                >
                                                    {openPraxisAufgabenCount > 99
                                                        ? "99+"
                                                        : openPraxisAufgabenCount}
                                                </span>
                                            ) : null}
                                        </NavLink>
                                    );
                                })}
                            </Fragment>
                        );
                    })}
                </nav>
                <div className="app-sidebar-footer" ref={userMenuRef}>
                    {sidebarProfileDisplayOnly ? (
                        <div
                            className="app-sidebar-user-card app-sidebar-user-card--collapsed-only"
                            role="group"
                            aria-label={tp("app.layout.account_signed_in_as", { name: session?.name ?? t("app.layout.user_fallback") })}
                            title={session?.name ?? undefined}
                        >
                            <div className="av av--accent" style={{ width: 40, height: 40, fontSize: 16 }}>
                                {initials}
                            </div>
                            <div className="app-sidebar-user-lines app-sidebar-user-lines--narrow-strip" style={{ flex: 1, minWidth: 0 }}>
                                <div className="app-sidebar-user-card__name">
                                    {session?.name ?? t("app.layout.user_fallback")}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="app-sidebar-user-card"
                            aria-haspopup="menu"
                            aria-expanded={userMenuOpen && userMenuAnchor === "sidebar"}
                            aria-label={t("app.layout.account_menu_aria")}
                            onClick={() => {
                                const switchingFromOther = userMenuAnchorRef.current !== "sidebar";
                                setUserMenuAnchor("sidebar");
                                setUserMenuOpen((wasOpen) => {
                                    if (!wasOpen) return true;
                                    if (switchingFromOther) return true;
                                    return false;
                                });
                            }}
                        >
                            <div className="av av--accent" style={{ width: 40, height: 40, fontSize: 16 }}>
                                {initials}
                            </div>
                            <div className="app-sidebar-user-lines" style={{ flex: 1, minWidth: 0 }}>
                                <div className="app-sidebar-user-card__name">{session?.name ?? t("app.layout.user_fallback")}</div>
                                <div className="app-sidebar-user-card__meta">{profileRoleLine}</div>
                            </div>
                            <span
                                className={`app-sidebar-user-card-chevron${userMenuOpen && userMenuAnchor === "sidebar" ? " is-open" : ""}`}
                                aria-hidden
                            >
                                <ChevronDownIcon size={14} />
                            </span>
                        </button>
                    )}
                </div>
            </aside>
            {typeof document !== "undefined" &&
            userMenuOpen &&
            userMenuAnchor === "sidebar" &&
            !sidebarProfileDisplayOnly &&
            sidebarRailPref !== "icons" &&
            sidebarAccountPopoverFixed
                ? createPortal(
                      <div
                          ref={sidebarAccountPopoverRef}
                          className="app-sidebar-account-popover app-sidebar-account-popover--portal"
                          role="menu"
                          aria-label={t("app.layout.account_popover_aria")}
                          style={{
                              position: "fixed",
                              left: sidebarAccountPopoverFixed.left,
                              bottom: sidebarAccountPopoverFixed.bottom,
                              width: sidebarAccountPopoverFixed.width,
                              maxWidth: "calc(100vw - 24px)",
                              zIndex: 10060,
                          }}
                      >
                          {sidebarAccountMenu}
                      </div>,
                      document.body,
                  )
                : null}

            <div className="app-main-column" style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, flex: 1 }}>
                {!isMacUnifiedChrome ? (
                    <div className="topbar">
                        <div className="topbar-inner--contents">{topbarToolbar}</div>
                    </div>
                ) : null}
                <main
                    id="main-content"
                    tabIndex={-1}
                    className={`app-main${isDashboardRoute || isTermineCalendarRoute ? " app-main--fill-y" : " app-main--scroll-y"}`}
                    aria-label={t("app.title")}
                >
                    <Suspense fallback={<PageLoading label={t("common.loading")} />}>
                        <RouteOutletGuard>
                            <Outlet />
                        </RouteOutletGuard>
                    </Suspense>
                </main>
            </div>
            </div>

            {ONBOARDING_COACHMARK_ENABLED ? <OnboardingCoachmark rolle={session?.rolle} /> : null}
            <ToastContainer />
            <ExportPreviewHost />
            <PraxisSetupWizard open={praxisSetupOpen} onClose={() => setPraxisSetupOpen(false)} />

            <Dialog
                open={nativeHelpTopic === "calendar"}
                onClose={() => setNativeHelpTopic(null)}
                title={t("app.layout.help.calendar.title")}
                footer={<Button onClick={() => setNativeHelpTopic(null)}>{t("common.close")}</Button>}
            >
                <p style={{ margin: 0, fontSize: 14, color: "var(--fg-2)", lineHeight: 1.55 }}>
                    {t("app.layout.help.calendar.body")}
                </p>
            </Dialog>
            <Dialog
                open={nativeHelpTopic === "shortcuts"}
                onClose={() => setNativeHelpTopic(null)}
                title={t("app.layout.help.shortcuts.title")}
                footer={<Button onClick={() => setNativeHelpTopic(null)}>{t("common.close")}</Button>}
            >
                <p style={{ margin: 0, fontSize: 14, color: "var(--fg-2)", lineHeight: 1.55 }}>
                    {t("app.layout.help.shortcuts.body")}
                </p>
            </Dialog>

            <AboutAppDialog
                open={aboutOpen}
                onClose={() => setAboutOpen(false)}
                appVersion={aboutVersion || import.meta.env.VITE_APP_VERSION}
            />

            {BREAK_GLASS_ENABLED ? (
            <Dialog
                open={breakOpen}
                onClose={() => setBreakOpen(false)}
                title={t("app.layout.break_glass.title")}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setBreakOpen(false)}>{t("common.cancel")}</Button>
                        <Button onClick={() => void submitBreakGlass()} disabled={bgBusy} loading={bgBusy}>{t("common.confirm")}</Button>
                    </>
                }
            >
                <p style={{ color: "var(--fg-3)", fontSize: 14, marginBottom: 12 }}>
                    {t("app.layout.break_glass.body")}
                </p>
                <Select
                    id="bg-patient"
                    label={t("app.layout.break_glass.patient_label")}
                    value={bgPatientId}
                    onChange={(e) => setBgPatientId(e.target.value)}
                    options={[{ value: "", label: t("app.layout.break_glass.patient_none") }, ...bgPatients.map((p) => ({ value: p.id, label: p.name }))]}
                />
                <Textarea
                    id="bg-reason"
                    label={t("app.layout.break_glass.reason_label")}
                    value={bgReason}
                    onChange={(e) => setBgReason(e.target.value)}
                    style={{ minHeight: 88 }}
                />
            </Dialog>
            ) : null}
            <ConfirmDialog
                open={logoutConfirmOpen}
                onClose={() => setLogoutConfirmOpen(false)}
                onConfirm={async () => {
                    setLogoutConfirmOpen(false);
                    await handleLogout();
                }}
                title={t("app.layout.logout.title")}
                message={t("app.layout.logout.message")}
                confirmLabel={t("app.layout.logout.confirm")}
                danger
            />

            <CommandPalette
                open={commandOpen}
                onClose={() => setCommandOpen(false)}
                commands={paletteCommands}
                onNavigate={(href) => navigate(href)}
            />
            <RoleSwitchDialog
                open={roleSwitchOpen}
                onClose={() => setRoleSwitchOpen(false)}
                onConfirmLogout={() => void confirmRoleSwitchLogout()}
            />
        </div>
    );
}
