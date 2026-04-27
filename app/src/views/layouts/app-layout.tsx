import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../models/store/auth-store";
import { useUiPreferencesStore } from "../../models/store/ui-preferences-store";
import { checkSession, logout, touchSession } from "../../controllers/auth.controller";
import { listPatienten } from "../../controllers/patient.controller";
import { breakGlassActivate } from "../../controllers/break-glass.controller";
import { NAV_ITEM_DEFINITIONS, navItemVisible, type NavItemDefinition } from "../../lib/rbac";
import { useT, useLocale } from "../../lib/i18n";
import type { Patient } from "../../models/types";
import { ToastContainer } from "../components/ui/toast";
import { useToastStore } from "../components/ui/toast-store";
import { ConfirmDialog, Dialog } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Select, Textarea } from "../components/ui/input";
import { BellIcon, ChevronDownIcon, ChevronRightIcon, DownloadIcon, MenuIcon, MoreIcon, NAV_ICONS, PinIcon, SearchIcon, WifiIcon } from "@/lib/icons";
import { filterCommandsForRole } from "@/lib/command-palette-data";
import { CommandPalette } from "../components/command-palette";
import { AboutAppDialog, RoleSwitchDialog } from "../components/app-help-dialogs";
import { checkForUpdates } from "@/controllers/system.controller";
import { useDismissibleLayer } from "../components/ui/use-dismissible-layer";
import { UserAccountMenuDropdown } from "../components/user-account-menu";
import { PageLoading } from "../components/ui/page-status";

/** Sidebar tooltips (§2.4) — keys in {@link useT} / `lib/i18n.ts`. */
const NAV_HELP_I18N: Record<string, string> = {
    "/": "nav.help.dashboard",
    "/hilfe": "nav.help.hilfe",
    "/termine": "nav.help.termine",
    "/patienten": "nav.help.patienten",
    "/finanzen": "nav.help.finanzen",
    "/finanzen/neu": "nav.help.finanzen",
    "/bestellungen": "nav.help.bestellungen",
    "/verwaltung": "nav.help.verwaltung",
    "/verwaltung/arbeitstage": "nav.help.verwaltung",
    "/verwaltung/praxisplanung": "nav.help.verwaltung",
    "/verwaltung/arbeitszeiten": "nav.help.verwaltung",
    "/verwaltung/sonder-sperrzeiten": "nav.help.verwaltung",
    "/verwaltung/praxis-praeferenzen": "nav.help.verwaltung",
    "/verwaltung/vorlagen": "nav.help.verwaltung",
    "/verwaltung/behandlungs-katalog": "nav.help.verwaltung",
    "/verwaltung/finanzen-berichte": "nav.help.verwaltung",
    "/verwaltung/team": "nav.help.verwaltung",
    "/verwaltung/finanzen-berichte/tagesabschluss": "nav.help.verwaltung",
    "/verwaltung/finanzen-berichte/rechnung": "nav.help.verwaltung",
    "/verwaltung/tagesabschluss": "nav.help.verwaltung",
    "/verwaltung/lager-und-bestellwesen": "nav.help.verwaltung",
    "/verwaltung/vertraege": "nav.help.verwaltung",
    "/verwaltung/leistungen-kataloge-vorlagen": "nav.help.verwaltung",
    "/verwaltung/finanzen-werkzeuge": "nav.help.verwaltung",
    "/verwaltung/bestellstamm": "nav.help.verwaltung",
    "/leistungen": "nav.help.leistungen",
    "/produkte": "nav.help.produkte",
    "/statistik": "nav.help.statistik",
    "/einstellungen": "nav.help.einstellungen",
};

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
    { label: "Übersicht", items: ["/", "/termine", "/hilfe"] },
    { label: "Behandlung", items: ["/patienten", "/rezepte", "/statistik"] },
    { label: "Praxis", items: ["/finanzen", "/bestellungen", "/verwaltung", "/einstellungen"] },
];

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
    const [aboutOpen, setAboutOpen] = useState(false);
    const [roleSwitchOpen, setRoleSwitchOpen] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [userMenuAnchor, setUserMenuAnchor] = useState<"sidebar" | "topbar">("sidebar");
    const userMenuAnchorRef = useRef(userMenuAnchor);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const topbarMenuRef = useRef<HTMLDivElement>(null);

    const paletteCommands = useMemo(() => filterCommandsForRole(session?.rolle), [session?.rolle]);
    const breadcrumbs = useMemo(() => breadcrumbsForPath(location.pathname), [location.pathname]);
    const isDashboardRoute = location.pathname === "/";
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

    // Inactivity guard (FA-AUTH-03 / NFA-SEC-09): the backend expires sessions after 30 min.
    // Throttle activity pings to once every 30 s and poll the session status
    // every minute so the UI auto-redirects on expiry.
    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);

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
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setCommandOpen(true);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

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
        open: userMenuOpen && userMenuAnchor === "sidebar",
        rootRef: userMenuRef,
        onDismiss: () => setUserMenuOpen(false),
    });
    useDismissibleLayer({
        open: userMenuOpen && userMenuAnchor === "topbar",
        rootRef: topbarMenuRef,
        onDismiss: () => setUserMenuOpen(false),
    });

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };
    const requestLogout = () => setLogoutConfirmOpen(true);

    const openCommandPalette = () => setCommandOpen(true);

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
            setBreakOpen(false);
            setBgReason("");
            setBgPatientId("");
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setBgBusy(false);
        }
    };

    return (
        <div className="app">
            {/* First in tab order: bypass sidebar (WCAG 2.4.1) */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:px-3 focus:py-2 focus:bg-white focus:text-black focus:rounded"
            >
                {t("a11y.skip_to_main")}
            </a>

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
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 14px" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, var(--accent), #39C4A5)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 700 }}>
                        <PinIcon size={18} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, letterSpacing: "-0.02em" }}>MeDoc</div>
                        <div style={{ fontSize: 11, color: "var(--fg-3)", fontWeight: 400 }}>{session?.rolle ?? "Praxis"}</div>
                    </div>
                </div>
                <button
                    type="button"
                    className="focus-ring"
                    onClick={() => {
                        openCommandPalette();
                        setMobileNavOpen(false);
                    }}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "rgba(0,0,0,0.04)",
                        borderRadius: 10,
                        padding: "8px 10px",
                        color: "var(--fg-3)",
                        margin: "2px 4px 12px",
                        width: "100%",
                        textAlign: "left",
                        cursor: "pointer",
                    }}
                >
                    <SearchIcon size={14} aria-hidden />
                    <span style={{ flex: 1, fontSize: 13, color: "var(--fg-3)" }}>Suchen &amp; springen…</span>
                    <kbd style={{ fontSize: 11, background: "rgba(0,0,0,0.05)", padding: "2px 6px", borderRadius: 5, color: "var(--fg-3)" }}>⌘K</kbd>
                </button>
                <nav style={{ display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
                    {NAV_SECTIONS.map((section) => {
                        const sectionItems = section.items
                            .map((to) => visibleByTo.get(to))
                            .filter((item): item is NonNullable<typeof item> => Boolean(item));
                        if (sectionItems.length === 0) return null;
                        return (
                            <Fragment key={section.label}>
                                <div className="sb-group-label">{section.label}</div>
                                {sectionItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to !== "/patienten"}
                                title={t(NAV_HELP_I18N[item.to] ?? "nav.help.einstellungen")}
                                className={({ isActive }) => `sb-item ${isActive ? "active" : ""}`}
                            >
                                {(() => {
                                    const Ic = NAV_ICONS[item.to] ?? PinIcon;
                                    return <Ic size={16} />;
                                })()}
                                {t(item.labelKey)}
                            </NavLink>
                                ))}
                            </Fragment>
                        );
                    })}
                </nav>
                <div style={{ marginTop: "auto", position: "relative" }} ref={userMenuRef}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: 8,
                            borderRadius: 14,
                            background: "linear-gradient(135deg, #BFE6E0, #B7E1DB)",
                            border: "1px solid rgba(0,0,0,0.05)",
                        }}
                    >
                        <div className="av" style={{ width: 40, height: 40, fontSize: 16, background: "linear-gradient(135deg,#71DCC3,#1BAA8A)" }}>
                            {initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session?.name ?? "Benutzer"}</div>
                            <div style={{ color: "var(--fg-3)", fontSize: 10.5, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Leitende Zahnärztin</div>
                        </div>
                        <button
                            type="button"
                            className="icon-btn"
                            style={{ width: 24, height: 24 }}
                            aria-label="Profilmenü öffnen"
                            aria-haspopup="menu"
                            aria-expanded={userMenuOpen && userMenuAnchor === "sidebar"}
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
                            <MoreIcon size={13} />
                        </button>
                    </div>
                    {userMenuOpen && userMenuAnchor === "sidebar" ? (
                        <div
                            style={{
                                position: "absolute",
                                bottom: "calc(100% + 8px)",
                                left: 0,
                                right: 0,
                                display: "flex",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: 8,
                                padding: 8,
                                borderRadius: 14,
                                background: "rgba(255,255,255,0.78)",
                                border: "1px solid var(--line)",
                                boxShadow: "var(--shadow-lg)",
                                overflowX: "hidden",
                                zIndex: 45,
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    setUserMenuOpen(false);
                                    navigate("/einstellungen");
                                }}
                                className="btn btn-subtle"
                                style={{ padding: "6px 10px", fontSize: 11, whiteSpace: "normal", flex: "1 1 110px", justifyContent: "center", minWidth: 0 }}
                            >
                                Einstellungen
                            </button>
                            {session?.rolle === "ARZT" ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setUserMenuOpen(false);
                                        setBreakOpen(true);
                                    }}
                                    className="btn btn-danger"
                                    style={{ padding: "6px 10px", fontSize: 11, whiteSpace: "normal", flex: "1 1 110px", justifyContent: "center", minWidth: 0 }}
                                >
                                    Notfallzugriff
                                </button>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => {
                                    setUserMenuOpen(false);
                                    requestLogout();
                                }}
                                className="btn btn-ghost"
                                style={{ padding: "6px 10px", fontSize: 11, whiteSpace: "normal", flex: "1 1 110px", justifyContent: "center", minWidth: 0 }}
                            >
                                {t("auth.logout")}
                            </button>
                        </div>
                    ) : null}
                </div>
            </aside>

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
                            <span style={{ flex: 1, textAlign: "left", fontSize: 13, color: "var(--fg-3)" }}>Suchen…</span>
                            <span style={{ fontSize: 11, color: "var(--fg-4)" }}>⌘K</span>
                        </button>
                        {updateAvailable && <button className="tb-chip update" onClick={() => navigate("/einstellungen")}><DownloadIcon size={12} />Update 2026.4.3</button>}
                        <span className={`tb-chip ${isOnline ? "live" : ""}`}><WifiIcon size={12} />{isOnline ? "Online" : "Offline"}</span>
                        <button type="button" className="icon-btn" aria-label="Schnellzugriff" onClick={openCommandPalette}>
                            ＋
                        </button>
                        <button type="button" className="icon-btn" aria-label="Benachrichtigungen" onClick={() => navigate("/")}>
                            <BellIcon size={18} />
                            <span className="dot" aria-hidden />
                        </button>
                        <button type="button" className="icon-btn" aria-label="Über MeDoc" onClick={() => setAboutOpen(true)}>
                            i
                        </button>
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
                                    className="av"
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
                <main id="main-content" tabIndex={-1} style={{ padding: "clamp(10px, 1.8vw, 24px)", display: "flex", flexDirection: "column", gap: 20, overflowY: isDashboardRoute ? "hidden" : "auto", overflowX: "hidden", flex: 1, minHeight: 0 }} aria-label={t("app.title")}>
                    <Suspense fallback={<PageLoading label="Seite wird geladen…" />}>
                        <Outlet />
                    </Suspense>
                </main>
            </div>
            </div>

            <ToastContainer />

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
            <AboutAppDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
            <RoleSwitchDialog
                open={roleSwitchOpen}
                onClose={() => setRoleSwitchOpen(false)}
                onConfirmLogout={() => void confirmRoleSwitchLogout()}
            />
        </div>
    );
}
