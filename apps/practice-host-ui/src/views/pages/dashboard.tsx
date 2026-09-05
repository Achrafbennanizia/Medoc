import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { getDashboardStats, type DashboardStats } from "@/systems/practice-host/controllers/statistics.controller";
import { listAppointments } from "@/systems/practice-host/controllers/appointment.controller";
import { listPatients } from "@/systems/practice-host/controllers/patient.controller";
import { listPurchaseOrders, updatePurchaseOrderStatus, type PurchaseOrder } from "@/systems/practice-host/controllers/purchase-order.controller";
import { listChartValidation, rowsToValidationMaps, setChartSectionValidated } from "@/systems/practice-host/controllers/validation.controller";
import { listChartNextAppointmentHintsPending } from "@/systems/practice-host/controllers/plan-next-appointment.controller";
import { parsePlanNextFromHintJson, planNextHasContent, planNextReceptionTeaser } from "@/lib/plan-next-appointment";
import { errorMessage, formatCurrency, formatDate } from "@/lib/utils";
import { useAuthStore } from "../../models/store/auth-store";
import type { Patient, Appointment } from "../../models/types";
import { allowed, parseRole, routeChildPathAllowed } from "@/lib/rbac";
import { CheckIcon, FilterIcon, NAV_ICONS, PackageIcon, PlusIcon, SparkleIcon, XIcon } from "@/lib/icons";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { ConfirmDialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { EmptyState } from "../components/ui/empty-state";
import { appointmentIsEmergencyMarked } from "@/lib/appointment-domain";
import { appointmentKindLabel } from "@/lib/appointment-calendar-ui";
import { useLocale, useT, useTParams, useCollatorLocale, bcp47ForLocale } from "@/lib/i18n";
import { loadClientSettings } from "@/lib/client-settings";
import { listUpcomingAppointments, type UpcomingAppointment } from "@/systems/practice-host/controllers/integration.controller";
import { kpiIconChrome } from "@/lib/kpi-icon-chrome";
import { WorkspacePageHeader } from "../components/administration-page-header";
import { DismissibleNotice } from "../components/ui/dismissible-notice";

const PRUEF_PATIENT_CAP = 100;
const DASHBOARD_PURCHASE_ORDERS_MAX = 10;
const CHART_VALIDATION_BATCH = 20;
const PLAN_NEXT_FREIGABEN_CAP = 25;
const INSIGHTS_DISMISSED_KEY = "medoc.dashboard.insights.dismissed";

function readInsightsDismissed(): boolean {
    try {
        return localStorage.getItem(INSIGHTS_DISMISSED_KEY) === "1";
    } catch {
        return false;
    }
}

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

function purchaseOrderIsOverdue(b: PurchaseOrder): boolean {
    if (!b.expected_on) return false;
    if (b.status === "DELIVERED" || b.status === "CANCELLED") return false;
    return b.expected_on < todayISO();
}

function purchaseOrderWirePill(b: PurchaseOrder, t: (k: string) => string): { label: string; cls: string } {
    const od = purchaseOrderIsOverdue(b);
    if (od) return { label: `● ${t("dashboard.purchase_orders.status_late")}`, cls: "dashboard-wire-pill-status--late" };
    if (b.status === "IN_TRANSIT")
        return { label: `● ${t("dashboard.purchase_orders.status_transit")}`, cls: "dashboard-wire-pill-status--transit" };
    return { label: `● ${t("dashboard.purchase_orders.status_open")}`, cls: "dashboard-wire-pill-status--open" };
}

function appointmentStatusLabel(status: string, t: (key: string) => string): string {
    const key = `dashboard.status.${status}`;
    const version = t(key);
    return version === key ? status : version;
}

function initialsFromName(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function DashboardPage() {
    const t = useT();
    const tp = useTParams();
    const locale = useLocale((s) => s.locale);
    const sortLocale = useCollatorLocale();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [statsError, setStatsError] = useState<string | null>(null);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [purchase_orders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [pruefMasterPendingIds, setPruefMasterPendingIds] = useState<string[]>([]);
    const [pruefScanLoading, setPruefScanLoading] = useState(false);
    const [dismissedFreigabe, setDismissedFreigabe] = useState<Record<string, true>>({});
    const [approveBusyId, setApproveBusyId] = useState<string | null>(null);
    const [orderBusyId, setOrderBusyId] = useState<string | null>(null);
    const [stornoConfirmPurchaseOrder, setStornoConfirmPurchaseOrder] = useState<PurchaseOrder | null>(null);
    const [listsError, setListsError] = useState<string | null>(null);
    const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointment[]>([]);
    const listsErrorToastSent = useRef(false);
    const [reloadToken, setReloadToken] = useState(0);
    const [planNextPending, setPlanNextPending] = useState<{ patientId: string; hintJson: string }[]>([]);
    const [insightsDismissed, setInsightsDismissed] = useState(readInsightsDismissed);
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
        Promise.all([listAppointments(), listPatients(), listPurchaseOrders()])
            .then(([appointmentsList, patientList, purchaseOrdersList]) => {
                if (!cancelled) {
                    setAppointments(appointmentsList);
                    setPatients(patientList);
                    setPurchaseOrders(purchaseOrdersList);
                    setListsError(null);
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    const msg = errorMessage(e);
                    console.error("[Dashboard] listAppointments/listPatients/listPurchaseOrders failed:", e);
                    setAppointments([]);
                    setPatients([]);
                    setPurchaseOrders([]);
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
        const r = parseRole(session?.role ?? undefined);
        if (!r || !allowed("appointment.read", r)) {
            setUpcomingAppointments([]);
            return;
        }
        void listUpcomingAppointments(24 * 60)
            .then((rows) => {
                if (!cancelled) setUpcomingAppointments(rows);
            })
            .catch((e) => {
                if (!cancelled) {
                    setUpcomingAppointments([]);
                    toast(`${t("dashboard.reminders.toast_load_error")}: ${errorMessage(e)}`, "error");
                }
            });
        return () => {
            cancelled = true;
        };
    }, [reloadToken, session?.role, toast]);

    useEffect(() => {
        let cancelled = false;
        const r = parseRole(session?.role ?? undefined);
        if (!r || !allowed("patient.read", r)) {
            setPlanNextPending([]);
            return;
        }
        void listChartNextAppointmentHintsPending()
            .then((rows) => {
                if (!cancelled) setPlanNextPending(rows);
            })
            .catch((e) => {
                if (!cancelled) {
                    setPlanNextPending([]);
                    toast(`${t("dashboard.plan_next.toast_load_error")}: ${errorMessage(e)}`, "warning");
                }
            });
        return () => {
            cancelled = true;
        };
    }, [reloadToken, session?.role, toast]);

    useEffect(() => {
        let cancelled = false;
        const role = parseRole(session?.role ?? undefined);
        if (!role || !allowed("patient.read", role) || !allowed("patient.read_medical", role)) {
            setPruefMasterPendingIds([]);
            setPruefScanLoading(false);
            return;
        }
        const slice = patients.slice(0, PRUEF_PATIENT_CAP);
        if (slice.length === 0) {
            setPruefMasterPendingIds([]);
            setPruefScanLoading(false);
            return;
        }
        setPruefScanLoading(true);
        setPruefMasterPendingIds([]);
        void (async () => {
            const pending: string[] = [];
            for (let i = 0; i < slice.length && !cancelled; i += CHART_VALIDATION_BATCH) {
                const batch = slice.slice(i, i + CHART_VALIDATION_BATCH);
                const results = await Promise.all(
                    batch.map((p) => listChartValidation(p.id).then((rows) => ({ id: p.id, rows }))),
                );
                if (cancelled) return;
                for (const { id, rows } of results) {
                    const { sections } = rowsToValidationMaps(rows);
                    if (!sections.master) pending.push(id);
                }
            }
            if (!cancelled) {
                setPruefMasterPendingIds(pending);
                setPruefScanLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [patients, session?.role, reloadToken]);

    /** DayClose-Erinnerung (lokal, client-settings): ein Toast pro Tag zur konfigurierten Minute. */
    useEffect(() => {
        const raw = (loadClientSettings().workflows?.dayCloseReminderTime ?? "18:00").trim();
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
            toast(t("dashboard.day_close.toast"), "info");
        };
        check();
        const id = window.setInterval(check, 30_000);
        return () => window.clearInterval(id);
    }, [toast]);

    const todayIso = format(new Date(), "yyyy-MM-dd");
    const patientNameById = useMemo(() => new Map(patients.map((p) => [p.id, p.name])), [patients]);
    const role = useMemo(() => parseRole(session?.role ?? undefined), [session?.role]);

    const heutePlannedCount = useMemo(() => {
        if (!role || !allowed("appointment.read", role)) return 0;
        return appointments.filter((x) => x.date === todayIso && x.status === "PLANNED").length;
    }, [appointments, todayIso, role]);

    const pruefMasterRows = useMemo(() => {
        return [...pruefMasterPendingIds].sort((a, b) =>
            (patientNameById.get(a) ?? "").localeCompare(patientNameById.get(b) ?? "", sortLocale, { sensitivity: "base" }),
        );
    }, [pruefMasterPendingIds, patientNameById]);

    const dashboardPurchaseOrders = useMemo(() => {
        return purchase_orders
            .filter((b) => b.status === "OPEN" || b.status === "IN_TRANSIT")
            .sort((a, b) => {
                const od = (purchaseOrderIsOverdue(b) ? 1 : 0) - (purchaseOrderIsOverdue(a) ? 1 : 0);
                if (od !== 0) return od;
                return b.created_at.localeCompare(a.created_at);
            })
            .slice(0, DASHBOARD_PURCHASE_ORDERS_MAX);
    }, [purchase_orders]);

    const showPlannedFreigabe = role != null && allowed("appointment.read", role) && heutePlannedCount > 0;

    const patientById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);

    const planNextFreigabeRows = useMemo(() => {
        const known = new Set(patients.map((p) => p.id));
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
    }, [planNextPending, patients, patientNameById, t]);

    const filteredMasterRows = useMemo(
        () => pruefMasterRows.filter((id) => !dismissedFreigabe[`master:${id}`]),
        [pruefMasterRows, dismissedFreigabe],
    );
    const showPlannedRow = showPlannedFreigabe && !dismissedFreigabe["planned"];

    const filteredPlanNextRows = useMemo(
        () => planNextFreigabeRows.filter((r) => !dismissedFreigabe[`plan:${r.patientId}`]),
        [planNextFreigabeRows, dismissedFreigabe],
    );

    const freigabenItemCount = filteredMasterRows.length + (showPlannedRow ? 1 : 0) + filteredPlanNextRows.length;
    const freigabenLeer = !pruefScanLoading && freigabenItemCount === 0 && !listsError;

    const canPatientWrite = role != null && allowed("patient.write", role);
    const canViewClinical = role != null && allowed("patient.read_medical", role);
    const canReadPatients = role != null && allowed("patient.read", role);
    const canReadAppointments = role != null && allowed("appointment.read", role);
    const canReadFinance = role != null && allowed("finance.read", role);
    const canPurchaseOrderWrite = role != null && allowed("purchase_order.write", role);
    const showStatistics = role != null && routeChildPathAllowed("statistics", role);

    const heuteAppointments = useMemo(() => {
        return appointments
            .filter((x) => x.date === todayIso && x.status !== "CANCELLED")
            .sort((a, b) => a.time.localeCompare(b.time));
    }, [appointments, todayIso]);

    const dismissInsights = useCallback(() => {
        setInsightsDismissed(true);
        try {
            localStorage.setItem(INSIGHTS_DISMISSED_KEY, "1");
        } catch {
            /* localStorage unavailable */
        }
        toast(t("dashboard.insights.dismiss_toast"), "info");
    }, [toast, t]);

    const dismissFreigabe = useCallback((key: string) => {
        setDismissedFreigabe((p) => ({ ...p, [key]: true }));
    }, []);

    const handleApproveMaster = useCallback(
        async (patientId: string) => {
            if (!session?.user_id) {
                toast(t("dashboard.freigaben.toast_no_session"), "error");
                return;
            }
            setApproveBusyId(patientId);
            try {
                await setChartSectionValidated(patientId, "master", session.user_id);
                setPruefMasterPendingIds((prev) => prev.filter((id) => id !== patientId));
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
        async (b: PurchaseOrder) => {
            setOrderBusyId(b.id);
            try {
                const next = b.status === "OPEN" ? "IN_TRANSIT" : "DELIVERED";
                const updated = await updatePurchaseOrderStatus(b.id, next);
                setPurchaseOrders((list) => list.map((row) => (row.id === b.id ? updated : row)));
                toast(t("dashboard.purchase_orders.toast_status_updated"), "success");
            } catch (e) {
                toast(`${t("dashboard.purchase_orders.toast_status_error")}: ${errorMessage(e)}`, "error");
            } finally {
                setOrderBusyId(null);
            }
        },
        [t, toast],
    );

    const handleOrderAbsagen = useCallback((b: PurchaseOrder) => {
        setStornoConfirmPurchaseOrder(b);
    }, []);

    const confirmOrderStorno = useCallback(async () => {
        const b = stornoConfirmPurchaseOrder;
        if (!b) return;
        setStornoConfirmPurchaseOrder(null);
        setOrderBusyId(b.id);
        try {
            const updated = await updatePurchaseOrderStatus(b.id, "CANCELLED");
            setPurchaseOrders((list) => list.map((row) => (row.id === b.id ? updated : row)));
            toast(t("dashboard.purchase_orders.toast_storno"), "success");
        } catch (e) {
            toast(`${t("dashboard.purchase_orders.toast_status_error")}: ${errorMessage(e)}`, "error");
        } finally {
            setOrderBusyId(null);
        }
    }, [stornoConfirmPurchaseOrder, t, toast]);

    if (statsError) {
        return <PageLoadError message={statsError} onRetry={reload} />;
    }
    if (!stats) {
        return <PageLoading />;
    }

    const localeTag = bcp47ForLocale(locale);
    const today = new Intl.DateTimeFormat(localeTag, { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date());

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
            <WorkspacePageHeader
                titleLevel="h1"
                title={tp("dashboard.greeting", { name: session?.name ?? t("dashboard.greeting_fallback") })}
                subtitle={
                    <>
                        <p className="page-sub" style={{ marginTop: 0 }}>
                            {today} · {stats.appointments_today ?? 0} {t("dashboard.appointments_heute_sub")}
                        </p>
                        <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--fg-3)", maxWidth: 560, lineHeight: 1.45 }}>
                            {t("dashboard.page_hub")}
                        </p>
                    </>
                }
                actions={
                    <>
                        {showStatistics ? (
                            <button type="button" className="btn btn-subtle" onClick={() => navigate("/statistics")}><FilterIcon />{t("dashboard.filter_stats")}</button>
                        ) : null}
                        {canPatientWrite ? (
                            <button type="button" className="btn btn-accent" onClick={() => navigate("/patients/new")}><PlusIcon />{t("dashboard.new_action")}</button>
                        ) : null}
                    </>
                }
            />
            {listsError ? (
                <DismissibleNotice
                    variant="error"
                    role="alert"
                    title={t("dashboard.lists_load_error")}
                    dismissKey={`dashboard-lists-error-${listsError.slice(0, 48)}`}
                    actions={
                        <button type="button" className="btn btn-subtle" onClick={reload}>
                            {t("dashboard.lists_error_retry")}
                        </button>
                    }
                >
                    <p style={{ margin: "0 0 8px" }}>{listsError}</p>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)" }}>{t("dashboard.lists_error_hint")}</p>
                </DismissibleNotice>
            ) : null}
            <div className="dashboard-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                {stats.patients_total != null && canReadPatients && (
                    <StatCard
                        label={t("dashboard.kpi.patients_total")}
                        value={String(stats.patients_total)}
                        icon="Users"
                        accent="var(--accent)"
                        sub={t("dashboard.kpi.patients_total_sub")}
                        trend="neutral"
                    />
                )}
                {stats.appointments_today != null && canReadAppointments && (
                    <StatCard
                        label={t("dashboard.kpi.appointments_today")}
                        value={String(stats.appointments_today)}
                        icon="Calendar"
                        accent="#AF52DE"
                        sub={t("dashboard.kpi.appointments_heute_sub")}
                        trend="neutral"
                    />
                )}
                {stats.revenue_month != null && canReadFinance && (
                    <StatCard
                        label={t("dashboard.kpi.umsatz_mtd")}
                        value={formatCurrency(stats.revenue_month)}
                        icon="Wallet"
                        accent="#0A84FF"
                        sub={t("dashboard.kpi.umsatz_mtd_sub")}
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
                                <button type="button" className="dashboard-wire-head-link nav-link-forward" onClick={() => navigate("/patients")}>
                                    {t("dashboard.freigaben.show_all")} <span className="nav-chevron" aria-hidden>›</span>
                                </button>
                            </div>
                        </div>
                        <div className="dashboard-card-list" style={{ padding: 0 }}>
                            {pruefScanLoading && freigabenItemCount === 0 ? (
                                <div style={{ padding: "16px 20px", fontSize: 14, color: "var(--fg-3)" }}>{t("dashboard.freigaben.scanning")}</div>
                            ) : null}
                            {showPlannedRow ? (
                                <div className="dashboard-wire-row">
                                    <div className="dashboard-wire-avatar dashboard-wire-avatar--muted" aria-hidden>
                                        {heutePlannedCount > 9 ? "9+" : String(heutePlannedCount)}
                                    </div>
                                    <div className="dashboard-wire-row-main">
                                        <div className="dashboard-wire-name-line">
                                            <span className="dashboard-wire-name">
                                                {t("dashboard.freigaben.row_planned").replace("{{count}}", String(heutePlannedCount))}
                                            </span>
                                            <span className="dashboard-wire-tag">{t("dashboard.freigaben.tag_appointments")}</span>
                                        </div>
                                        <div className="dashboard-wire-desc">{t("dashboard.freigaben.desc_appointments")}</div>
                                    </div>
                                    <div className="dashboard-wire-row-aside">
                                        <div className="dashboard-wire-date">{formatDate(todayIso)}</div>
                                        <div className="dashboard-wire-freigabe-actions">
                                            <button
                                                type="button"
                                                className="dashboard-wire-icon-btn"
                                                title={t("dashboard.freigaben.dismiss")}
                                                aria-label={t("dashboard.freigaben.dismiss")}
                                                onClick={() => dismissFreigabe("planned")}
                                            >
                                                <XIcon size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                className="dashboard-wire-approve-btn"
                                                onClick={() => navigate("/appointments")}
                                            >
                                                {t("dashboard.freigaben.open_appointments")}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                            {filteredPlanNextRows.map((row) => {
                                const canTw = role != null && allowed("appointment.write", role);
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
                                                        to={`/appointments/new?patient_id=${encodeURIComponent(row.patientId)}&apply_plan=1`}
                                                        className="dashboard-wire-approve-btn"
                                                    >
                                                        {t("dashboard.freigaben.open_new_appointment")}
                                                    </Link>
                                                ) : (
                                                    <Link
                                                        to={`/patients/${encodeURIComponent(row.patientId)}`}
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
                            {filteredMasterRows.map((pid) => {
                                const name = patientNameById.get(pid) ?? t("appointment.calendar.patient_fallback");
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
                                                <span className="dashboard-wire-tag">{t("dashboard.freigaben.tag_master")}</span>
                                            </div>
                                            <div className="dashboard-wire-desc">{t("dashboard.freigaben.desc_master")}</div>
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
                                                    onClick={() => dismissFreigabe(`master:${pid}`)}
                                                >
                                                    <XIcon size={16} />
                                                </button>
                                                {canViewClinical && canPatientWrite ? (
                                                    <button
                                                        type="button"
                                                        className="dashboard-wire-approve-btn"
                                                        disabled={busy}
                                                        onClick={() => void handleApproveMaster(pid)}
                                                    >
                                                        <CheckIcon size={15} />
                                                        {t("dashboard.freigaben.approve")}
                                                    </button>
                                                ) : (
                                                    <Link to={`/patients/${pid}#anam`} className="dashboard-wire-approve-btn">
                                                        {t("dashboard.freigaben.open_patient")}
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {patients.length > PRUEF_PATIENT_CAP && role != null && allowed("patient.read", role) ? (
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
                                <div className="card-title">{t("dashboard.purchase_orders.title")}</div>
                                <div className="card-sub">{t("dashboard.purchase_orders.sub")}</div>
                            </div>
                            <div className="dashboard-wire-head-actions">
                                <button type="button" className="dashboard-wire-head-link nav-link-forward" onClick={() => navigate("/purchase-orders")}>
                                    {t("dashboard.purchase_orders.show_all")} <span className="nav-chevron" aria-hidden>›</span>
                                </button>
                            </div>
                        </div>
                        <div className="dashboard-card-list" style={{ padding: 0 }}>
                            {dashboardPurchaseOrders.length === 0 ? (
                                <EmptyState icon="📦" title={t("dashboard.purchase_orders.empty_title")} description={t("dashboard.purchase_orders.empty_desc")} />
                            ) : (
                                dashboardPurchaseOrders.map((b) => {
                                    const pill = purchaseOrderWirePill(b, t);
                                    const orderRef = b.order_number?.trim() || "—";
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
                                                            <div className="dashboard-wire-order-title">{b.item}</div>
                                                            <div className="dashboard-wire-order-meta">
                                                                {b.supplier} · {orderRef}
                                                            </div>
                                                        </div>
                                                        <span className={`dashboard-wire-pill-status ${pill.cls}`}>{pill.label}</span>
                                                    </div>
                                                    <div className="dashboard-wire-kpis">
                                                        <div>
                                                            <div className="dashboard-wire-kpi-label">{t("dashboard.purchase_orders.col_quantity")}</div>
                                                            <div className="dashboard-wire-kpi-val">
                                                                {b.quantity}
                                                                {b.unit ? ` ${b.unit}` : ""}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="dashboard-wire-kpi-label">{t("dashboard.purchase_orders.col_ordered")}</div>
                                                            <div className="dashboard-wire-kpi-val">{formatDate(b.created_at.slice(0, 10))}</div>
                                                        </div>
                                                        <div>
                                                            <div className="dashboard-wire-kpi-label">{t("dashboard.purchase_orders.col_delivery")}</div>
                                                            <div className="dashboard-wire-kpi-val">
                                                                {b.expected_on ? formatDate(b.expected_on) : "—"}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="dashboard-wire-order-actions">
                                                        {canPurchaseOrderWrite ? (
                                                            <button
                                                                type="button"
                                                                className="dashboard-wire-btn-secondary"
                                                                disabled={obusy}
                                                                onClick={() => handleOrderAbsagen(b)}
                                                            >
                                                                {t("dashboard.purchase_orders.decline")}
                                                            </button>
                                                        ) : null}
                                                        {canPurchaseOrderWrite ? (
                                                            <button
                                                                type="button"
                                                                className="dashboard-wire-btn-primary"
                                                                title={
                                                                    b.status === "OPEN"
                                                                        ? t("dashboard.purchase_orders.confirm_hint_open")
                                                                        : t("dashboard.purchase_orders.confirm_hint_transit")
                                                                }
                                                                disabled={obusy}
                                                                onClick={() => void handleOrderZusagen(b)}
                                                            >
                                                                {t("dashboard.purchase_orders.confirm")}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="dashboard-wire-btn-primary"
                                                                disabled={obusy}
                                                                onClick={() => navigate(`/purchase-orders?purchase_order=${encodeURIComponent(b.id)}`)}
                                                            >
                                                                {t("dashboard.purchase_orders.details")}
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
                <div className="col dashboard-col-secondary">
                    <div className="dashboard-col-secondary__schedule">
                    {role != null && allowed("appointment.read", role) ? (
                        <div className="card dashboard-card-fill">
                            <div className="card-head">
                                <div>
                                    <div className="card-title">{t("dashboard.reminders.title")}</div>
                                    <div className="card-sub">
                                        {t("dashboard.reminders.sub")}
                                    </div>
                                </div>
                            </div>
                            <div className="dashboard-card-list">
                                {upcomingAppointments.length === 0 ? (
                                    <p style={{ padding: "16px 20px", margin: 0, color: "var(--fg-3)", fontSize: 14 }}>
                                        {t("dashboard.reminders.empty")}
                                    </p>
                                ) : (
                                    upcomingAppointments.slice(0, 12).map((u) => (
                                        <div key={u.appointment_id} className="dashboard-timeline-row">
                                            <div>
                                                <div className="schedule-day-time-primary">
                                                    {u.date} {u.time.slice(0, 5)}
                                                </div>
                                                <div className="schedule-day-time-meta">
                                                    {tp("dashboard.reminders.in_minutes", { minutes: u.minutes_until })} · {appointmentKindLabel(u.kind)}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: "end", fontSize: 13 }}>
                                                <div style={{ fontWeight: 600 }}>{u.patient_name}</div>
                                                <Link to={`/patients/${u.patient_id}`} className="dashboard-wire-head-link">
                                                    {t("dashboard.reminders.open_patient")}
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
                                    {t("dashboard.heute.title")} · {new Date().toLocaleDateString(localeTag, { day: "2-digit", month: "2-digit" })}
                                </div>
                                <div className="card-sub">{t("dashboard.heute.sub")}</div>
                            </div>
                            <span className="pill accent" style={{ marginInlineStart: "auto" }}>
                                <span className="dot" aria-hidden />
                                {t("common.live")}
                            </span>
                        </div>
                        <div className="dashboard-card-list">
                            {heuteAppointments.length === 0 ? (
                                <div style={{ padding: "20px 20px 28px" }}>
                                    <p style={{ color: "var(--fg-3)", margin: 0, fontSize: 14 }}>{t("dashboard.heute.empty")}</p>
                                    <button type="button" className="btn btn-accent" style={{ marginTop: 14 }} onClick={() => navigate("/appointments")}>
                                        {t("dashboard.heute.cta_appointments")}
                                    </button>
                                </div>
                            ) : (
                                heuteAppointments.map((r) => {
                                    const name = patientNameById.get(r.patient_id) ?? t("appointment.calendar.patient_fallback");
                                    const tone = appointmentIsEmergencyMarked(r) ? "yellow" : r.status === "CONFIRMED" ? "blue" : "green";
                                    return (
                                        <div key={r.id} className="dashboard-timeline-row">
                                            <div>
                                                <div className="schedule-day-time-primary">{r.time.slice(0, 5)}</div>
                                                <div className="schedule-day-time-meta">{appointmentIsEmergencyMarked(r) ? t("dashboard.appointments.emergency") : appointmentKindLabel(r.kind)}</div>
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
                                                    <div className="schedule-day-meta-line">{appointmentStatusLabel(r.status, t)}</div>
                                                </div>
                                            </div>
                                            <span className={`pill ${tone === "green" ? "green" : tone === "yellow" ? "yellow" : "blue"}`}>{appointmentStatusLabel(r.status, t)}</span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    </div>
                    {!insightsDismissed ? (
                        <div className="card dashboard-insights-card">
                            <div className="dashboard-insights-card__inner">
                                <div className="row" style={{ gap: 10 }}>
                                    <SparkleIcon size={16} />
                                    <span className="dashboard-insights-card__eyebrow">{t("dashboard.insights.eyebrow")}</span>
                                </div>
                                <div className="dashboard-insights-card__body">{t("dashboard.insights.body")}</div>
                                <div className="row dashboard-insights-card__actions">
                                    <button
                                        type="button"
                                        className="btn dashboard-insights-card__btn-primary"
                                        onClick={() => navigate("/patients")}
                                    >
                                        {t("dashboard.insights.cta_primary")}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn dashboard-insights-card__btn-secondary"
                                        onClick={dismissInsights}
                                    >
                                        {t("dashboard.insights.cta_later")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            <ConfirmDialog
                open={stornoConfirmPurchaseOrder !== null}
                onClose={() => setStornoConfirmPurchaseOrder(null)}
                onConfirm={() => void confirmOrderStorno()}
                title={t("dashboard.purchase_orders.decline")}
                message={t("dashboard.purchase_orders.confirm_cancel")}
                confirmLabel={t("dashboard.purchase_orders.decline")}
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
