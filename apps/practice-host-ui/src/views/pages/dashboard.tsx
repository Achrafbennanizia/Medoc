import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { getDashboardStats, type DashboardStats } from "@/systems/practice-host/controllers/statistik.controller";
import { listTermine } from "@/systems/practice-host/controllers/termin.controller";
import { listPatienten } from "@/systems/practice-host/controllers/patient.controller";
import { listBestellungen, updateBestellungStatus, type Bestellung } from "@/systems/practice-host/controllers/bestellung.controller";
import { listAkteValidation, rowsToValidationMaps, setAkteSectionValidated } from "@/systems/practice-host/controllers/validation.controller";
import { listAkteNextTerminHintsPending } from "@/systems/practice-host/controllers/plan-next-termin.controller";
import { parsePlanNextFromHintJson, planNextHasContent, planNextReceptionTeaser } from "@/lib/plan-next-termin";
import { errorMessage, formatCurrency, formatDate } from "@/lib/utils";
import { useAuthStore } from "../../models/store/auth-store";
import type { Patient, Termin } from "../../models/types";
import { allowed, parseRole } from "@/lib/rbac";
import { CheckIcon, FilterIcon, NAV_ICONS, PackageIcon, PlusIcon, SparkleIcon, XIcon } from "@/lib/icons";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { ConfirmDialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { EmptyState } from "../components/ui/empty-state";
import { terminIstNotfallMarkiert } from "@/lib/termin-domain";
import { useT } from "@/lib/i18n";
import { loadClientSettings } from "@/lib/client-settings";
import { listUpcomingAppointments, type UpcomingAppointment } from "@/systems/practice-host/controllers/integration.controller";
import { kpiIconChrome } from "@/lib/kpi-icon-chrome";

const PRUEF_PATIENT_CAP = 100;
const DASHBOARD_BESTELLUNGEN_MAX = 10;
const AKTE_VALIDATION_BATCH = 20;
const PLAN_NEXT_FREIGABEN_CAP = 25;

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

function bestellungIsOverdue(b: Bestellung): boolean {
    if (!b.erwartet_am) return false;
    if (b.status === "GELIEFERT" || b.status === "STORNIERT") return false;
    return b.erwartet_am < todayISO();
}

function bestellungWirePill(b: Bestellung, t: (k: string) => string): { label: string; cls: string } {
    const od = bestellungIsOverdue(b);
    if (od) return { label: `● ${t("dashboard.bestellungen.status_late")}`, cls: "dashboard-wire-pill-status--late" };
    if (b.status === "UNTERWEGS")
        return { label: `● ${t("dashboard.bestellungen.status_transit")}`, cls: "dashboard-wire-pill-status--transit" };
    return { label: `● ${t("dashboard.bestellungen.status_open")}`, cls: "dashboard-wire-pill-status--open" };
}

function terminStatusLabel(status: string): string {
    const map: Record<string, string> = {
        GEPLANT: "Geplant",
        BESTAETIGT: "Bestätigt",
        DURCHGEFUEHRT: "Durchgeführt",
        NICHT_ERSCHIENEN: "Nicht erschienen",
        ABGESAGT: "Abgesagt",
    };
    return map[status] ?? status;
}

function initialsFromName(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function DashboardPage() {
    const t = useT();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [statsError, setStatsError] = useState<string | null>(null);
    const [termine, setTermine] = useState<Termin[]>([]);
    const [patienten, setPatienten] = useState<Patient[]>([]);
    const [bestellungen, setBestellungen] = useState<Bestellung[]>([]);
    const [pruefStammPendingIds, setPruefStammPendingIds] = useState<string[]>([]);
    const [pruefScanLoading, setPruefScanLoading] = useState(false);
    const [dismissedFreigabe, setDismissedFreigabe] = useState<Record<string, true>>({});
    const [approveBusyId, setApproveBusyId] = useState<string | null>(null);
    const [orderBusyId, setOrderBusyId] = useState<string | null>(null);
    const [stornoConfirmBestellung, setStornoConfirmBestellung] = useState<Bestellung | null>(null);
    const [listsError, setListsError] = useState<string | null>(null);
    const [upcomingTermine, setUpcomingTermine] = useState<UpcomingAppointment[]>([]);
    const listsErrorToastSent = useRef(false);
    const [reloadToken, setReloadToken] = useState(0);
    const [planNextPending, setPlanNextPending] = useState<{ patientId: string; hintJson: string }[]>([]);
    const reload = useCallback(() => setReloadToken((n) => n + 1), []);
    const session = useAuthStore((s) => s.session);

    useEffect(() => {
        setDismissedFreigabe({});
    }, [reloadToken]);

    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);

    useEffect(() => {
        let cancelled = false;
        setStatsError(null);
        setStats(null);
        getDashboardStats()
            .then((s) => {
                if (!cancelled) setStats(s);
            })
            .catch((e) => {
                if (!cancelled) setStatsError(errorMessage(e));
            });
        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    useEffect(() => {
        let cancelled = false;
        listsErrorToastSent.current = false;
        setListsError(null);
        Promise.all([listTermine(), listPatienten(), listBestellungen()])
            .then(([termineList, patientList, bestellungenList]) => {
                if (!cancelled) {
                    setTermine(termineList);
                    setPatienten(patientList);
                    setBestellungen(bestellungenList);
                    setListsError(null);
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    const msg = errorMessage(e);
                    console.error("[Dashboard] listTermine/listPatienten/listBestellungen failed:", e);
                    setTermine([]);
                    setPatienten([]);
                    setBestellungen([]);
                    setListsError(msg);
                    if (!listsErrorToastSent.current) {
                        listsErrorToastSent.current = true;
                        toast(`${t("dashboard.lists_load_error")}: ${msg}`, "error");
                    }
                }
            });
        return () => {
            cancelled = true;
        };
    }, [reloadToken, t, toast]);

    useEffect(() => {
        let cancelled = false;
        const r = parseRole(session?.rolle ?? undefined);
        if (!r || !allowed("termin.read", r)) {
            setUpcomingTermine([]);
            return;
        }
        void listUpcomingAppointments(24 * 60)
            .then((rows) => {
                if (!cancelled) setUpcomingTermine(rows);
            })
            .catch((e) => {
                if (!cancelled) {
                    setUpcomingTermine([]);
                    toast(`Termin-Erinnerungen konnten nicht geladen werden: ${errorMessage(e)}`, "error");
                }
            });
        return () => {
            cancelled = true;
        };
    }, [reloadToken, session?.rolle, toast]);

    useEffect(() => {
        let cancelled = false;
        const r = parseRole(session?.rolle ?? undefined);
        if (!r || !allowed("patient.read", r)) {
            setPlanNextPending([]);
            return;
        }
        void listAkteNextTerminHintsPending()
            .then((rows) => {
                if (!cancelled) setPlanNextPending(rows);
            })
            .catch((e) => {
                if (!cancelled) {
                    setPlanNextPending([]);
                    toast(`Plan-Next-Hinweise konnten nicht geladen werden: ${errorMessage(e)}`, "warning");
                }
            });
        return () => {
            cancelled = true;
        };
    }, [reloadToken, session?.rolle, toast]);

    useEffect(() => {
        let cancelled = false;
        const role = parseRole(session?.rolle ?? undefined);
        if (!role || !allowed("patient.read", role)) {
            setPruefStammPendingIds([]);
            setPruefScanLoading(false);
            return;
        }
        const slice = patienten.slice(0, PRUEF_PATIENT_CAP);
        if (slice.length === 0) {
            setPruefStammPendingIds([]);
            setPruefScanLoading(false);
            return;
        }
        setPruefScanLoading(true);
        setPruefStammPendingIds([]);
        void (async () => {
            const pending: string[] = [];
            for (let i = 0; i < slice.length && !cancelled; i += AKTE_VALIDATION_BATCH) {
                const batch = slice.slice(i, i + AKTE_VALIDATION_BATCH);
                const results = await Promise.all(
                    batch.map((p) => listAkteValidation(p.id).then((rows) => ({ id: p.id, rows }))),
                );
                if (cancelled) return;
                for (const { id, rows } of results) {
                    const { sections } = rowsToValidationMaps(rows);
                    if (!sections.stamm) pending.push(id);
                }
            }
            if (!cancelled) {
                setPruefStammPendingIds(pending);
                setPruefScanLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [patienten, session?.rolle, reloadToken]);

    /** Tagesabschluss-Erinnerung (lokal, client-settings): ein Toast pro Tag zur konfigurierten Minute. */
    useEffect(() => {
        const raw = (loadClientSettings().workflows?.tagesabschlussReminderTime ?? "18:00").trim();
        const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
        if (!m) return;
        const th = Number(m[1]);
        const tmin = Number(m[2]);
        if (!Number.isFinite(th) || !Number.isFinite(tmin) || th < 0 || th > 23 || tmin < 0 || tmin > 59) return;
        const check = () => {
            const now = new Date();
            if (now.getHours() !== th || now.getMinutes() !== tmin) return;
            const d = now.toISOString().slice(0, 10);
            const k = `medoc-ta-reminder-${d}`;
            try {
                if (sessionStorage.getItem(k)) return;
                sessionStorage.setItem(k, "1");
            } catch {
                return;
            }
            toast("Tagesabschluss: Zeit für den Abschluss heute?", "info");
        };
        check();
        const id = window.setInterval(check, 30_000);
        return () => window.clearInterval(id);
    }, [toast]);

    const todayIso = format(new Date(), "yyyy-MM-dd");
    const patientNameById = useMemo(() => new Map(patienten.map((p) => [p.id, p.name])), [patienten]);
    const role = useMemo(() => parseRole(session?.rolle ?? undefined), [session?.rolle]);

    const heuteGeplantCount = useMemo(() => {
        if (!role || !allowed("termin.read", role)) return 0;
        return termine.filter((x) => x.datum === todayIso && x.status === "GEPLANT").length;
    }, [termine, todayIso, role]);

    const pruefStammRows = useMemo(() => {
        return [...pruefStammPendingIds].sort((a, b) =>
            (patientNameById.get(a) ?? "").localeCompare(patientNameById.get(b) ?? "", "de", { sensitivity: "base" }),
        );
    }, [pruefStammPendingIds, patientNameById]);

    const dashboardBestellungen = useMemo(() => {
        return bestellungen
            .filter((b) => b.status === "OFFEN" || b.status === "UNTERWEGS")
            .sort((a, b) => {
                const od = (bestellungIsOverdue(b) ? 1 : 0) - (bestellungIsOverdue(a) ? 1 : 0);
                if (od !== 0) return od;
                return b.created_at.localeCompare(a.created_at);
            })
            .slice(0, DASHBOARD_BESTELLUNGEN_MAX);
    }, [bestellungen]);

    const showAuditCta = role != null && allowed("audit.read", role);
    const showGeplantFreigabe = role != null && allowed("termin.read", role) && heuteGeplantCount > 0;

    const patientById = useMemo(() => new Map(patienten.map((p) => [p.id, p])), [patienten]);

    const planNextFreigabeRows = useMemo(() => {
        const known = new Set(patienten.map((p) => p.id));
        const out: { patientId: string; name: string; teaser: string }[] = [];
        for (const row of planNextPending) {
            if (!known.has(row.patientId)) continue;
            const plan = parsePlanNextFromHintJson(row.hintJson);
            if (!plan || !planNextHasContent(plan)) continue;
            const teaser = planNextReceptionTeaser(plan);
            out.push({
                patientId: row.patientId,
                name: patientNameById.get(row.patientId) ?? row.patientId,
                teaser: teaser || t("dashboard.freigaben.plan_teaser_fallback"),
            });
            if (out.length >= PLAN_NEXT_FREIGABEN_CAP) break;
        }
        return out;
    }, [planNextPending, patienten, patientNameById, t]);

    const filteredStammRows = useMemo(
        () => pruefStammRows.filter((id) => !dismissedFreigabe[`stamm:${id}`]),
        [pruefStammRows, dismissedFreigabe],
    );
    const showGeplantRow = showGeplantFreigabe && !dismissedFreigabe["geplant"];

    const filteredPlanNextRows = useMemo(
        () => planNextFreigabeRows.filter((r) => !dismissedFreigabe[`plan:${r.patientId}`]),
        [planNextFreigabeRows, dismissedFreigabe],
    );

    const freigabenItemCount = filteredStammRows.length + (showGeplantRow ? 1 : 0) + filteredPlanNextRows.length;
    const freigabenLeer = !pruefScanLoading && freigabenItemCount === 0 && !listsError;

    const canPatientWrite = role != null && allowed("patient.write", role);
    const canBestellungWrite = role != null && allowed("bestellung.write", role);

    const heuteTermine = useMemo(() => {
        return termine
            .filter((x) => x.datum === todayIso && x.status !== "ABGESAGT")
            .sort((a, b) => a.uhrzeit.localeCompare(b.uhrzeit));
    }, [termine, todayIso]);

    const dismissFreigabe = useCallback((key: string) => {
        setDismissedFreigabe((p) => ({ ...p, [key]: true }));
    }, []);

    const handleApproveStamm = useCallback(
        async (patientId: string) => {
            if (!session?.user_id) {
                toast(t("dashboard.freigaben.toast_no_session"), "error");
                return;
            }
            setApproveBusyId(patientId);
            try {
                await setAkteSectionValidated(patientId, "stamm", session.user_id);
                setPruefStammPendingIds((prev) => prev.filter((id) => id !== patientId));
                toast(t("dashboard.freigaben.toast_approved"), "success");
            } catch (e) {
                toast(`${t("dashboard.freigaben.toast_approve_error")}: ${errorMessage(e)}`, "error");
            } finally {
                setApproveBusyId(null);
            }
        },
        [session, t, toast],
    );

    const handleOrderZusagen = useCallback(
        async (b: Bestellung) => {
            setOrderBusyId(b.id);
            try {
                const next = b.status === "OFFEN" ? "UNTERWEGS" : "GELIEFERT";
                const updated = await updateBestellungStatus(b.id, next);
                setBestellungen((list) => list.map((row) => (row.id === b.id ? updated : row)));
                toast(t("dashboard.bestellungen.toast_status_updated"), "success");
            } catch (e) {
                toast(`${t("dashboard.bestellungen.toast_status_error")}: ${errorMessage(e)}`, "error");
            } finally {
                setOrderBusyId(null);
            }
        },
        [t, toast],
    );

    const handleOrderAbsagen = useCallback((b: Bestellung) => {
        setStornoConfirmBestellung(b);
    }, []);

    const confirmOrderStorno = useCallback(async () => {
        const b = stornoConfirmBestellung;
        if (!b) return;
        setStornoConfirmBestellung(null);
        setOrderBusyId(b.id);
        try {
            const updated = await updateBestellungStatus(b.id, "STORNIERT");
            setBestellungen((list) => list.map((row) => (row.id === b.id ? updated : row)));
            toast(t("dashboard.bestellungen.toast_storno"), "success");
        } catch (e) {
            toast(`${t("dashboard.bestellungen.toast_status_error")}: ${errorMessage(e)}`, "error");
        } finally {
            setOrderBusyId(null);
        }
    }, [stornoConfirmBestellung, t, toast]);

    if (statsError) {
        return <PageLoadError message={statsError} onRetry={reload} />;
    }
    if (!stats) {
        return <PageLoading />;
    }

    const today = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date());

    const freigabenSub = pruefScanLoading
        ? t("dashboard.freigaben.scanning")
        : freigabenItemCount > 0
          ? t("dashboard.freigaben.sub_count").replace("{{count}}", String(freigabenItemCount))
          : t("dashboard.freigaben.sub_zero");

    return (
        <div
            style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0 }}
            className="animate-fade-in dashboard-page"
            role="region"
            aria-label={t("a11y.notifications_region")}
        >
            <div className="page-head" style={{ alignItems: "center" }}>
                <div>
                    <h1 className="page-title">Guten Morgen, {session?.name ?? "Team"}</h1>
                    <div className="page-sub">
                        {today} · {stats.termine_heute ?? 0} {t("dashboard.termine_heute_sub")}
                    </div>
                    <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--fg-3)", maxWidth: 560, lineHeight: 1.45 }}>
                        {t("dashboard.page_hub")}
                    </p>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", marginLeft: "auto", justifyContent: "flex-end" }}>
                    <button type="button" className="btn btn-subtle" onClick={() => navigate("/statistik")}><FilterIcon />{t("dashboard.filter_stats")}</button>
                    <button type="button" className="btn btn-accent" onClick={() => navigate("/patienten/neu")}><PlusIcon />{t("dashboard.new_action")}</button>
                </div>
            </div>
            {listsError ? (
                <div
                    role="alert"
                    className="card card-pad"
                    style={{
                        borderColor: "color-mix(in srgb, var(--red) 35%, var(--line))",
                        background: "color-mix(in srgb, var(--red) 8%, var(--panel))",
                    }}
                >
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>{t("dashboard.lists_load_error")}</div>
                    <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--fg-2)", lineHeight: 1.45 }}>{listsError}</p>
                    <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--fg-3)" }}>{t("dashboard.lists_error_hint")}</p>
                    <button type="button" className="btn btn-subtle" onClick={reload}>
                        {t("dashboard.lists_error_retry")}
                    </button>
                </div>
            ) : null}
            <div className="dashboard-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                {stats.patienten_gesamt != null && (
                    <StatCard
                        label={t("dashboard.kpi.patienten_gesamt")}
                        value={String(stats.patienten_gesamt)}
                        icon="Users"
                        accent="var(--accent)"
                        sub={t("dashboard.kpi.patienten_gesamt_sub")}
                        trend="neutral"
                    />
                )}
                {stats.termine_heute != null && (
                    <StatCard
                        label={t("dashboard.kpi.termine_heute")}
                        value={String(stats.termine_heute)}
                        icon="Calendar"
                        accent="#AF52DE"
                        sub={t("dashboard.kpi.termine_heute_sub")}
                        trend="neutral"
                    />
                )}
                {stats.einnahmen_monat != null && (
                    <StatCard
                        label={t("dashboard.kpi.umsatz_mtd")}
                        value={formatCurrency(stats.einnahmen_monat)}
                        icon="Wallet"
                        accent="#0A84FF"
                        sub={t("dashboard.kpi.umsatz_mtd_sub")}
                        trend="neutral"
                    />
                )}
                {stats.produkte_niedrig != null && (
                    <StatCard
                        label={t("dashboard.kpi.lager_niedrig")}
                        value={String(stats.produkte_niedrig)}
                        icon="Package"
                        accent="#FF9500"
                        sub={t("dashboard.kpi.lager_niedrig_sub")}
                        trend="neutral"
                    />
                )}
            </div>
            <div className="split dashboard-main-split" style={{ gridTemplateColumns: "1.25fr 1fr", flex: 1 }}>
                <div className="col dashboard-col-primary">
                    <div className="card dashboard-card-fill">
                        <div className="card-head" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                            <div style={{ minWidth: 0 }}>
                                <div className="card-title">{t("dashboard.freigaben.title")}</div>
                                <div className="card-sub">{freigabenSub}</div>
                            </div>
                            <div className="dashboard-wire-head-actions">
                                {showAuditCta ? (
                                    <button type="button" className="dashboard-wire-head-link" onClick={() => navigate("/audit")}>
                                        {t("dashboard.freigaben.cta")}
                                    </button>
                                ) : null}
                                <button type="button" className="dashboard-wire-head-link" onClick={() => navigate("/patienten")}>
                                    {t("dashboard.freigaben.show_all")} ›
                                </button>
                            </div>
                        </div>
                        <div className="dashboard-card-list" style={{ padding: 0 }}>
                            {pruefScanLoading && freigabenItemCount === 0 ? (
                                <div style={{ padding: "16px 20px", fontSize: 14, color: "var(--fg-3)" }}>{t("dashboard.freigaben.scanning")}</div>
                            ) : null}
                            {showGeplantRow ? (
                                <div className="dashboard-wire-row">
                                    <div className="dashboard-wire-avatar dashboard-wire-avatar--muted" aria-hidden>
                                        {heuteGeplantCount > 9 ? "9+" : String(heuteGeplantCount)}
                                    </div>
                                    <div className="dashboard-wire-row-main">
                                        <div className="dashboard-wire-name-line">
                                            <span className="dashboard-wire-name">
                                                {t("dashboard.freigaben.row_geplant").replace("{{count}}", String(heuteGeplantCount))}
                                            </span>
                                            <span className="dashboard-wire-tag">{t("dashboard.freigaben.tag_termine")}</span>
                                        </div>
                                        <div className="dashboard-wire-desc">{t("dashboard.freigaben.desc_termine")}</div>
                                    </div>
                                    <div className="dashboard-wire-row-aside">
                                        <div className="dashboard-wire-date">{formatDate(todayIso)}</div>
                                        <div className="dashboard-wire-freigabe-actions">
                                            <button
                                                type="button"
                                                className="dashboard-wire-icon-btn"
                                                title={t("dashboard.freigaben.dismiss")}
                                                aria-label={t("dashboard.freigaben.dismiss")}
                                                onClick={() => dismissFreigabe("geplant")}
                                            >
                                                <XIcon size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                className="dashboard-wire-approve-btn"
                                                onClick={() => navigate("/termine")}
                                            >
                                                {t("dashboard.freigaben.open_termine")}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                            {filteredPlanNextRows.map((row) => {
                                const canTw = role != null && allowed("termin.write", role);
                                return (
                                    <div key={`plan-${row.patientId}`} className="dashboard-wire-row">
                                        <div className="dashboard-wire-avatar dashboard-wire-avatar--muted" aria-hidden>
                                            <SparkleIcon size={18} />
                                        </div>
                                        <div className="dashboard-wire-row-main">
                                            <div className="dashboard-wire-name-line">
                                                <span className="dashboard-wire-name">{row.name}</span>
                                                <span className="dashboard-wire-tag">{t("dashboard.freigaben.tag_plan")}</span>
                                            </div>
                                            <div className="dashboard-wire-desc">
                                                {row.teaser}
                                                {" · "}
                                                <span style={{ color: "var(--fg-3)" }}>{t("dashboard.freigaben.desc_plan")}</span>
                                            </div>
                                        </div>
                                        <div className="dashboard-wire-row-aside">
                                            <div className="dashboard-wire-date">{formatDate(todayIso)}</div>
                                            <div className="dashboard-wire-freigabe-actions">
                                                <button
                                                    type="button"
                                                    className="dashboard-wire-icon-btn"
                                                    title={t("dashboard.freigaben.dismiss")}
                                                    aria-label={t("dashboard.freigaben.dismiss")}
                                                    onClick={() => dismissFreigabe(`plan:${row.patientId}`)}
                                                >
                                                    <XIcon size={16} />
                                                </button>
                                                {canTw ? (
                                                    <Link
                                                        to={`/termine/neu?patient_id=${encodeURIComponent(row.patientId)}&apply_plan=1`}
                                                        className="dashboard-wire-approve-btn"
                                                    >
                                                        {t("dashboard.freigaben.open_neu_termin")}
                                                    </Link>
                                                ) : (
                                                    <Link
                                                        to={`/patienten/${encodeURIComponent(row.patientId)}`}
                                                        className="dashboard-wire-approve-btn"
                                                    >
                                                        {t("dashboard.freigaben.open_patient")}
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredStammRows.map((pid) => {
                                const name = patientNameById.get(pid) ?? "Patient";
                                const patient = patientById.get(pid);
                                const dateStr = patient ? formatDate(patient.created_at.slice(0, 10)) : "—";
                                const busy = approveBusyId === pid;
                                return (
                                    <div key={pid} className="dashboard-wire-row">
                                        <div className="dashboard-wire-avatar" aria-hidden>
                                            {initialsFromName(name)}
                                        </div>
                                        <div className="dashboard-wire-row-main">
                                            <div className="dashboard-wire-name-line">
                                                <span className="dashboard-wire-name">{name}</span>
                                                <span className="dashboard-wire-tag">{t("dashboard.freigaben.tag_stamm")}</span>
                                            </div>
                                            <div className="dashboard-wire-desc">{t("dashboard.freigaben.desc_stamm")}</div>
                                        </div>
                                        <div className="dashboard-wire-row-aside">
                                            <div className="dashboard-wire-date">{dateStr}</div>
                                            <div className="dashboard-wire-freigabe-actions">
                                                <button
                                                    type="button"
                                                    className="dashboard-wire-icon-btn"
                                                    title={t("dashboard.freigaben.dismiss")}
                                                    aria-label={t("dashboard.freigaben.dismiss")}
                                                    disabled={busy}
                                                    onClick={() => dismissFreigabe(`stamm:${pid}`)}
                                                >
                                                    <XIcon size={16} />
                                                </button>
                                                {canPatientWrite ? (
                                                    <button
                                                        type="button"
                                                        className="dashboard-wire-approve-btn"
                                                        disabled={busy}
                                                        onClick={() => void handleApproveStamm(pid)}
                                                    >
                                                        <CheckIcon size={15} />
                                                        {t("dashboard.freigaben.approve")}
                                                    </button>
                                                ) : (
                                                    <Link to={`/patienten/${pid}#stamm`} className="dashboard-wire-approve-btn">
                                                        {t("dashboard.freigaben.open_patient")}
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {patienten.length > PRUEF_PATIENT_CAP && role != null && allowed("patient.read", role) ? (
                                <p style={{ fontSize: 12, color: "var(--fg-3)", margin: "0 20px 12px", lineHeight: 1.45 }}>
                                    {t("dashboard.freigaben.scan_cap_note").replace("{{cap}}", String(PRUEF_PATIENT_CAP))}
                                </p>
                            ) : null}
                            {freigabenLeer ? (
                                <EmptyState icon="✅" title={t("dashboard.freigaben.empty_title")} description={t("dashboard.freigaben.empty_desc")} />
                            ) : null}
                        </div>
                    </div>
                    <div className="card dashboard-card-fill">
                        <div className="card-head" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                            <div style={{ minWidth: 0 }}>
                                <div className="card-title">{t("dashboard.bestellungen.title")}</div>
                                <div className="card-sub">{t("dashboard.bestellungen.sub")}</div>
                            </div>
                            <div className="dashboard-wire-head-actions">
                                <button type="button" className="dashboard-wire-head-link" onClick={() => navigate("/produkte")}>
                                    {t("dashboard.bestellungen.cta_produkte")}
                                </button>
                                <button type="button" className="dashboard-wire-head-link" onClick={() => navigate("/bestellungen")}>
                                    {t("dashboard.bestellungen.show_all")} ›
                                </button>
                            </div>
                        </div>
                        <div className="dashboard-card-list" style={{ padding: 0 }}>
                            {dashboardBestellungen.length === 0 ? (
                                <EmptyState icon="📦" title={t("dashboard.bestellungen.empty_title")} description={t("dashboard.bestellungen.empty_desc")} />
                            ) : (
                                dashboardBestellungen.map((b) => {
                                    const pill = bestellungWirePill(b, t);
                                    const bestellRef = b.bestellnummer?.trim() || "—";
                                    const obusy = orderBusyId === b.id;
                                    return (
                                        <div key={b.id} className="dashboard-wire-order">
                                            <div className="dashboard-wire-order-head">
                                                <div className="dashboard-wire-order-icon" aria-hidden>
                                                    <PackageIcon size={22} />
                                                </div>
                                                <div className="dashboard-wire-order-body">
                                                    <div className="dashboard-wire-order-title-row">
                                                        <div style={{ minWidth: 0 }}>
                                                            <div className="dashboard-wire-order-title">{b.artikel}</div>
                                                            <div className="dashboard-wire-order-meta">
                                                                {b.lieferant} · {bestellRef}
                                                            </div>
                                                        </div>
                                                        <span className={`dashboard-wire-pill-status ${pill.cls}`}>{pill.label}</span>
                                                    </div>
                                                    <div className="dashboard-wire-kpis">
                                                        <div>
                                                            <div className="dashboard-wire-kpi-label">{t("dashboard.bestellungen.col_menge")}</div>
                                                            <div className="dashboard-wire-kpi-val">
                                                                {b.menge}
                                                                {b.einheit ? ` ${b.einheit}` : ""}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="dashboard-wire-kpi-label">{t("dashboard.bestellungen.col_bestellt")}</div>
                                                            <div className="dashboard-wire-kpi-val">{formatDate(b.created_at.slice(0, 10))}</div>
                                                        </div>
                                                        <div>
                                                            <div className="dashboard-wire-kpi-label">{t("dashboard.bestellungen.col_lieferung")}</div>
                                                            <div className="dashboard-wire-kpi-val">
                                                                {b.erwartet_am ? formatDate(b.erwartet_am) : "—"}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="dashboard-wire-order-actions">
                                                        {canBestellungWrite ? (
                                                            <button
                                                                type="button"
                                                                className="dashboard-wire-btn-secondary"
                                                                disabled={obusy}
                                                                onClick={() => handleOrderAbsagen(b)}
                                                            >
                                                                {t("dashboard.bestellungen.absagen")}
                                                            </button>
                                                        ) : null}
                                                        {canBestellungWrite ? (
                                                            <button
                                                                type="button"
                                                                className="dashboard-wire-btn-primary"
                                                                title={
                                                                    b.status === "OFFEN"
                                                                        ? t("dashboard.bestellungen.zusagen_hint_open")
                                                                        : t("dashboard.bestellungen.zusagen_hint_transit")
                                                                }
                                                                disabled={obusy}
                                                                onClick={() => void handleOrderZusagen(b)}
                                                            >
                                                                {t("dashboard.bestellungen.zusagen")}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="dashboard-wire-btn-primary"
                                                                disabled={obusy}
                                                                onClick={() => navigate(`/bestellungen/${b.id}`)}
                                                            >
                                                                {t("dashboard.bestellungen.details")}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
                <div className="col dashboard-col-secondary" style={{ gap: 14 }}>
                    {role != null && allowed("termin.read", role) ? (
                        <div className="card dashboard-card-fill">
                            <div className="card-head">
                                <div>
                                    <div className="card-title">Termine in den nächsten 24 Stunden</div>
                                    <div className="card-sub">
                                        G9 — Erinnerungsliste (kein SMS/E-Mail-Versand; nur Anzeige in der App).
                                    </div>
                                </div>
                            </div>
                            <div className="dashboard-card-list">
                                {upcomingTermine.length === 0 ? (
                                    <p style={{ padding: "16px 20px", margin: 0, color: "var(--fg-3)", fontSize: 14 }}>
                                        Keine anstehenden Termine in den nächsten 24 Stunden.
                                    </p>
                                ) : (
                                    upcomingTermine.slice(0, 12).map((u) => (
                                        <div key={u.termin_id} className="dashboard-timeline-row">
                                            <div>
                                                <div className="schedule-day-time-primary">
                                                    {u.datum} {u.uhrzeit.slice(0, 5)}
                                                </div>
                                                <div className="schedule-day-time-meta">
                                                    in {u.minutes_until} Min. · {u.art.replace(/_/g, " ")}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: "right", fontSize: 13 }}>
                                                <div style={{ fontWeight: 600 }}>{u.patient_name}</div>
                                                <Link to={`/patienten/${u.patient_id}`} className="dashboard-wire-head-link">
                                                    Patient öffnen
                                                </Link>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : null}
                    <div className="card dashboard-card-fill">
                        <div className="card-head" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                            <div style={{ minWidth: 0 }}>
                                <div className="card-title">
                                    {t("dashboard.heute.title")} · {new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                                </div>
                                <div className="card-sub">{t("dashboard.heute.sub")}</div>
                            </div>
                            <span className="pill accent" style={{ marginLeft: "auto" }}>
                                <span className="dot" aria-hidden />
                                Live
                            </span>
                        </div>
                        <div className="dashboard-card-list">
                            {heuteTermine.length === 0 ? (
                                <div style={{ padding: "20px 20px 28px" }}>
                                    <p style={{ color: "var(--fg-3)", margin: 0, fontSize: 14 }}>{t("dashboard.heute.empty")}</p>
                                    <button type="button" className="btn btn-accent" style={{ marginTop: 14 }} onClick={() => navigate("/termine")}>
                                        {t("dashboard.heute.cta_termine")}
                                    </button>
                                </div>
                            ) : (
                                heuteTermine.map((r) => {
                                    const name = patientNameById.get(r.patient_id) ?? "Patient";
                                    const tone = terminIstNotfallMarkiert(r) ? "yellow" : r.status === "BESTAETIGT" ? "blue" : "green";
                                    return (
                                        <div key={r.id} className="dashboard-timeline-row">
                                            <div>
                                                <div className="schedule-day-time-primary">{r.uhrzeit.slice(0, 5)}</div>
                                                <div className="schedule-day-time-meta">{terminIstNotfallMarkiert(r) ? "Notfall" : r.art.replace(/_/g, " ")}</div>
                                            </div>
                                            <div className="row" style={{ gap: 12 }}>
                                                <div
                                                    className="schedule-severity-bar"
                                                    style={{
                                                        background: tone === "green" ? "#30D158" : tone === "yellow" ? "#FFCC00" : "#0A84FF",
                                                    }}
                                                    aria-hidden
                                                />
                                                <div>
                                                    <div className="schedule-day-name">{name}</div>
                                                    <div className="schedule-day-meta-line">{terminStatusLabel(r.status)}</div>
                                                </div>
                                            </div>
                                            <span className={`pill ${tone === "green" ? "green" : tone === "yellow" ? "yellow" : "blue"}`}>{terminStatusLabel(r.status)}</span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    <div className="card" style={{ background: "linear-gradient(135deg, #0E455C 0%, #0D7D66 100%)", color: "#fff" }}>
                        <div style={{ padding: 24 }}>
                            <div className="row" style={{ gap: 10 }}>
                                <SparkleIcon size={16} />
                                <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.04em", opacity: 0.9 }}>MEDOC INSIGHTS</span>
                            </div>
                            <div style={{ marginTop: 14, fontSize: 18, fontWeight: 600, lineHeight: 1.45, opacity: 0.95 }}>
                                {t("dashboard.insights.body")}
                            </div>
                            <div className="row" style={{ marginTop: 22, gap: 12 }}>
                                <button
                                    type="button"
                                    className="btn"
                                    style={{ background: "#fff", color: "#111318", padding: "10px 20px", fontSize: 15, fontWeight: 700 }}
                                    onClick={() => navigate("/patienten")}
                                >
                                    {t("dashboard.insights.cta_primary")}
                                </button>
                                <button
                                    type="button"
                                    className="btn"
                                    style={{ background: "rgba(255,255,255,0.16)", color: "#EAF4F1", padding: "10px 20px", fontSize: 15, fontWeight: 700 }}
                                    onClick={() => toast(t("dashboard.insights.dismiss_toast"), "info")}
                                >
                                    {t("dashboard.insights.cta_later")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={stornoConfirmBestellung !== null}
                onClose={() => setStornoConfirmBestellung(null)}
                onConfirm={() => void confirmOrderStorno()}
                title={t("dashboard.bestellungen.absagen")}
                message={t("dashboard.bestellungen.confirm_storno")}
                confirmLabel={t("dashboard.bestellungen.absagen")}
            />
        </div>
    );
}

interface StatCardProps {
    label: string;
    value: string;
    icon: string;
    accent: string;
    sub?: string;
    trend?: "positive" | "negative" | "neutral";
}

function StatCard({ label, value, icon, accent, sub, trend = "neutral" }: StatCardProps) {
    const Ic = NAV_ICONS[icon] ?? NAV_ICONS["/"];
    const iconChrome = kpiIconChrome(accent);
    return (
        <div className="card kpi">
            <div className="kpi-label">
                <span style={{ width: 22, height: 22, borderRadius: 7, display: "grid", placeItems: "center", ...iconChrome }}>
                    <Ic size={13} />
                </span>
                {label}
            </div>
            <div className="kpi-val">{value}</div>
            {sub ? (
                <div className="kpi-delta">
                    <span
                        className={
                            trend === "positive"
                                ? "kpi-delta__trend--positive"
                                : trend === "negative"
                                  ? "kpi-delta__trend--negative"
                                  : ""
                        }
                        style={trend === "neutral" ? { color: "var(--fg-3)" } : undefined}
                    >
                        {sub}
                    </span>
                </div>
            ) : null}
        </div>
    );
}
