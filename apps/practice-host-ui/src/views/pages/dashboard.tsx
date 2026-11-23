import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getDashboardStats, type DashboardStats } from "@/systems/practice-host/controllers/statistics.controller";
import { APPOINTMENTS_CHANGED_EVENT, listAppointmentsByDate } from "@/systems/practice-host/controllers/appointment.controller";
import { listPatientsByIds } from "@/systems/practice-host/controllers/patient.controller";
import { listPurchaseOrders, updatePurchaseOrderStatus, type PurchaseOrder } from "@/systems/practice-host/controllers/purchase-order.controller";
import {
    listChartsToValidate,
    validatePatientChart,
    declinePatientChart,
    type ChartToValidateRow,
} from "@/systems/practice-host/controllers/chart-workflow.controller";
import { errorMessage, formatCurrency, formatDate, formatDateTime, formatDbTime, initialsFromName } from "@/lib/utils";
import { useAuthStore } from "../../models/store/auth-store";
import type { Patient, Appointment, Payment } from "../../models/types";
import { allowed, canReadFinance as canReadCashArea, parseRole, routeChildPathAllowed } from "@/lib/rbac";
import { CheckIcon, FilterIcon, PackageIcon, PlusIcon, SparkleIcon, XIcon } from "@/lib/icons";
import { CHART_QUEUE_DECLINE_ENABLED } from "@/lib/v1-ui-flags";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { ConfirmDialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { EmptyState } from "../components/ui/empty-state";
import { appointmentIsEmergencyMarked } from "@/lib/appointment-domain";
import { appointmentKindLabel } from "@/lib/appointment-calendar-ui";
import { useLocale, useT, useTParams, bcp47ForLocale } from "@/lib/i18n";
import { practiceClosingTimeHm } from "@/lib/practice-planning";
import { practiceTodayYmd } from "@/lib/practice-timezone";
import { usePracticeWorkHoursStore } from "@/models/store/practice-work-hours-store";
import { itemValidationKey } from "@/lib/chart-validation";
import { filterReceptionCashQueue } from "@/lib/day-close";
import { paymentMethodLabel } from "@/lib/finance-order-labels";
import { practiceTaskHeadline, practiceTaskPreview } from "@/lib/practice-task-display";
import { filterReceptionPendingTasks } from "@/lib/practice-task-actionable";
import { INBOX_POLL_MS } from "@/lib/inbox-config";
import {
    listPracticeTasksForMe,
    type PracticeTask,
} from "@/systems/practice-host/controllers/practice-task.controller";
import { taskPatientLabel } from "../components/practice-tasks/constants";
import { taskKindLabel, taskStatusLabel } from "../components/practice-tasks/task-workflow-ui";
import { Badge } from "../components/ui/badge";
import { taskStatusVariant } from "../components/practice-tasks/task-workflow";
import { WorkspacePageHeader } from "../components/administration-page-header";
import { DismissibleNotice } from "../components/ui/dismissible-notice";
import { PAGE_REFRESH_EVENT } from "../layouts/page-refresh";
import { purchaseOrderIsOverdue } from "@/lib/purchase-order-is-overdue";
import { StatCard } from "../components/stat-card";

const DASHBOARD_PURCHASE_ORDERS_MAX = 10;
const DASHBOARD_OPEN_CASH_MAX = 8;
const DASHBOARD_PENDING_TASKS_MAX = 12;
const CHARTS_QUEUE_POLL_MS = 15_000;
const INSIGHTS_DISMISSED_KEY = "medoc.dashboard.insights.dismissed";

function readInsightsDismissed(): boolean {
    try {
        return localStorage.getItem(INSIGHTS_DISMISSED_KEY) === "1";
    } catch {
        return false;
    }
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

export function DashboardPage() {
    const t = useT();
    const tp = useTParams();
    const locale = useLocale((s) => s.locale);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [statsError, setStatsError] = useState<string | null>(null);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [purchase_orders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [chartsToValidate, setChartsToValidate] = useState<ChartToValidateRow[]>([]);
    const [chartsQueueLoading, setChartsQueueLoading] = useState(false);
    const [pendingTasks, setPendingTasks] = useState<PracticeTask[]>([]);
    const [pendingTasksLoading, setPendingTasksLoading] = useState(false);
    const [approveBusyId, setApproveBusyId] = useState<string | null>(null);
    const [orderBusyId, setOrderBusyId] = useState<string | null>(null);
    const [stornoConfirmPurchaseOrder, setStornoConfirmPurchaseOrder] = useState<PurchaseOrder | null>(null);
    const [listsError, setListsError] = useState<string | null>(null);
    const [openCash, setOpenCash] = useState<Payment[]>([]);
    const [openCashValidatedKeys, setOpenCashValidatedKeys] = useState<Set<string> | null>(null);
    const [openCashLoaded, setOpenCashLoaded] = useState(false);
    const [openCashError, setOpenCashError] = useState<string | null>(null);
    const listsErrorToastSent = useRef(false);
    const [reloadToken, setReloadToken] = useState(0);
    const [insightsDismissed, setInsightsDismissed] = useState(readInsightsDismissed);
    const reload = useCallback(() => setReloadToken((n) => n + 1), []);
    const session = useAuthStore((s) => s.session);

    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);

    useEffect(() => {
        let cancelled = false;
        setStatsError(null);
        setStats(null);
        const loadStats = () => {
            getDashboardStats()
                .then((s) => {
                    if (!cancelled) setStats(s);
                })
                .catch((e) => {
                    if (!cancelled) setStatsError(errorMessage(e));
                });
        };
        loadStats();
        const onRefresh = () => loadStats();
        window.addEventListener(PAGE_REFRESH_EVENT, onRefresh);
        return () => {
            cancelled = true;
            window.removeEventListener(PAGE_REFRESH_EVENT, onRefresh);
        };
    }, [reloadToken]);

    useEffect(() => {
        let cancelled = false;
        listsErrorToastSent.current = false;
        setListsError(null);

        const loadLists = (showError: boolean) => {
            const day = practiceTodayYmd();
            // Patient names are fetched for the ids on screen only (effect below), not the whole list.
            return Promise.all([listAppointmentsByDate(day), listPurchaseOrders()])
                .then(([appointmentsList, purchaseOrdersList]) => {
                    if (!cancelled) {
                        setAppointments(appointmentsList);
                        setPurchaseOrders(purchaseOrdersList);
                        setListsError(null);
                    }
                })
                .catch((e) => {
                    if (!cancelled) {
                        const msg = errorMessage(e);
                        console.error("[Dashboard] listAppointmentsByDate/listPurchaseOrders failed:", e);
                        setAppointments([]);
                        setPurchaseOrders([]);
                        setListsError(msg);
                        if (showError && !listsErrorToastSent.current) {
                            listsErrorToastSent.current = true;
                            toast(`${t("dashboard.lists_load_error")}: ${msg}`, "error");
                        }
                    }
                });
        };

        void loadLists(true);
        const onAppointmentsChanged = () => {
            void loadLists(false);
        };
        window.addEventListener(APPOINTMENTS_CHANGED_EVENT, onAppointmentsChanged);
        window.addEventListener(PAGE_REFRESH_EVENT, onAppointmentsChanged);
        return () => {
            cancelled = true;
            window.removeEventListener(APPOINTMENTS_CHANGED_EVENT, onAppointmentsChanged);
            window.removeEventListener(PAGE_REFRESH_EVENT, onAppointmentsChanged);
        };
    }, [reloadToken, t, toast]);

    useEffect(() => {
        let cancelled = false;
        const r = parseRole(session?.role ?? undefined);
        if (!r || !canReadCashArea(r, session?.permission_overrides)) {
            setOpenCash([]);
            setOpenCashError(null);
            setOpenCashLoaded(true);
            return;
        }

        const loadOpenCash = async () => {
            try {
                const { listPaymentsPaged } = await import("@/systems/practice-host/controllers/payment.controller");
                const day = practiceTodayYmd();
                const resp = await listPaymentsPaged({
                    page: 1,
                    pageSize: 100,
                    sortDir: "desc",
                    filter: { activeOn: day },
                });
                if (cancelled) return;
                const open = filterReceptionCashQueue(resp.items, day).sort((a, b) =>
                    b.created_at.localeCompare(a.created_at),
                );
                setOpenCash(open);
                const { listValidatedPaymentKeys } = await import("@/systems/practice-host/controllers/validation.controller");
                const validated = await listValidatedPaymentKeys(open.map((row) => row.patient_id));
                if (cancelled) return;
                if (validated) setOpenCashValidatedKeys(validated);
                setOpenCashError(null);
            } catch (e) {
                if (!cancelled) {
                    setOpenCash([]);
                    setOpenCashError(errorMessage(e));
                }
            } finally {
                if (!cancelled) setOpenCashLoaded(true);
            }
        };

        setOpenCashLoaded(false);
        void loadOpenCash();
        const onRefresh = () => {
            void loadOpenCash();
        };
        window.addEventListener(PAGE_REFRESH_EVENT, onRefresh);
        return () => {
            cancelled = true;
            window.removeEventListener(PAGE_REFRESH_EVENT, onRefresh);
        };
    }, [reloadToken, session?.role, session?.permission_overrides]);

    useEffect(() => {
        let cancelled = false;
        const role = parseRole(session?.role ?? undefined);
        const canQueue =
            role != null &&
            allowed("patient.read_medical", role, session?.permission_overrides);

        const loadQueue = async (initial: boolean) => {
            if (!canQueue) {
                if (!cancelled) {
                    setChartsToValidate([]);
                    setChartsQueueLoading(false);
                }
                return;
            }
            if (initial) setChartsQueueLoading(true);
            try {
                const rows = await listChartsToValidate();
                if (!cancelled) setChartsToValidate(rows);
            } catch {
                if (!cancelled) setChartsToValidate([]);
            } finally {
                if (!cancelled && initial) setChartsQueueLoading(false);
            }
        };

        void loadQueue(true);
        const onRefresh = () => {
            void loadQueue(false);
        };
        window.addEventListener("medoc-nav-badges-refresh", onRefresh);
        window.addEventListener(PAGE_REFRESH_EVENT, onRefresh);
        const interval = window.setInterval(() => {
            void loadQueue(false);
        }, CHARTS_QUEUE_POLL_MS);
        const onVisible = () => {
            if (document.visibilityState === "visible") void loadQueue(false);
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            cancelled = true;
            window.removeEventListener("medoc-nav-badges-refresh", onRefresh);
            window.removeEventListener(PAGE_REFRESH_EVENT, onRefresh);
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [session?.role, session?.permission_overrides, reloadToken]);

    useEffect(() => {
        let cancelled = false;
        const roleNow = parseRole(session?.role ?? undefined);
        const canClinical =
            roleNow != null && allowed("patient.read_medical", roleNow, session?.permission_overrides);
        const canTickets =
            roleNow === "PHYSICIAN" || roleNow === "RECEPTION";

        const loadPendingTasks = async (initial: boolean) => {
            if (canClinical || !canTickets) {
                if (!cancelled) {
                    setPendingTasks([]);
                    setPendingTasksLoading(false);
                }
                return;
            }
            if (initial) setPendingTasksLoading(true);
            try {
                const rows = filterReceptionPendingTasks(await listPracticeTasksForMe());
                if (!cancelled) setPendingTasks(rows);
            } catch {
                if (!cancelled) setPendingTasks([]);
            } finally {
                if (!cancelled && initial) setPendingTasksLoading(false);
            }
        };

        void loadPendingTasks(true);
        const onRefresh = () => {
            void loadPendingTasks(false);
        };
        window.addEventListener("medoc-nav-badges-refresh", onRefresh);
        window.addEventListener(PAGE_REFRESH_EVENT, onRefresh);
        const interval = window.setInterval(() => {
            void loadPendingTasks(false);
        }, INBOX_POLL_MS);
        const onVisible = () => {
            if (document.visibilityState === "visible") void loadPendingTasks(false);
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            cancelled = true;
            window.removeEventListener("medoc-nav-badges-refresh", onRefresh);
            window.removeEventListener(PAGE_REFRESH_EVENT, onRefresh);
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [session?.role, session?.permission_overrides, reloadToken]);

    /** Day-close reminder at that day's closing time from Opening hours (once per day). */
    useEffect(() => {
        const check = () => {
            const raw = practiceClosingTimeHm(usePracticeWorkHoursStore.getState().config, new Date());
            const m = raw ? /^(\d{1,2}):(\d{2})$/.exec(raw) : null;
            if (!m) return;
            const th = Number(m[1]);
            const tmin = Number(m[2]);
            if (!Number.isFinite(th) || !Number.isFinite(tmin) || th < 0 || th > 23 || tmin < 0 || tmin > 59) return;
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
    }, [toast, t]);

    const todayIso = practiceTodayYmd();
    const patientById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
    const role = useMemo(() => parseRole(session?.role ?? undefined), [session?.role]);

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

    const canPatientWrite = role != null && allowed("patient.write", role, session?.permission_overrides);
    const canViewClinical = role != null && allowed("patient.read_medical", role, session?.permission_overrides);
    const canWriteMedical = role != null && allowed("patient.write_medical", role, session?.permission_overrides);
    const receptionPendingTasks = useMemo(
        () => (canViewClinical ? [] : filterReceptionPendingTasks(pendingTasks)).slice(0, DASHBOARD_PENDING_TASKS_MAX),
        [canViewClinical, pendingTasks],
    );
    const showPendingTasks = !canViewClinical && receptionPendingTasks.length > 0;

    // Names for today's appointments and the pending tasks: fetch only ids not already known.
    const neededPatientIds = useMemo(() => {
        const ids = new Set<string>();
        for (const a of appointments) if (a.patient_id) ids.add(a.patient_id);
        for (const task of receptionPendingTasks) if (task.patient_id) ids.add(task.patient_id);
        return [...ids].sort().join(",");
    }, [appointments, receptionPendingTasks]);
    useEffect(() => {
        const missing = neededPatientIds.split(",").filter((id) => id && !patientById.has(id));
        if (missing.length === 0) return;
        let cancelled = false;
        listPatientsByIds(missing)
            .then((rows) => {
                if (!cancelled && rows.length) setPatients((prev) => [...prev, ...rows]);
            })
            .catch(() => undefined); // names fall back to the "patient" label
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the needed ids change
    }, [neededPatientIds]);
    const freigabenItemCount = canViewClinical ? chartsToValidate.length : receptionPendingTasks.length;
    const freigabenLeer =
        !chartsQueueLoading &&
        !pendingTasksLoading &&
        freigabenItemCount === 0 &&
        !listsError;
    const canReadPatients = role != null && allowed("patient.read", role, session?.permission_overrides);
    const canReadAppointments = role != null && allowed("appointment.read", role, session?.permission_overrides);
    const canReadFinance = role != null && allowed("finance.read", role, session?.permission_overrides);
    const canSeeOpenCash = role != null && canReadCashArea(role, session?.permission_overrides);
    const canPurchaseOrderWrite = role != null && allowed("purchase_order.write", role, session?.permission_overrides);
    const showStatistics = role != null && routeChildPathAllowed("statistics", role, session?.permission_overrides);

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

    const handleApproveChart = useCallback(
        async (patientId: string) => {
            setApproveBusyId(patientId);
            try {
                await validatePatientChart(patientId);
                setChartsToValidate((prev) => prev.filter((r) => r.patient_id !== patientId));
                window.dispatchEvent(new Event("medoc-nav-badges-refresh"));
                toast(t("page.charts_to_validate.validated_toast"), "success");
            } catch (e) {
                toast(`${t("dashboard.freigaben.toast_approve_error")}: ${errorMessage(e)}`, "error");
            } finally {
                setApproveBusyId(null);
            }
        },
        [t, toast],
    );

    const handleDeclineChart = useCallback(
        async (patientId: string) => {
            setApproveBusyId(patientId);
            try {
                await declinePatientChart(patientId);
                setChartsToValidate((prev) => prev.filter((r) => r.patient_id !== patientId));
                window.dispatchEvent(new Event("medoc-nav-badges-refresh"));
                toast(t("page.charts_to_validate.declined_toast"), "success");
            } catch (e) {
                toast(`${t("dashboard.freigaben.toast_approve_error")}: ${errorMessage(e)}`, "error");
            } finally {
                setApproveBusyId(null);
            }
        },
        [t, toast],
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

    const freigabenSub = canViewClinical
        ? chartsQueueLoading && chartsToValidate.length === 0
            ? t("dashboard.freigaben.scanning")
            : freigabenItemCount > 0
              ? t("dashboard.freigaben.sub_count").replace("{{count}}", String(freigabenItemCount))
              : t("dashboard.freigaben.sub_zero")
        : pendingTasksLoading && receptionPendingTasks.length === 0
          ? t("dashboard.pending_tasks.loading")
          : freigabenItemCount > 0
            ? t("dashboard.pending_tasks.sub_count").replace("{{count}}", String(freigabenItemCount))
            : t("dashboard.pending_tasks.sub_zero");

    return (
        <div
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", flex: 1, minHeight: 0 }}
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
            <div className="dashboard-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
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
                {stats.revenue_today != null && canReadFinance && (
                    <StatCard
                        label={t("dashboard.kpi.revenue_today")}
                        value={formatCurrency(stats.revenue_today)}
                        icon="Wallet"
                        accent="#0A84FF"
                        sub={t("dashboard.kpi.revenue_today_sub")}
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
            <div className="split dashboard-main-split">
                <div className="col dashboard-col-primary">
                    <div className="card dashboard-card-fill">
                        <div className="card-head" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-3)" }}>
                            <div style={{ minWidth: 0 }}>
                                <div className="card-title">
                                    {canViewClinical ? t("dashboard.freigaben.title") : t("dashboard.pending_tasks.title")}
                                </div>
                                <div className="card-sub">{freigabenSub}</div>
                            </div>
                            <div className="dashboard-wire-head-actions">
                                <button
                                    type="button"
                                    className="dashboard-wire-head-link nav-link-forward"
                                    onClick={() => navigate(canViewClinical ? "/charts/to-validate" : "/tickets")}
                                >
                                    {t("dashboard.freigaben.show_all")} <span className="nav-chevron" aria-hidden>›</span>
                                </button>
                            </div>
                        </div>
                        <div className="dashboard-card-list" style={{ padding: 0 }}>
                            {chartsQueueLoading && chartsToValidate.length === 0 && canViewClinical ? (
                                <div style={{ padding: "16px 20px", fontSize: 14, color: "var(--fg-3)" }}>{t("page.charts_to_validate.loading")}</div>
                            ) : null}
                            {!canViewClinical && pendingTasksLoading && receptionPendingTasks.length === 0 ? (
                                <div style={{ padding: "16px 20px", fontSize: 14, color: "var(--fg-3)" }}>
                                    {t("dashboard.pending_tasks.loading")}
                                </div>
                            ) : null}
                            {canViewClinical
                                ? chartsToValidate.map((row) => {
                                      const busy = approveBusyId === row.patient_id;
                                      const statusKey = `enum.charts_status.${row.chart_status.trim().toLowerCase()}`;
                                      const statusLabel = t(statusKey) === statusKey ? row.chart_status : t(statusKey);
                                      const openPatient = () => navigate(`/patients/${row.patient_id}`);
                                      const stopRowNav = (e: MouseEvent) => {
                                          e.stopPropagation();
                                      };
                                      const onRowKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
                                          if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              openPatient();
                                          }
                                      };
                                      return (
                                          <div
                                              key={row.patient_id}
                                              className="dashboard-wire-row dashboard-wire-row--nav"
                                              role="link"
                                              tabIndex={0}
                                              onClick={openPatient}
                                              onKeyDown={onRowKeyDown}
                                          >
                                              <div className="dashboard-wire-avatar" aria-hidden>
                                                  {initialsFromName(row.patient_name)}
                                              </div>
                                              <div className="dashboard-wire-row-main">
                                                  <div className="dashboard-wire-name-line">
                                                      <span className="dashboard-wire-name">{row.patient_name}</span>
                                                      <span className="dashboard-wire-tag">{statusLabel}</span>
                                                  </div>
                                                  <div className="dashboard-wire-desc">{formatDateTime(row.updated_at)}</div>
                                              </div>
                                              <div className="dashboard-wire-row-aside" onClick={stopRowNav} onKeyDown={(e) => e.stopPropagation()}>
                                                  <div className="dashboard-wire-freigabe-actions">
                                                      {canWriteMedical ? (
                                                          <>
                                                              <button
                                                                  type="button"
                                                                  className="dashboard-wire-approve-btn"
                                                                  disabled={busy}
                                                                  onClick={() => void handleApproveChart(row.patient_id)}
                                                              >
                                                                  <CheckIcon size={15} />
                                                                  {busy ? "…" : t("page.charts_to_validate.validate")}
                                                              </button>
                                                              {/* TODO(later): restore Decline — see docs/coordination/todos-deferred-ui-blinds.md */}
                                                              {CHART_QUEUE_DECLINE_ENABLED ? (
                                                              <button
                                                                  type="button"
                                                                  className="dashboard-wire-btn-secondary"
                                                                  disabled={busy}
                                                                  onClick={() => void handleDeclineChart(row.patient_id)}
                                                              >
                                                                  {busy ? "…" : t("page.charts_to_validate.decline")}
                                                              </button>
                                                              ) : null}
                                                              <button
                                                                  type="button"
                                                                  className="dashboard-wire-icon-btn"
                                                                  disabled={busy}
                                                                  title={t("page.charts_to_validate.remove_from_list")}
                                                                  aria-label={t("page.charts_to_validate.remove_from_list")}
                                                                  onClick={() => void handleDeclineChart(row.patient_id)}
                                                              >
                                                                  <XIcon size={16} />
                                                              </button>
                                                          </>
                                                      ) : null}
                                                  </div>
                                              </div>
                                          </div>
                                      );
                                  })
                                : null}
                            {showPendingTasks
                                ? receptionPendingTasks.map((task) => {
                                      const patientName = taskPatientLabel(
                                          task.patient_id,
                                          patientById,
                                          t("common.dash"),
                                      );
                                      const openTask = () =>
                                          navigate(`/tickets?task=${encodeURIComponent(task.id)}`);
                                      const onRowKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
                                          if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              openTask();
                                          }
                                      };
                                      return (
                                          <div
                                              key={task.id}
                                              className="dashboard-wire-row dashboard-wire-row--nav"
                                              role="link"
                                              tabIndex={0}
                                              onClick={openTask}
                                              onKeyDown={onRowKeyDown}
                                          >
                                              <div className="dashboard-wire-avatar" aria-hidden>
                                                  {initialsFromName(patientName === t("common.dash") ? "?" : patientName)}
                                              </div>
                                              <div className="dashboard-wire-row-main">
                                                  <div className="dashboard-wire-name-line">
                                                      <span className="dashboard-wire-name">
                                                          {practiceTaskHeadline(task, t)}
                                                      </span>
                                                      <Badge variant={taskStatusVariant(task.status)}>
                                                          {taskStatusLabel(t, task.status)}
                                                      </Badge>
                                                  </div>
                                                  <div className="dashboard-wire-desc">
                                                      {patientName}
                                                      {" · "}
                                                      {taskKindLabel(t, task.kind)}
                                                      {(() => {
                                                          const preview = practiceTaskPreview(task, t, tp).slice(0, 80);
                                                          return preview ? ` · ${preview}` : "";
                                                      })()}
                                                  </div>
                                              </div>
                                              <div className="dashboard-wire-row-aside">
                                                  <div className="dashboard-wire-date">
                                                      {formatDateTime(task.updated_at || task.created_at)}
                                                  </div>
                                                  <div className="dashboard-wire-freigabe-actions">
                                                      <button
                                                          type="button"
                                                          className="dashboard-wire-approve-btn"
                                                          onClick={(e) => {
                                                              e.stopPropagation();
                                                              openTask();
                                                          }}
                                                          title={t("dashboard.pending_tasks.open_hint")}
                                                      >
                                                          {t("dashboard.pending_tasks.open")}
                                                      </button>
                                                  </div>
                                              </div>
                                          </div>
                                      );
                                  })
                                : null}
                            {freigabenLeer ? (
                                <EmptyState
                                    icon="✅"
                                    title={
                                        canViewClinical
                                            ? t("page.charts_to_validate.empty_title")
                                            : t("dashboard.pending_tasks.empty_title")
                                    }
                                    description={
                                        canViewClinical
                                            ? t("page.charts_to_validate.subtitle")
                                            : t("dashboard.pending_tasks.empty_desc")
                                    }
                                />
                            ) : null}
                        </div>
                    </div>
                    <div className="card dashboard-card-fill">
                        <div className="card-head" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-3)" }}>
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
                    {canSeeOpenCash ? (
                        <div className="card dashboard-card-fill">
                            <div className="card-head">
                                <div>
                                    <div className="card-title">{t("page.finance_cash.title")}</div>
                                    <div className="card-sub">{t("page.finance_cash.list_sub")}</div>
                                </div>
                            </div>
                            <div className="dashboard-card-list">
                                {!openCashLoaded ? (
                                    <p className="dashboard-cash-note">{t("page.finance_cash.loading")}</p>
                                ) : openCashError ? (
                                    <p className="dashboard-cash-note">{openCashError}</p>
                                ) : openCash.length === 0 ? (
                                    <p className="dashboard-cash-note">{t("page.finance_cash.empty_title")}</p>
                                ) : (
                                    openCash.slice(0, DASHBOARD_OPEN_CASH_MAX).map((row) => {
                                        const name =
                                            patientById.get(row.patient_id)?.name ?? t("appointment.calendar.patient_fallback");
                                        const clock = formatDbTime(row.created_at, locale);
                                        const method = paymentMethodLabel(row.payment_method, t);
                                        return (
                                            <Link
                                                key={row.id}
                                                to={`/patients/${row.patient_id}`}
                                                className="dashboard-cash-row"
                                                aria-label={`${t("dashboard.reminders.open_patient")}: ${name}`}
                                            >
                                                <div className="dashboard-cash-row__who">
                                                    <div className="dashboard-wire-avatar" aria-hidden>
                                                        {initialsFromName(name)}
                                                    </div>
                                                    <div className="dashboard-cash-row__who-text">
                                                        <div className="dashboard-cash-row__name" dir="auto">
                                                            {name}
                                                        </div>
                                                        <div className="dashboard-cash-row__meta">
                                                            {clock ? `${clock} · ${method}` : method}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="dashboard-cash-row__figures">
                                                    <div className="dashboard-cash-row__amount">{formatCurrency(row.amount)}</div>
                                                    <div className="dashboard-cash-row__status">
                                                        {openCashValidatedKeys == null
                                                            ? t("page.finance_cash.status_open")
                                                            : openCashValidatedKeys.has(itemValidationKey("payment", row.id))
                                                              ? t("enum.charts_status.validated")
                                                              : t("patient.detail.tab.payment.status_need_validation")}
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    ) : null}
                    <div className="card dashboard-card-fill">
                        <div className="card-head" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-3)" }}>
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
                                    <button type="button" className="btn btn-accent" style={{ marginTop: "var(--space-4)" }} onClick={() => navigate("/appointments")}>
                                        {t("dashboard.heute.cta_appointments")}
                                    </button>
                                </div>
                            ) : (
                                heuteAppointments.map((r) => {
                                    const name = patientById.get(r.patient_id)?.name ?? t("appointment.calendar.patient_fallback");
                                    const tone = appointmentIsEmergencyMarked(r) ? "yellow" : r.status === "CONFIRMED" ? "blue" : "green";
                                    return (
                                        <div key={r.id} className="dashboard-timeline-row">
                                            <div>
                                                <div className="schedule-day-time-primary">{r.time.slice(0, 5)}</div>
                                                <div className="schedule-day-time-meta">{appointmentIsEmergencyMarked(r) ? t("dashboard.appointments.emergency") : appointmentKindLabel(r.kind)}</div>
                                            </div>
                                            <div className="row" style={{ gap: "var(--space-3)" }}>
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
                                <div className="row" style={{ gap: "var(--space-3)" }}>
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

