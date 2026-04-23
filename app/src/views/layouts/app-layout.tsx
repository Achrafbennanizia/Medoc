import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../../models/store/auth-store";
import { checkSession, logout, touchSession } from "../../controllers/auth.controller";
import { listPatienten } from "../../controllers/patient.controller";
import { breakGlassActivate } from "../../controllers/break-glass.controller";
import { cn } from "../../lib/utils";
import { NAV_ITEM_DEFINITIONS, navItemVisible } from "../../lib/rbac";
import { useT, useLocale } from "../../lib/i18n";
import type { Patient } from "../../models/types";
import { ToastContainer } from "../components/ui/toast";
import { useToastStore } from "../components/ui/toast-store";
import { Dialog } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Select, Textarea } from "../components/ui/input";

export function AppLayout() {
    const session = useAuthStore((s) => s.session);
    const clear = useAuthStore((s) => s.clear);
    const navigate = useNavigate();
    const lastTouch = useRef<number>(0);
    const t = useT();
    const locale = useLocale((s) => s.locale);
    const setLocale = useLocale((s) => s.setLocale);
    const toast = useToastStore((s) => s.add);
    const [breakOpen, setBreakOpen] = useState(false);
    const [bgReason, setBgReason] = useState("");
    const [bgPatientId, setBgPatientId] = useState("");
    const [bgPatients, setBgPatients] = useState<Patient[]>([]);
    const [bgBusy, setBgBusy] = useState(false);

    // Inactivity guard (FA-AUTH-03 / NFA-SEC-09): the backend expires sessions after 30 min.
    // Throttle activity pings to once every 30 s and poll the session status
    // every minute so the UI auto-redirects on expiry.
    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);

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

    const handleLogout = async () => {
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
        <div className="flex h-screen bg-surface-dim">
            {/* First in tab order: bypass sidebar (WCAG 2.4.1) */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:px-3 focus:py-2 focus:bg-primary focus:text-on-primary focus:rounded"
            >
                {t("a11y.skip_to_main")}
            </a>

            {/* Glass Sidebar – Apple HIG vibrancy */}
            <aside className="w-60 glass flex flex-col">
                {/* Brand */}
                <div className="h-12 flex items-center px-5 border-b border-surface-container/50">
                    <h1 className="text-title text-primary font-bold tracking-tight">MeDoc</h1>
                    <span className="ml-2 text-caption text-on-surface-variant">Praxis</span>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                    {NAV_ITEM_DEFINITIONS
                        .filter((item) => navItemVisible(session?.rolle, item))
                        .map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === "/"}
                                className={({ isActive }) =>
                                    cn(
                                        "flex items-center gap-3 px-3 py-2 rounded-lg text-body-medium transition-all duration-150",
                                        isActive
                                            ? "bg-primary-container text-primary"
                                            : "text-on-surface-variant hover:bg-surface-bright hover:text-on-surface"
                                    )
                                }
                            >
                                <span className="text-base leading-none">{item.icon}</span>
                                {t(item.labelKey)}
                            </NavLink>
                        ))}
                </nav>

                {/* User Profile Footer */}
                <div className="p-4 border-t border-surface-container/50 space-y-2">
                    <div className="text-body-medium text-on-primary">{session?.name}</div>
                    <div className="text-caption text-on-surface-variant">{session?.rolle}</div>
                    <div className="flex items-center gap-2 text-caption">
                        <button
                            aria-label="Sprache Deutsch"
                            onClick={() => setLocale("de")}
                            className={cn(
                                "px-1.5 py-0.5 rounded",
                                locale === "de" ? "bg-primary-container text-primary" : "text-on-surface-variant",
                            )}
                        >
                            DE
                        </button>
                        <button
                            aria-label="Language English"
                            onClick={() => setLocale("en")}
                            className={cn(
                                "px-1.5 py-0.5 rounded",
                                locale === "en" ? "bg-primary-container text-primary" : "text-on-surface-variant",
                            )}
                        >
                            EN
                        </button>
                    </div>
                    {session?.rolle === "ARZT" && (
                        <button
                            type="button"
                            onClick={() => setBreakOpen(true)}
                            className="w-full text-left text-caption px-2 py-1.5 rounded-lg text-error hover:bg-error/10 transition-colors"
                        >
                            Notfallzugriff
                        </button>
                    )}
                    <button
                        onClick={handleLogout}
                        className="text-caption text-error hover:text-error-dim transition-colors"
                    >
                        {t("auth.logout")}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto" aria-label={t("app.title")}>
                <div className="p-6 max-w-7xl mx-auto w-full">
                    <Outlet />
                </div>
            </main>

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
                <p className="text-body text-on-surface-variant mb-3">
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
                    className="min-h-[88px]"
                />
            </Dialog>
        </div>
    );
}
