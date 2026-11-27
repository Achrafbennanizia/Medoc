import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../models/store/auth-store";
import { useUiPreferencesStore } from "../../models/store/ui-preferences-store";
import { checkSession, logout, touchSession } from "@/systems/practice-host/controllers/auth.controller";
import { listPatients } from "@/systems/practice-host/controllers/patient.controller";
import { breakGlassActivate } from "@/systems/practice-host/controllers/break-glass.controller";
import { BREAK_GLASS_ENABLED } from "@/lib/mvp-security-config";
import { countChartsToValidate } from "@/systems/practice-host/controllers/chart-workflow.controller";
import { countOpenPracticeTasksForMe } from "@/systems/practice-host/controllers/practice-task.controller";
import { NAV_SECTIONS } from "@/lib/nav-sections";
import { NAV_ITEM_DEFINITIONS, navItemVisible, routeChildPathAllowed, allowed, parseRole, type NavItemDefinition } from "@/lib/rbac";
import { useT, useTParams, useLocale, translateLocale, applyDocumentLocale } from "@/lib/i18n";
import { breadcrumbKeysForPath } from "@/lib/breadcrumb-keys";
import type { Patient } from "../../models/types";
import { ExportPreviewHost } from "../components/export-preview-host";
import { TableColumnEstimatorHost } from "../components/table-column-estimator-host";
import { shouldShowPracticeSetupWizard } from "@/lib/practice-completeness";
import { PracticeSetupWizard } from "../components/practice-setup-wizard";
import { useDesktopChromeMode } from "../components/desktop-chrome";
import { errorMessage, initialsFromName } from "@/lib/utils";
import { useToastStore } from "../components/ui/toast-store";
import { ConfirmDialog, Dialog } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Select, Textarea } from "../components/ui/input";
import { BellIcon, ChevronDownIcon, ChevronRightIcon, DownloadIcon, ICON_SIZE_LG, ICON_SIZE_MD, ICON_SIZE_SM, MenuIcon, NAV_ICONS, PinIcon, PlusIcon, SearchIcon, WifiIcon } from "@/lib/icons";
import { filterCommandsForRole } from "@/lib/command-palette-data";
import { CommandPalette } from "../components/command-palette";
import { AboutAppDialog, RoleSwitchDialog } from "../components/app-help-dialogs";
import { OnboardingCoachmark } from "../components/onboarding-coachmark";
import { PAGE_REFRESH_EVENT, PAGE_REFRESH_HIDDEN_MS, PAGE_REFRESH_MS } from "./page-refresh";
import { ONBOARDING_COACHMARK_ENABLED } from "@/lib/v1-ui-flags";
import { NotificationsPopover } from "../components/notifications-popover";
import { probeBackgroundServers } from "@/systems/practice-host/controllers/connectivity.controller";
import { checkForUpdates, openNativePrintDialog } from "@/systems/practice-host/controllers/system.controller";
import { useDismissibleLayer } from "../components/ui/use-dismissible-layer";
import { UserAccountMenuDropdown } from "../components/user-account-menu";
import { SyncStatusBadge } from "../components/sync-status-badge";
import { AuditChainBanner } from "../components/audit-chain-banner";
import { InitialCopyBanner } from "../components/initial-copy-banner";
import { BreakGlassBanner } from "../components/break-glass-banner";
import { applyAppearanceFromSettings, isNetworkHiddenInSettings, loadClientSettings } from "@/lib/client-settings";
import { practiceCurrency, subscribePracticeCurrency } from "@/lib/practice-currency";
import {
    hydratePracticeTimezoneFromAppKv,
    practiceTimezone,
    subscribePracticeTimezone,
} from "@/lib/practice-timezone";
import { getAppKv } from "@/systems/practice-host/controllers/app-kv.controller";
import { setNetworkHidden } from "@/systems/practice-host/controllers/cluster.controller";
import {
    hydrateInvoicePracticeFromAppKv,
    migrateInvoicePracticeLocalStorageToAppKv,
} from "@/lib/invoice-service-item";
import { hydratePracticeHeaderPrivacy } from "@/lib/practice-header-privacy";
import { buildSyncNativeMenuPayload, MEDOC_PENDING_APPOINTMENT_MENU_KEY } from "@/lib/native-go-menu";
import { syncNativeMenu } from "@/systems/practice-host/controllers/native-menu.controller";
import { workTimeGetPreference, workTimeSetPreference } from "@/systems/practice-host/controllers/work-time.controller";
import { subscribeWorkTimeFocusMode, dispatchWorkTimeFocusMode } from "@/lib/work-time-focus-mode";
import { subscribeAppMenu } from "@/lib/native-app-menu-bridge";
import { useMacWindowDrag } from "@/lib/mac-window-drag";

import { OPEN_HELP_EVENT } from "@/views/components/ui/toast-store";
import { useIdleLock } from "@/hooks/use-idle-lock";
import { useNotificationCenter } from "@/systems/practice-host/notifications/notification-center";
import { useNotificationPolling } from "@/systems/practice-host/notifications/use-notification-polling";
import { drawsOwnWindowControls } from "@/views/components/resolve-desktop-chrome-mode";
import { WindowControls } from "@/views/components/window-controls";
import { useMainVisibleHeight } from "@/hooks/use-main-visible-height";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { AppRouteOutlet } from "./shell/app-route-outlet";
import { measureSidebarAccountMenuWidthPx, type SidebarAccountPopoverFixed } from "./shell/account-menu-width";
import { QueueExchangeBar } from "./shell/queue-exchange-bar";
import { NavCountBadge } from "./shell/nav-count-badge";
import { useGuestInboxBadge } from "./shell/use-guest-inbox-badge";
import { useSidebarRail } from "./shell/use-sidebar-rail";
import { useUiZoom } from "./shell/use-ui-zoom";

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
    const [chartsToValidateCount, setChartsToValidateCount] = useState(0);
    const [openPracticeTasksCount, setOpenPracticeTasksCount] = useState(0);
    const pendingProposals = useGuestInboxBadge(session?.user_id);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    /** Matches CSS breakpoint where shell uses persistent narrow sidebar strip vs overlay drawer. */
    const [wideShellLayout, setWideShellLayout] = useState(() =>
        typeof window !== "undefined" ? window.matchMedia("(min-width: 900px)").matches : true,
    );
    /** Help texts from native menu (Windows/Linux menu bar or macOS menu). */
    const [nativeHelpTopic, setNativeHelpTopic] = useState<null | "calendar" | "shortcuts">(null);
    const [practiceSetupOpen, setPracticeSetupOpen] = useState(() => shouldShowPracticeSetupWizard());
    const [aboutOpen, setAboutOpen] = useState(false);
    const [aboutVersion, setAboutVersion] = useState("");
    const { zoomIn, zoomOut, zoomReset } = useUiZoom();
    const { rail: sidebarRailPref, toggleRail } = useSidebarRail();
    const [userMenuAnchor, setUserMenuAnchor] = useState<"sidebar" | "topbar">("sidebar");
    const userMenuAnchorRef = useRef(userMenuAnchor);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const sidebarAccountPopoverRef = useRef<HTMLDivElement>(null);
    const [sidebarAccountPopoverFixed, setSidebarAccountPopoverFixed] = useState<SidebarAccountPopoverFixed | null>(null);
    const topbarMenuRef = useRef<HTMLDivElement>(null);
    const notifWrapRef = useRef<HTMLDivElement>(null);
    const desktopChrome = useDesktopChromeMode();
    useEffect(() => {
        if (!__CAP_WORK_TIME__ || !session?.user_id) return;
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
        () => filterCommandsForRole(session?.role, session?.permission_overrides),
        [session?.role, session?.permission_overrides],
    );
    const breadcrumbKeys = useMemo(() => breadcrumbKeysForPath(location.pathname), [location.pathname]);
    const breadcrumbs = useMemo(() => breadcrumbKeys.map((k) => t(k)), [breadcrumbKeys, t]);
    const isDashboardRoute = location.pathname === "/";
    const isAppointmentsCalendarRoute = location.pathname === "/appointments";
    const visibleNavItems = useMemo(
        () =>
            NAV_ITEM_DEFINITIONS.filter((item) =>
                navItemVisible(session?.role, item, session?.permission_overrides),
            ),
        [session?.role, session?.permission_overrides],
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
    const initials = initialsFromName(session?.name ?? "MD");
    const profileRoleLine = useMemo(() => {
        const r = session?.role;
        if (r === "PHYSICIAN") return t("app.role_label.PHYSICIAN");
        if (r === "RECEPTION") return t("app.role_label.RECEPTION");
        // TODO(deferred-roles): if (r === "TAX_ADVISOR") return t("app.role_label.TAX_ADVISOR");
        // TODO(deferred-roles): if (r === "PHARMA_CONSULTANT") return t("app.role_label.PHARMA_CONSULTANT");
        return "";
    }, [session?.role, t]);

    /** Notification center (all sources: inbox, tasks, reminders, stock, security) — single unread count. */
    const notifUnread = useNotificationCenter((st) => st.unreadCount);
    const refreshNotifications = useNotificationCenter((st) => st.refresh);
    const notifDelivery = useMemo(() => ({ toast: (m: string, type: "info" | "warning" | "error") => toast(m, type) }), [toast]);
    const notifUserId = session?.user_id;
    const notifRole = session?.role ?? "";
    useNotificationPolling({ userId: notifUserId, role: notifRole, t, tp, delivery: notifDelivery });
    const refreshInAppUnread = useCallback(async () => {
        if (!notifUserId) return;
        await refreshNotifications({ userId: notifUserId, role: notifRole, t, tp }, notifDelivery);
    }, [notifUserId, notifRole, refreshNotifications, t, tp, notifDelivery]);

    const refreshNavBadges = useCallback(async () => {
        const role = session?.role;
        if (role !== "PHYSICIAN" && role !== "RECEPTION") {
            setChartsToValidateCount(0);
            setOpenPracticeTasksCount(0);
            return;
        }
        try {
            if (role === "PHYSICIAN") {
                const [charts, tasks] = await Promise.all([
                    __CAP_VALIDATION__ ? countChartsToValidate() : 0,
                    __CAP_TASKS__ ? countOpenPracticeTasksForMe() : 0,
                ]);
                setChartsToValidateCount(typeof charts === "number" && charts > 0 ? charts : 0);
                setOpenPracticeTasksCount(typeof tasks === "number" && tasks > 0 ? tasks : 0);
            } else {
                const tasks = __CAP_TASKS__ ? await countOpenPracticeTasksForMe() : 0;
                setChartsToValidateCount(0);
                setOpenPracticeTasksCount(typeof tasks === "number" && tasks > 0 ? tasks : 0);
            }
        } catch {
            setChartsToValidateCount(0);
            setOpenPracticeTasksCount(0);
        }
    }, [session?.role]);

    // Every desktop mode uses the unified top bar as its drag region (threshold drag, double-click maximize).
    const handleMacWindowDrag = useMacWindowDrag(desktopChrome !== "browser");
    /** Main scroll area — its visible height sizes sticky detail panels (see useMainVisibleHeight). */
    const mainRef = useRef<HTMLElement | null>(null);
    useMainVisibleHeight(mainRef);
    useGlobalShortcuts();

    useEffect(() => {
        void refreshNavBadges();
    }, [refreshNavBadges, location.pathname]);

    useEffect(() => {
        const id = window.setInterval(() => {
            void refreshNavBadges();
        }, 120_000);
        return () => window.clearInterval(id);
    }, [refreshNavBadges]);

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

    /** Native menubar: RBAC-aligned payload (desktop); warn-only on browser / IPC failure. */
    useEffect(() => {
        if (!session?.role) return;
        const payload = buildSyncNativeMenuPayload(session.role, (key) => translateLocale(locale, key));
        void syncNativeMenu(payload).catch((err) => {
            console.error("sync_native_menu failed", err);
        });
    }, [session?.role, locale]);

    /** Matches native menu actions (⌘K/⌘⇧P Befehlspalette, ⌘N Appointment, Zoom, Neu laden). */
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

            if (e.code === "Equal" || e.code === "NumpadAdd") {
                e.preventDefault();
                zoomIn();
                return;
            }
            if (e.code === "Minus" || e.code === "NumpadSubtract") {
                e.preventDefault();
                zoomOut();
                return;
            }
            if (e.code === "Digit0" || e.code === "Numpad0") {
                e.preventDefault();
                zoomReset();
                return;
            }

            if (key === "n" && !e.shiftKey) {
                if (location.pathname.startsWith("/appointments")) return;
                const acct = useAuthStore.getState().session;
                if (!routeChildPathAllowed("appointments/new", acct?.role, acct?.permission_overrides)) return;
                e.preventDefault();
                navigate("/appointments/new");
                setMobileNavOpen(false);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [navigate, location.pathname, zoomIn, zoomOut, zoomReset]);

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
            navigate("/help");
        };
        /** "Code MD-… · What does this mean?" in toasts / inline errors → Help center at that code. */
        const onOpenHelp = (e: Event) => {
            const detail = (e as CustomEvent<{ tab?: string; code?: string }>).detail ?? {};
            const q = new URLSearchParams();
            if (detail.tab) q.set("tab", detail.tab);
            if (detail.code) q.set("q", detail.code);
            const qs = q.toString();
            navigate(qs ? `/help?${qs}` : "/help");
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener(OPEN_HELP_EVENT, onOpenHelp);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener(OPEN_HELP_EVENT, onOpenHelp);
        };
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
        applyAppearanceFromSettings(loadClientSettings());
    }, []);

    useEffect(() => {
        let id = 0;
        const arm = () => {
            window.clearInterval(id);
            const hidden = document.visibilityState === "hidden";
            id = window.setInterval(() => {
                const el = document.activeElement;
                if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
                if (el instanceof HTMLElement && el.isContentEditable) return;
                if (document.querySelector("[role='dialog'], dialog[open]")) return;
                window.dispatchEvent(new Event(PAGE_REFRESH_EVENT));
            }, hidden ? PAGE_REFRESH_HIDDEN_MS : PAGE_REFRESH_MS);
        };
        arm();
        document.addEventListener("visibilitychange", arm);
        return () => {
            window.clearInterval(id);
            document.removeEventListener("visibilitychange", arm);
        };
    }, []);

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
                await migrateInvoicePracticeLocalStorageToAppKv();
                await hydrateInvoicePracticeFromAppKv();
                await hydratePracticeHeaderPrivacy();
                await hydratePracticeTimezoneFromAppKv(() => getAppKv("practice.timezone.v1"));
                const { hydrateDocumentLocaleFromAppKv } = await import("@/lib/document-locale");
                await hydrateDocumentLocaleFromAppKv();
                const { hydrateUiPrefsFromDisk } = await import(
                    "@/systems/practice-host/controllers/ui-prefs.controller"
                );
                await hydrateUiPrefsFromDisk(sessionUserId);
                applyAppearanceFromSettings(loadClientSettings());
            } catch (e) {
                toast(tp("app.layout.practice_sync_error", { message: errorMessage(e) }), "warning");
            }
        })();
    }, [sessionUserId, toast, tp]);

    useEffect(() => {
        if (!__CAP_NET__ || !sessionUserId) return;
        if (!isNetworkHiddenInSettings(loadClientSettings())) return;
        void setNetworkHidden(true).catch(() => undefined);
    }, [sessionUserId]);

    const practiceCurrencyCode = useSyncExternalStore(subscribePracticeCurrency, practiceCurrency, practiceCurrency);
    const practiceTimeZoneId = useSyncExternalStore(subscribePracticeTimezone, practiceTimezone, practiceTimezone);

    useIdleLock(Boolean(session), {
        onWarn: (secondsLeft) =>
            toast(tp("settings.security.idle_warning", { seconds: secondsLeft }), "warning", { durationMs: 15_000 }),
        onResume: () => {
            /* warning toast auto-dismisses; nothing else to undo */
        },
        onLock: async () => {
            await logout();
            toast(t("settings.security.idle_signed_out"), "info", { durationMs: 8_000 });
            navigate("/login");
        },
    });

    useEffect(() => {
        if (!breakOpen) return;
        listPatients()
            .then(setBgPatients)
            .catch((e) => {
                setBgPatients([]);
                toast(tp("app.layout.break_glass.toast_patients_error", { message: errorMessage(e) }), "error");
            });
    }, [breakOpen, toast, tp]);

    useEffect(() => {
        let cancelled = false;
        let timer: number | null = null;
        const schedule = (ms: number) => {
            if (timer != null) window.clearTimeout(timer);
            timer = window.setTimeout(() => {
                void tick();
            }, ms);
        };
        const tick = async () => {
            const online = await probeBackgroundServers();
            if (cancelled) return;
            setIsOnline(online);
            schedule(online ? 15_000 : 5_000);
        };
        const onBrowserNet = () => {
            void tick();
        };
        const onVisible = () => {
            if (document.visibilityState === "visible") void tick();
        };
        void tick();
        window.addEventListener("online", onBrowserNet);
        window.addEventListener("offline", onBrowserNet);
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            cancelled = true;
            if (timer != null) window.clearTimeout(timer);
            window.removeEventListener("online", onBrowserNet);
            window.removeEventListener("offline", onBrowserNet);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, []);

    useEffect(() => {
        void checkForUpdates()
            .then((u) => {
                setUpdateAvailable(Boolean(u.update_available));
                setUpdateLatestVersion(u.latest_version ?? "");
            })
            .catch((e) => {
                setUpdateAvailable(false);
                console.warn("Update check failed", e);
            });
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
            if (BREAK_GLASS_ENABLED && session?.role === "PHYSICIAN") labels.push(t("app.layout.break_glass.emergency_access"));
            labels.push(t("auth.logout"));
            const measured = measureSidebarAccountMenuWidthPx(labels);
            // Match the user-card width so the menu stays anchored (esp. RTL / Arabic labels).
            const widthPx = Math.max(measured, Math.round(r.width));
            const rtl =
                typeof document !== "undefined" &&
                getComputedStyle(document.documentElement).direction === "rtl";
            let left = rtl ? r.right - widthPx : r.left;
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
    }, [userMenuOpen, userMenuAnchor, sidebarRailPref, sidebarProfileDisplayOnly, session?.role, t]);

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
                    navigate("/settings");
                }}
            >
                {t("nav.settings")}
            </button>
            {BREAK_GLASS_ENABLED && session?.role === "PHYSICIAN" ? (
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
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`);
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
                            if (!routeChildPathAllowed(routeKey, acct?.role, acct?.permission_overrides)) {
                                useToastStore.getState().add(translateLocale(locale, "app.native_menu.denied"));
                                return;
                            }
                            navigate(p.path);
                            setMobileNavOpen(false);
                            return;
                        }
                        if (p.kind === "appointment" && typeof p.action === "string") {
                            const acct = useAuthStore.getState().session;
                            if (!routeChildPathAllowed("appointments", acct?.role, acct?.permission_overrides)) {
                                useToastStore.getState().add(translateLocale(locale, "app.native_menu.denied"));
                                return;
                            }
                            if (location.pathname !== "/appointments") {
                                try {
                                    sessionStorage.setItem(MEDOC_PENDING_APPOINTMENT_MENU_KEY, p.action);
                                } catch {
                                    /* ignore */
                                }
                                navigate("/appointments");
                                setMobileNavOpen(false);
                                return;
                            }
                            window.dispatchEvent(new CustomEvent("medoc-native-menu-appointment", { detail: p.action }));
                            return;
                        }
                        if (p.kind === "app" && typeof p.action === "string") {
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
                                zoomIn();
                                return;
                            }
                            if (p.action === "zoom_out") {
                                zoomOut();
                                return;
                            }
                            if (p.action === "zoom_reset") {
                                zoomReset();
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
                                                    message: errorMessage(e),
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
    }, [navigate, location.pathname, locale, tp, zoomIn, zoomOut, zoomReset]);

    /** Brand + toolbar in the title-bar row: macOS (traffic lights), Windows and Linux (own buttons). */
    const isMacUnifiedChrome = desktopChrome !== "browser";

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
                    toggleRail();
                }}
            >
                <span className="app-sidebar-brand-mark" aria-hidden>
                    <PinIcon size={18} />
                </span>
                <div className="app-sidebar-brand-meta">
                    <div className="app-sidebar-brand-title">MeDoc Dentist</div>
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
            <div className="crumb" title={breadcrumbs.join(" › ")}>
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
                    gap: "var(--space-2)",
                }}
            >
                <button type="button" className="input focus-ring topbar-search-trigger" onClick={openCommandPalette}>
                    <SearchIcon size={ICON_SIZE_SM} aria-hidden />
                    <span style={{ flex: 1, textAlign: "start", fontSize: 13, color: "var(--fg-3)" }}>{t("nav.search_short")}</span>
                    <span className="ui-kbd-hint" style={{ fontSize: 11, color: "var(--fg-4)" }}>
                        ⌘K
                    </span>
                </button>
                {updateAvailable ? (
                    <button
                        className="tb-chip update"
                        type="button"
                        onClick={() => navigate("/settings")}
                        title={tp("app.layout.update_available_title", { version: updateLatestVersion })}
                    >
                        <DownloadIcon size={12} />
                        {tp("app.layout.update_available", { version: updateLatestVersion })}
                    </button>
                ) : null}
                {__CAP_NET__ ? <SyncStatusBadge /> : null}
                <span
                    className={`tb-chip ${isOnline ? "live" : "offline"}`}
                    role="status"
                    title={isOnline ? t("app.layout.online_title") : t("app.layout.offline_title")}
                >
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
                        aria-label={
                            notifUnread > 0
                                ? tp("app.notifications.bell_aria_unread", { count: notifUnread })
                                : t("a11y.notifications_region")
                        }
                        aria-expanded={notifOpen}
                        onClick={() => {
                            setNotifOpen((o) => !o);
                            setUserMenuOpen(false);
                        }}
                    >
                        <BellIcon size={ICON_SIZE_LG} />
                        {notifUnread > 0 ? (
                            <span className="notif-badge" aria-hidden>
                                {notifUnread > 99 ? "99+" : notifUnread}
                            </span>
                        ) : null}
                    </button>
                    {notifOpen ? (
                        <NotificationsPopover
                            onClose={() => {
                                setNotifOpen(false);
                                void refreshNavBadges();
                            }}
                        />
                    ) : null}
                </div>
                <div ref={topbarMenuRef} style={{ position: "relative" }}>
                    <button
                        type="button"
                        className="btn btn-subtle"
                        style={{
                            paddingBlock: "var(--space-1)",
                            paddingInlineStart: "var(--space-1)",
                            paddingInlineEnd: "var(--space-2)",
                            fontSize: 12,
                            borderRadius: 999,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "var(--space-2)",
                            flexShrink: 0,
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
                            emailFallback={session?.email ?? "practice@medoc.de"}
                            logoutLabel={t("auth.logout")}
                            onRoleSwitch={() => {
                                setUserMenuOpen(false);
                                setRoleSwitchOpen(true);
                            }}
                            onSettings={() => {
                                navigate("/settings");
                                setUserMenuOpen(false);
                            }}
                            onShortcuts={() => {
                                setUserMenuOpen(false);
                                navigate("/help");
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

            {__CAP_NET__ ? <InitialCopyBanner /> : null}
            <AuditChainBanner
                canAcknowledge={
                    !!session &&
                    parseRole(session.role) != null &&
                    allowed(
                        "ops.audit_chain_ack",
                        parseRole(session.role)!,
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
                    {drawsOwnWindowControls(desktopChrome) ? <WindowControls platform={desktopChrome} /> : null}
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
                                            end={item.to !== "/patients"}
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
                                            {item.to === "/charts/to-validate" ? <NavCountBadge count={chartsToValidateCount} label={tp("app.layout.nav_badge_charts_pending", { count: chartsToValidateCount })} /> : null}
                                            {item.to === "/tickets" ? <NavCountBadge count={openPracticeTasksCount} label={tp("app.layout.nav_badge_tickets_open", { count: openPracticeTasksCount })} /> : null}
                                            {item.to === "/inbox" ? <NavCountBadge count={pendingProposals} label={tp("app.layout.nav_badge_inbox", { count: pendingProposals })} /> : null}
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
                    ref={mainRef}
                    id="main-content"
                    tabIndex={-1}
                    className={`app-main${isDashboardRoute || isAppointmentsCalendarRoute ? " app-main--fill-y" : " app-main--scroll-y"}`}
                    aria-label={t("app.title")}
                >
                    {__CAP_NET__ ? <QueueExchangeBar pathname={location.pathname} /> : null}
                    <AppRouteOutlet
                        currency={practiceCurrencyCode}
                        timeZone={practiceTimeZoneId}
                        loadingLabel={t("common.loading")}
                    />
                </main>
            </div>
            </div>

            {ONBOARDING_COACHMARK_ENABLED ? <OnboardingCoachmark role={session?.role} /> : null}
            <ExportPreviewHost />
            <TableColumnEstimatorHost />
            <PracticeSetupWizard open={practiceSetupOpen} onClose={() => setPracticeSetupOpen(false)} />

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
                <p style={{ color: "var(--fg-3)", fontSize: 14, marginBottom: "var(--space-3)" }}>
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
