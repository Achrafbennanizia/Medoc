import { Fragment, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../models/store/auth-store";
import { useUiPreferencesStore } from "../../models/store/ui-preferences-store";
import { checkSession, logout, touchSession } from "../../controllers/auth.controller";
import { listPatienten } from "../../controllers/patient.controller";
import { breakGlassActivate } from "../../controllers/break-glass.controller";
import { NAV_ITEM_DEFINITIONS, navItemVisible, routeChildPathAllowed, type NavItemDefinition } from "../../lib/rbac";
import { useT, useLocale, translateLocale } from "../../lib/i18n";
import type { Patient } from "../../models/types";
import { ExportPreviewHost } from "../components/export-preview-host";
import { useToastStore } from "../components/ui/toast-store";
import { ToastContainer } from "../components/ui/toast";
import { ConfirmDialog, Dialog } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Select, Textarea } from "../components/ui/input";
import { BellIcon, ChevronDownIcon, ChevronRightIcon, DownloadIcon, MenuIcon, NAV_ICONS, PinIcon, PlusIcon, SearchIcon, WifiIcon } from "@/lib/icons";
import { filterCommandsForRole } from "@/lib/command-palette-data";
import { CommandPalette } from "../components/command-palette";
import { AboutAppDialog, RoleSwitchDialog } from "../components/app-help-dialogs";
import { NotificationsPopover } from "../components/notifications-popover";
import { checkForUpdates } from "@/controllers/system.controller";
import { useDismissibleLayer } from "../components/ui/use-dismissible-layer";
import { UserAccountMenuDropdown } from "../components/user-account-menu";
import { BreakGlassBanner } from "../components/break-glass-banner";
import { PageLoading } from "../components/ui/page-status";
import { loadClientSettings } from "../../lib/client-settings";
import { buildSyncNativeMenuPayload, MEDOC_PENDING_TERMIN_MENU_KEY } from "@/lib/native-go-menu";
import { syncNativeMenu } from "@/controllers/native-menu.controller";
import { subscribeAppMenu } from "@/lib/native-app-menu-bridge";

function breadcrumbsForPath(pathname: string): string[] {
    if (pathname === "/termine/neu") return ["MeDoc", "Terminübersicht", "Neuer Termin"];
    if (pathname === "/finanzen/neu") return ["MeDoc", "Finanzen", "Neue Zahlung"];
    if (pathname === "/bestellungen/neu") return ["MeDoc", "Bestellungen", "Neue Bestellung"];
    if (pathname === "/patienten/neu") return ["MeDoc", "Patienten", "Neuer Patient"];
    if (pathname === "/bilanz/neu") return ["MeDoc", "Bilanz", "Neuer Bilanz"];
    if (pathname === "/verwaltung") return ["MeDoc", "Verwaltung"];
    if (pathname === "/verwaltung/arbeitstage") return ["MeDoc", "Verwaltung", "Arbeitstage"];
    if (pathname === "/verwaltung/praxisplanung") return ["MeDoc", "Verwaltung", "Praxisplanung"];
    if (pathname === "/verwaltung/arbeitszeiten") return ["MeDoc", "Verwaltung", "Arbeitszeiten"];
    if (pathname === "/verwaltung/sonder-sperrzeiten") return ["MeDoc", "Verwaltung", "Sonder-Sperrzeiten"];
    if (pathname === "/verwaltung/praxis-praeferenzen") return ["MeDoc", "Verwaltung", "Praxis-Präferenzen"];
    if (pathname === "/verwaltung/vorlagen") return ["MeDoc", "Verwaltung", "Vorlagen"];
    if (pathname === "/verwaltung/behandlungs-katalog") return ["MeDoc", "Verwaltung", "Behandlungskatalog"];
    if (pathname === "/verwaltung/bestellstamm") return ["MeDoc", "Verwaltung", "Bestell-Stammdaten"];
    if (pathname === "/verwaltung/finanzen-berichte") return ["MeDoc", "Verwaltung", "Finanzen & Berichte"];
    if (pathname === "/verwaltung/team") return ["MeDoc", "Verwaltung", "Team"];
    if (pathname === "/verwaltung/finanzen-berichte/tagesabschluss") {
        return ["MeDoc", "Verwaltung", "Finanzen & Berichte", "Tagesabschluss"];
    }
    if (pathname === "/verwaltung/finanzen-berichte/rechnung") {
        return ["MeDoc", "Verwaltung", "Finanzen & Berichte", "Rechnung (PDF)"];
    }
    if (pathname === "/verwaltung/lager-und-bestellwesen") return ["MeDoc", "Verwaltung", "Lager, Produkte & Bestellwesen"];
    if (pathname === "/verwaltung/vertraege") return ["MeDoc", "Verwaltung", "Lager, Produkte & Bestellwesen", "Verträge"];
    if (pathname === "/verwaltung/leistungen-kataloge-vorlagen") {
        return ["MeDoc", "Verwaltung", "Leistungen, Kataloge & Vorlagen"];
    }
    if (pathname === "/verwaltung/finanzen-werkzeuge") return ["MeDoc", "Verwaltung", "Finanzen & Berichte", "Rechnung (PDF)"];
    if (pathname === "/verwaltung/tagesabschluss") return ["MeDoc", "Verwaltung", "Finanzen & Berichte", "Tagesabschluss"];
    if (pathname.startsWith("/verwaltung/vorlagen/editor")) return ["MeDoc", "Verwaltung", "Vorlagen", "Editor"];
    if (pathname === "/personal/neu") return ["MeDoc", "Verwaltung", "Neues Personal"];
    if (pathname === "/personal/arbeitsplan") return ["MeDoc", "Verwaltung", "Personal", "Arbeitsplan & Einsätze"];
    if (pathname.startsWith("/patienten/") && pathname !== "/patienten/neu") {
        if (/\/rezept\/neu$/.test(pathname)) {
            return ["MeDoc", "Patienten", "Akte", "Neues Rezept"];
        }
        if (/\/rezept\//.test(pathname) && !/\/rezept\/neu$/.test(pathname)) {
            return ["MeDoc", "Patienten", "Akte", "Rezept bearbeiten"];
        }
        return ["MeDoc", "Patienten", "Akte"];
    }
    return CRUMBS[pathname] ?? ["MeDoc", "Dashboard"];
}

const CRUMBS: Record<string, string[]> = {
    "/": ["MeDoc", "Benachrichtigungen"],
    "/termine": ["MeDoc", "Terminübersicht"],
    "/termine/neu": ["MeDoc", "Terminübersicht", "Neuer Termin"],
    "/patienten": ["MeDoc", "Patienten"],
    "/finanzen": ["MeDoc", "Finanzen"],
    "/finanzen/neu": ["MeDoc", "Finanzen", "Neue Zahlung"],
    "/bestellungen": ["MeDoc", "Bestellungen"],
    "/bilanz": ["MeDoc", "Bilanz"],
    "/bilanz/neu": ["MeDoc", "Bilanz", "Neuer Bilanz"],
    "/verwaltung": ["MeDoc", "Verwaltung"],
    "/verwaltung/arbeitstage": ["MeDoc", "Verwaltung", "Arbeitstage"],
    "/verwaltung/praxisplanung": ["MeDoc", "Verwaltung", "Praxisplanung"],
    "/verwaltung/arbeitszeiten": ["MeDoc", "Verwaltung", "Arbeitszeiten"],
    "/verwaltung/sonder-sperrzeiten": ["MeDoc", "Verwaltung", "Sonder-Sperrzeiten"],
    "/verwaltung/praxis-praeferenzen": ["MeDoc", "Verwaltung", "Praxis-Präferenzen"],
    "/verwaltung/vorlagen": ["MeDoc", "Verwaltung", "Vorlagen"],
    "/verwaltung/behandlungs-katalog": ["MeDoc", "Verwaltung", "Behandlungskatalog"],
    "/verwaltung/bestellstamm": ["MeDoc", "Verwaltung", "Bestell-Stammdaten"],
    "/verwaltung/finanzen-berichte": ["MeDoc", "Verwaltung", "Finanzen & Berichte"],
    "/verwaltung/lager-und-bestellwesen": ["MeDoc", "Verwaltung", "Lager, Produkte & Bestellwesen"],
    "/verwaltung/vertraege": ["MeDoc", "Verwaltung", "Lager, Produkte & Bestellwesen", "Verträge"],
    "/verwaltung/leistungen-kataloge-vorlagen": ["MeDoc", "Verwaltung", "Leistungen, Kataloge & Vorlagen"],
    "/verwaltung/finanzen-werkzeuge": ["MeDoc", "Verwaltung", "Finanzen & Berichte", "Rechnung (PDF)"],
    "/verwaltung/finanzen-berichte/tagesabschluss": ["MeDoc", "Verwaltung", "Finanzen & Berichte", "Tagesabschluss"],
    "/verwaltung/finanzen-berichte/rechnung": ["MeDoc", "Verwaltung", "Finanzen & Berichte", "Rechnung (PDF)"],
    "/verwaltung/tagesabschluss": ["MeDoc", "Verwaltung", "Finanzen & Berichte", "Tagesabschluss"],
    "/rezepte": ["MeDoc", "Rezepte & Atteste"],
    "/atteste": ["MeDoc", "Atteste"],
    "/leistungen": ["MeDoc", "Leistungen"],
    "/produkte": ["MeDoc", "Produkte"],
    "/personal": ["MeDoc", "Verwaltung", "Team", "Personal"],
    "/verwaltung/team": ["MeDoc", "Verwaltung", "Team"],
    "/personal/arbeitsplan": ["MeDoc", "Verwaltung", "Team", "Arbeitsplan & Einsätze"],
    "/statistik": ["MeDoc", "Statistiken"],
    "/audit": ["MeDoc", "Audit-Log"],
    "/datenschutz": ["MeDoc", "Datenschutz"],
    "/einstellungen": ["MeDoc", "Einstellungen"],
    "/logs": ["MeDoc", "Logs"],
    "/ops": ["MeDoc", "Betrieb"],
    "/compliance": ["MeDoc", "Compliance"],
    "/hilfe": ["MeDoc", "Hilfe"],
    "/feedback": ["MeDoc", "Feedback"],
    "/migration": ["MeDoc", "Datenmigration"],
};

const NAV_SECTIONS: Array<{ label: string; items: string[] }> = [
    { label: "Übersicht", items: ["/", "/termine"] },
    { label: "Behandlung", items: ["/patienten", "/rezepte", "/statistik"] },
    { label: "Praxis", items: ["/finanzen", "/bestellungen", "/verwaltung", "/einstellungen"] },
];

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
    const locale = useLocale((s) => s.locale);
    const toast = useToastStore((s) => s.add);
    const [breakOpen, setBreakOpen] = useState(false);
    const [bgReason, setBgReason] = useState("");
    const [bgPatientId, setBgPatientId] = useState("");
    const [bgPatients, setBgPatients] = useState<Patient[]>([]);
    const [bgBusy, setBgBusy] = useState(false);
    const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
    const [commandOpen, setCommandOpen] = useState(false);
    const [roleSwitchOpen, setRoleSwitchOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    /** Matches CSS breakpoint where shell uses persistent narrow sidebar strip vs overlay drawer. */
    const [wideShellLayout, setWideShellLayout] = useState(() =>
        typeof window !== "undefined" ? window.matchMedia("(min-width: 900px)").matches : true,
    );
    /** Hilfe-Texte aus dem nativen Menü (Windows/Linux-Menüleiste bzw. macOS-Menü). */
    const [nativeHelpTopic, setNativeHelpTopic] = useState<null | "calendar" | "shortcuts">(null);
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

    const paletteCommands = useMemo(() => filterCommandsForRole(session?.rolle), [session?.rolle]);
    const breadcrumbs = useMemo(() => breadcrumbsForPath(location.pathname), [location.pathname]);
    const isDashboardRoute = location.pathname === "/";
    const isTermineCalendarRoute = location.pathname === "/termine";
    const visibleNavItems = useMemo(
        () => NAV_ITEM_DEFINITIONS.filter((item) => navItemVisible(session?.rolle, item)),
        [session?.rolle],
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
        if (r === "STEUERBERATER") return t("app.role_label.STEUERBERATER");
        if (r === "PHARMABERATER") return t("app.role_label.PHARMABERATER");
        return "";
    }, [session?.rolle, t]);

    // Inactivity guard (FA-AUTH-03 / NFA-SEC-09): the backend expires sessions after 30 min.
    // Throttle activity pings to once every 30 s and poll the session status
    // every minute so the UI auto-redirects on expiry.
    useEffect(() => {
        document.documentElement.lang = locale;
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

    /** Narrow strip: kein Konto-Menü in der Leiste — nur Anzeige (Name); Menü über Topbar. */
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
                const rolle = useAuthStore.getState().session?.rolle;
                if (!routeChildPathAllowed("termine/neu", rolle)) return;
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
        listPatienten().then(setBgPatients).catch(() => { setBgPatients([]); });
    }, [breakOpen]);

    useEffect(() => {
        const onOnline = () => setIsOnline(true);
        const onOffline = () => setIsOnline(false);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        void checkForUpdates()
            .then((u) => setUpdateAvailable(Boolean(u.update_available)))
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
            const labels = ["Einstellungen"];
            if (session?.rolle === "ARZT") labels.push("Notfallzugriff");
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
                Einstellungen
            </button>
            {session?.rolle === "ARZT" ? (
                <button
                    type="button"
                    role="menuitem"
                    className="sidebar-account-popover__item sidebar-account-popover__item--breakglass"
                    onClick={() => {
                        setUserMenuOpen(false);
                        setBreakOpen(true);
                    }}
                >
                    Notfallzugriff
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
            toast("Begründung: mindestens 10 Zeichen.");
            return;
        }
        setBgBusy(true);
        try {
            await breakGlassActivate(bgReason.trim(), bgPatientId || undefined);
            toast("Notfallzugriff protokolliert. Zeitfenster aktiv.");
            window.dispatchEvent(new Event("medoc-break-glass-refresh"));
            setBreakOpen(false);
            setBgReason("");
            setBgPatientId("");
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
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
                            const rolle = useAuthStore.getState().session?.rolle;
                            if (!routeChildPathAllowed(routeKey, rolle)) {
                                useToastStore.getState().add(translateLocale(locale, "app.native_menu.denied"));
                                return;
                            }
                            navigate(p.path);
                            setMobileNavOpen(false);
                            return;
                        }
                        if (p.kind === "termin" && typeof p.action === "string") {
                            const rolle = useAuthStore.getState().session?.rolle;
                            if (!routeChildPathAllowed("termine", rolle)) {
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

    return (
        <div className="app">
            {/* First in tab order: bypass sidebar (WCAG 2.4.1) */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:px-3 focus:py-2 focus:bg-white focus:text-black focus:rounded"
            >
                {t("a11y.skip_to_main")}
            </a>

            <BreakGlassBanner userId={session?.user_id} />

            <div className="app-shell">
            <button
                type="button"
                className="app-sidebar-backdrop"
                data-open={mobileNavOpen ? "true" : "false"}
                aria-hidden={!mobileNavOpen}
                tabIndex={-1}
                onClick={() => setMobileNavOpen(false)}
            />
            <aside className="glass app-sidebar" data-open={mobileNavOpen ? "true" : "false"}>
                <div
                    className="app-sidebar-brand-row"
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 14px" }}
                >
                    <button
                        type="button"
                        className="app-sidebar-brand-hit app-sidebar-brand-hit--rail"
                        title={
                            sidebarRailPref === "icons"
                                ? `Navigationsleiste erweitern · ⌥/⌘-Klick: ${t("nav.search_short")}`
                                : `Navigationsleiste auf Symbole reduzieren · ⌥/⌘-Klick: ${t("nav.search_short")}`
                        }
                        aria-label={
                            sidebarRailPref === "icons"
                                ? "Navigationsleiste mit Beschriftungen erweitern"
                                : "Navigationsleiste auf Symbole reduzieren"
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
                <nav className="app-sidebar-scroll">
                    {NAV_SECTIONS.map((section) => {
                        const sectionItems = section.items
                            .map((to) => visibleByTo.get(to))
                            .filter((item): item is NonNullable<typeof item> => Boolean(item));
                        if (sectionItems.length === 0) return null;
                        return (
                            <Fragment key={section.label}>
                                <div className="sb-group-label">{section.label}</div>
                                {sectionItems.map((item) => {
                                    const label = t(item.labelKey);
                                    return (
                                        <NavLink
                                            key={item.to}
                                            to={item.to}
                                            end={item.to !== "/patienten"}
                                            className={({ isActive }) => `sb-item ${isActive ? "active" : ""}`}
                                            title={label}
                                            aria-label={label}
                                        >
                                            {(() => {
                                                const Ic = NAV_ICONS[item.to] ?? PinIcon;
                                                return <Ic size={16} aria-hidden />;
                                            })()}
                                            <span className="sb-item-label" aria-hidden="true">
                                                {label}
                                            </span>
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
                            aria-label={`Angemeldet als ${session?.name ?? "Benutzer"}`}
                            title={session?.name ?? undefined}
                        >
                            <div
                                className="av"
                                style={{
                                    width: 40,
                                    height: 40,
                                    fontSize: 16,
                                    background: "linear-gradient(135deg,#71DCC3,#1BAA8A)",
                                }}
                            >
                                {initials}
                            </div>
                            <div className="app-sidebar-user-lines app-sidebar-user-lines--narrow-strip" style={{ flex: 1, minWidth: 0 }}>
                                <div
                                    style={{
                                        fontWeight: 700,
                                        fontSize: 12.5,
                                        lineHeight: 1.2,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}
                                >
                                    {session?.name ?? "Benutzer"}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="app-sidebar-user-card"
                            aria-haspopup="menu"
                            aria-expanded={userMenuOpen && userMenuAnchor === "sidebar"}
                            aria-label="Konto: Einstellungen und Abmelden"
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
                            <div
                                className="av"
                                style={{
                                    width: 40,
                                    height: 40,
                                    fontSize: 16,
                                    background: "linear-gradient(135deg,#71DCC3,#1BAA8A)",
                                }}
                            >
                                {initials}
                            </div>
                            <div className="app-sidebar-user-lines" style={{ flex: 1, minWidth: 0 }}>
                                <div
                                    style={{
                                        fontWeight: 700,
                                        fontSize: 12.5,
                                        lineHeight: 1.2,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}
                                >
                                    {session?.name ?? "Benutzer"}
                                </div>
                                <div
                                    style={{
                                        color: "var(--fg-3)",
                                        fontSize: 10.5,
                                        lineHeight: 1.2,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}
                                >
                                    {profileRoleLine}
                                </div>
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
                          aria-label="Konto"
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

            <div style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, flex: 1 }}>
                <div className="topbar">
                    <button type="button" className="icon-btn mobile-nav-trigger" aria-label="Menü öffnen" onClick={() => setMobileNavOpen(true)}>
                        <MenuIcon size={18} />
                    </button>
                    <div className="crumb">
                        {breadcrumbs.map((c, i) => (
                            <Fragment key={`${c}-${i}`}>
                                {i > 0 && <span style={{ color: "var(--fg-4)" }}><ChevronRightIcon size={12} /></span>}
                                {i === breadcrumbs.length - 1 ? <b>{c}</b> : <span>{c}</span>}
                            </Fragment>
                        ))}
                    </div>
                    <div className="topbar-actions" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                            type="button"
                            className="input focus-ring topbar-search-trigger"
                            onClick={openCommandPalette}
                            style={{
                                background: "rgba(0,0,0,0.04)",
                                border: "none",
                                cursor: "pointer",
                            }}
                        >
                            <SearchIcon size={14} aria-hidden />
                            <span style={{ flex: 1, textAlign: "left", fontSize: 13, color: "var(--fg-3)" }}>{t("nav.search_short")}</span>
                            <span className="ui-kbd-hint" style={{ fontSize: 11, color: "var(--fg-4)" }}>⌘K</span>
                        </button>
                        {updateAvailable && <button className="tb-chip update" onClick={() => navigate("/einstellungen")}><DownloadIcon size={12} />Update 2026.4.3</button>}
                        <span className={`tb-chip ${isOnline ? "live" : ""}`}><WifiIcon size={12} />{isOnline ? "Online" : "Offline"}</span>
                        <button type="button" className="icon-btn" aria-label={t("nav.quick_add")} title={t("nav.quick_add")} onClick={openCommandPalette}>
                            <PlusIcon size={18} />
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
                                <BellIcon size={18} />
                                <span className="dot" aria-hidden />
                            </button>
                            {notifOpen ? <NotificationsPopover onClose={() => setNotifOpen(false)} /> : null}
                        </div>
                        <div ref={topbarMenuRef} style={{ position: "relative" }}>
                            <button
                                type="button"
                                className="btn btn-subtle"
                                style={{ padding: "4px 8px 4px 4px", fontSize: 12, borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 6 }}
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
                                <span
                                    className="av topbar-user-av"
                                    style={{
                                        width: 24,
                                        height: 24,
                                        fontSize: 10,
                                        background: "linear-gradient(135deg,#71DCC3,#1BAA8A)",
                                    }}
                                >
                                    {initials}
                                </span>
                                <ChevronDownIcon size={12} />
                            </button>
                            {userMenuOpen && userMenuAnchor === "topbar" ? (
                                <UserAccountMenuDropdown
                                    placement="below"
                                    initials={initials}
                                    name={session?.name ?? "Benutzer"}
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
                </div>
                <main id="main-content" tabIndex={-1} style={{ padding: "clamp(10px, 1.8vw, 24px)", display: "flex", flexDirection: "column", gap: 20, overflowY: isDashboardRoute || isTermineCalendarRoute ? "hidden" : "auto", overflowX: "hidden", flex: 1, minHeight: 0 }} aria-label={t("app.title")}>
                    <Suspense fallback={<PageLoading label="Seite wird geladen…" />}>
                        <Outlet />
                    </Suspense>
                </main>
            </div>
            </div>

            <ToastContainer />
            <ExportPreviewHost />

            <Dialog
                open={nativeHelpTopic === "calendar"}
                onClose={() => setNativeHelpTopic(null)}
                title="Kalender: Bedienung"
                footer={<Button onClick={() => setNativeHelpTopic(null)}>Schließen</Button>}
            >
                <p style={{ margin: 0, fontSize: 14, color: "var(--fg-2)", lineHeight: 1.55 }}>
                    Doppelklick: Slot · Rechtsklick: Aktionen · Ziehen: Zeit (Leiste) / Tag (Spalte); Tagesansicht:
                    Rand wechselt den Tag · Wochenansicht: links/rechts außerhalb des Rasters wechselt die Woche (max.
                    alle 0,5&nbsp;s) · Überschneidungen gleichen Behandlers: nachrücken.
                </p>
            </Dialog>
            <Dialog
                open={nativeHelpTopic === "shortcuts"}
                onClose={() => setNativeHelpTopic(null)}
                title="Hilfe & Kurzbefehle"
                footer={<Button onClick={() => setNativeHelpTopic(null)}>Schließen</Button>}
            >
                <p style={{ margin: 0, fontSize: 14, color: "var(--fg-2)", lineHeight: 1.55 }}>
                    Viele Aktionen erreichen Sie über die <strong>Menüleiste des Fensters</strong> (Datei mit Einträgen je nach
                    Rolle, Bearbeiten,
                    Gehe zu, Ansicht, Fenster, Hilfe) sowie die <strong>Befehlspalette</strong> (⌘K / Strg+K oder ⌘⇧P /
                    Strg+⇧P). Global (ohne Fokus in Eingabefeldern): ⌘N / Strg+N öffnet „Neuer Termin“, wo die Rolle es
                    erlaubt (nicht auf der Terminübersicht — dort siehe unten); ⌘R neu laden; ⌘+/⌘−/⌘0 Zoom. In der
                    Terminübersicht
                    gelten zusätzlich Tastenkürzel (auch mit ⌘ oder Strg gedrückt):{" "}
                    <kbd style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid var(--line)" }}>D</kbd> Tag,{" "}
                    <kbd style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid var(--line)" }}>W</kbd>{" "}
                    Woche,{" "}
                    <kbd style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid var(--line)" }}>M</kbd>{" "}
                    Monat,{" "}
                    <kbd style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid var(--line)" }}>N</kbd>{" "}
                    Neuer Termin,{" "}
                    <kbd style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid var(--line)" }}>T</kbd>{" "}
                    Heute, Pfeiltasten für den Zeitraum.
                </p>
            </Dialog>

            <AboutAppDialog
                open={aboutOpen}
                onClose={() => setAboutOpen(false)}
                appVersion={aboutVersion || import.meta.env.VITE_APP_VERSION}
            />

            <Dialog
                open={breakOpen}
                onClose={() => setBreakOpen(false)}
                title="Notfallzugriff (Break-Glass)"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setBreakOpen(false)}>Abbrechen</Button>
                        <Button onClick={() => void submitBreakGlass()} disabled={bgBusy} loading={bgBusy}>Bestätigen</Button>
                    </>
                }
            >
                <p style={{ color: "var(--fg-3)", fontSize: 14, marginBottom: 12 }}>
                    Aktivierung wird im Audit- und Security-Log protokolliert. Optional einen Patienten zuordnen.
                </p>
                <Select
                    id="bg-patient"
                    label="Patient (optional)"
                    value={bgPatientId}
                    onChange={(e) => setBgPatientId(e.target.value)}
                    options={[{ value: "", label: "— kein Bezug auf einen Patienten —" }, ...bgPatients.map((p) => ({ value: p.id, label: p.name }))]}
                />
                <Textarea
                    id="bg-reason"
                    label="Begründung (mind. 10 Zeichen)"
                    value={bgReason}
                    onChange={(e) => setBgReason(e.target.value)}
                    style={{ minHeight: 88 }}
                />
            </Dialog>
            <ConfirmDialog
                open={logoutConfirmOpen}
                onClose={() => setLogoutConfirmOpen(false)}
                onConfirm={async () => {
                    setLogoutConfirmOpen(false);
                    await handleLogout();
                }}
                title="Abmelden?"
                message="Nicht gespeicherte Änderungen gehen verloren. Sie können sich jederzeit wieder anmelden."
                confirmLabel="Abmelden"
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
