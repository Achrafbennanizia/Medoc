import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { countPatientsByFilter, deletePatient, exportPatientsCsv, listAllPatients, listPatientsPaged, restorePatient, type PatientFilterCounts } from "@/systems/practice-host/controllers/patient.controller";
import { listPatientIdsOpenInvoice } from "@/systems/practice-host/controllers/payment.controller";
import { errorMessage, formatDate, hueFromId, initialsFromName } from "@/lib/utils";
import { loadClientSettings } from "@/lib/client-settings";
import { suggestSimilarTitles } from "@/lib/string-suggest";
import { useT, useTParams } from "@/lib/i18n";
import type { Patient } from "../../models/types";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import {
    patientMatchesStatusFilter,
    patientStatusFilterNeedsClientBucket,
    patientStatusFilterServerStatus,
    type PatientStatusFilter,
} from "@/lib/patient-status-filter";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { MoreIcon, PlusIcon, SearchIcon, UsersIcon, XIcon, ExportIcon } from "@/lib/icons";
import { useDismissibleLayer } from "../components/ui/use-dismissible-layer";
import { usePageRefresh } from "../layouts/page-refresh";
import { DataExportPickerDialog } from "../components/data-export-picker-dialog";
import type { ExportContext } from "@/lib/save-download";
import { ConfirmDialog, Dialog } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { PhoneText } from "../components/ui/phone-text";
import { WorkspacePageHeader } from "../components/administration-page-header";
import { PATIENT_LIST_CALL_EMAIL_ENABLED, PATIENT_LIST_SHOW_ARCHIVED_ENABLED } from "@/lib/v1-ui-flags";
import { LAZY_PAGE_SIZE, mergeUniqueById } from "@/lib/lazy-list";
import { readListSnapshot, writeListSnapshot } from "@/lib/list-snapshot";

const SEARCH_DEBOUNCE_MS = 250;
const PATIENT_PAGE_SIZE = Math.min(LAZY_PAGE_SIZE, 50);

type PatientListCache = {
    items: Patient[];
    total: number;
    page: number;
    counts: PatientFilterCounts | null;
    invoiceIds: string[];
};

function patientListCacheKey(query: string, showArchived: boolean, statusFilter: string): string {
    return `patients:${showArchived}:${statusFilter}:${query}`;
}

const initialPatientList = readListSnapshot<PatientListCache>(patientListCacheKey("", false, "ALL"));

function patientHasOpenInvoice(openPatientIds: ReadonlySet<string>, patientId: string): boolean {
    return openPatientIds.has(patientId);
}

function buildFilterCounts(
    patients: Patient[],
    openPatientIds: ReadonlySet<string>,
): Record<PatientStatusFilter, number> {
    let inTreatment = 0;
    let newPatient = 0;
    let invoiceOpen = 0;
    let chartOpen = 0;
    let closed = 0;
    for (const p of patients) {
        if (patientMatchesStatusFilter(p, "IN_TREATMENT", openPatientIds)) inTreatment += 1;
        if (patientMatchesStatusFilter(p, "NEW_PATIENT", openPatientIds)) newPatient += 1;
        if (patientMatchesStatusFilter(p, "INVOICE_OPEN", openPatientIds)) invoiceOpen += 1;
        if (patientMatchesStatusFilter(p, "CHART_OPEN", openPatientIds)) chartOpen += 1;
        if (patientMatchesStatusFilter(p, "CLOSED", openPatientIds)) closed += 1;
    }
    return {
        ALL: patients.length,
        IN_TREATMENT: inTreatment,
        NEW_PATIENT: newPatient,
        INVOICE_OPEN: invoiceOpen,
        CHART_OPEN: chartOpen,
        CLOSED: closed,
    };
}

/** Load every page for search + optional single status (client buckets need the full set). */
async function listPatientsComplete(opts: {
    showArchived: boolean;
    search?: string;
    status?: string;
}): Promise<Patient[]> {
    const out: Patient[] = [];
    const pageSize = 500;
    for (let page = 1; page <= 1000; page += 1) {
        const resp = await listPatientsPaged({
            page,
            pageSize,
            search: opts.search,
            filter: {
                showArchived: opts.showArchived,
                ...(opts.status ? { status: opts.status } : {}),
            },
        });
        out.push(...resp.items);
        if (resp.items.length === 0 || out.length >= resp.total) break;
    }
    return out;
}

function patientStatusPill(p: Patient, t: (key: string) => string): { label: string; variant: "primary" | "success" | "default" | "warning" } {
    if (p.status === "NEW") return { label: t("patient.pill.new"), variant: "primary" };
    if (p.status === "ACTIVE" || p.status === "VALIDATED") return { label: t("patient.pill.in_treatment"), variant: "success" };
    if (p.status === "READONLY") return { label: t("patient.pill.closed"), variant: "default" };
    if (p.status === "ARCHIVED") return { label: t("patient.pill.archived"), variant: "default" };
    return { label: p.status, variant: "default" };
}

export function PatientsPage() {
    const t = useT();
    const tp = useTParams();
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.role);
    const canDeletePatient = role != null && allowed("patient.write_medical", role, session?.permission_overrides);
    const canRestorePatient = role != null && allowed("ops.system", role, session?.permission_overrides);
    const canViewMedical = role != null && allowed("patient.read_medical", role, session?.permission_overrides);
    const canCreatePatient = role != null && allowed("patient.write", role, session?.permission_overrides);
    const [patients, setPatients] = useState<Patient[]>(() => initialPatientList?.items ?? []);
    const [patientTotal, setPatientTotal] = useState(() => initialPatientList?.total ?? 0);
    /** F57: counts over all patients from the backend; `null` while searching or on error. */
    const [serverCounts, setServerCounts] = useState<PatientFilterCounts | null>(() => initialPatientList?.counts ?? null);
    const [patientPage, setPatientPage] = useState(() => initialPatientList?.page ?? 0);
    const [loadingMore, setLoadingMore] = useState(false);
    const [nameDirectory, setNameDirectory] = useState<string[]>([]);
    /** Full directory from last unfiltered list — keeps spellcheck suggestions while searching. */
    const [allPatientNames, setAllPatientNames] = useState<string[]>([]);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<PatientStatusFilter>("ALL");
    const [showArchived, setShowArchived] = useState(false);
    const [actionMenuPatientId, setActionMenuPatientId] = useState<string | null>(null);
    const [openPaymentPatientIds, setOpenPaymentPatientIds] = useState<ReadonlySet<string>>(
        () => new Set(initialPatientList?.invoiceIds ?? []),
    );
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deleteDoneOpen, setDeleteDoneOpen] = useState(false);
    const [loading, setLoading] = useState(() => !initialPatientList);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [exportPickerOpen, setExportPickerOpen] = useState(false);
    /** Client-bucket tabs load the full matching set — disable infinite scroll. */
    const [clientBucketComplete, setClientBucketComplete] = useState(false);
    const actionLayerRef = useRef<HTMLDivElement>(null);
    const listScrollRef = useRef<HTMLDivElement>(null);
    const loadMoreLock = useRef(false);
    const invoicesFetchedRef = useRef(false);
    const searchLoadTokenRef = useRef(0);
    const silentLoadInflight = useRef(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const toast = useToastStore((s) => s.add);
    const fromAppointmentCreate = searchParams.get("from") === "appointment-create";
    const draft = searchParams.get("draft") ?? "";
    const detailSuffix = fromAppointmentCreate && draft ? `?from=appointment-create&draft=${encodeURIComponent(draft)}` : "";

    useDismissibleLayer({
        open: Boolean(actionMenuPatientId),
        rootRef: actionLayerRef,
        onDismiss: () => setActionMenuPatientId(null),
    });

    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(t);
    }, [search]);

    const load = useCallback(async (opts?: { silent?: boolean }) => {
        const silent = opts?.silent === true;
        if (silent && silentLoadInflight.current) return;
        const token = ++searchLoadTokenRef.current;
        const q = debouncedSearch.trim();
        const key = patientListCacheKey(q, showArchived, statusFilter);
        const snap = readListSnapshot<PatientListCache>(key);
        if (snap) {
            setPatients(snap.items);
            setPatientTotal(snap.total);
            setPatientPage(snap.page);
            setServerCounts(snap.counts);
            if (snap.invoiceIds.length > 0) setOpenPaymentPatientIds(new Set(snap.invoiceIds));
            setClientBucketComplete(patientStatusFilterNeedsClientBucket(statusFilter));
            setLoading(false);
        }
        if (silent) silentLoadInflight.current = true;
        if (!silent && !snap) {
            setLoading(true);
            setLoadError(null);
        }
        try {
            const useClientBucket = patientStatusFilterNeedsClientBucket(statusFilter);
            const status = patientStatusFilterServerStatus(statusFilter);
            const refreshInvoices = !invoicesFetchedRef.current || silent || useClientBucket;
            const [ids, counts] = await Promise.all([
                refreshInvoices
                    ? listPatientIdsOpenInvoice().catch(() => [] as string[])
                    : Promise.resolve(null),
                q ? Promise.resolve(null) : countPatientsByFilter(showArchived).catch(() => null),
            ]);
            if (token !== searchLoadTokenRef.current) return;
            const invoiceIds = ids ?? [...(snap?.invoiceIds ?? [])];
            const openSet = new Set(invoiceIds);
            if (ids) {
                invoicesFetchedRef.current = true;
                setOpenPaymentPatientIds(openSet);
            }
            setServerCounts(counts);

            if (useClientBucket) {
                // Tab counts are global; page-1 + client filter left lists empty.
                const all = q
                    ? await listPatientsComplete({ showArchived, search: q || undefined })
                    : await listAllPatients(showArchived);
                if (token !== searchLoadTokenRef.current) return;
                const matched = all.filter((p) => patientMatchesStatusFilter(p, statusFilter, openSet));
                setPatients(matched);
                setPatientTotal(matched.length);
                setPatientPage(1);
                setClientBucketComplete(true);
                setLoading(false);
                const names = matched.map((p) => p.name);
                if (!q) {
                    setNameDirectory(names);
                    setAllPatientNames((prev) => (prev.length > names.length ? prev : names));
                }
                writeListSnapshot<PatientListCache>(key, {
                    items: matched,
                    total: matched.length,
                    page: 1,
                    counts,
                    invoiceIds,
                });
                return;
            }

            setClientBucketComplete(false);
            const dataResp = await listPatientsPaged({
                page: 1,
                pageSize: PATIENT_PAGE_SIZE,
                search: q || undefined,
                filter: { showArchived, ...(status ? { status } : {}) },
            });
            if (token !== searchLoadTokenRef.current) return;
            setPatients((prev) => {
                const rows = !silent || prev.length <= dataResp.items.length
                    ? dataResp.items
                    : (() => {
                        const fresh = new Map(dataResp.items.map((row) => [row.id, row]));
                        const prevIds = new Set(prev.map((row) => row.id));
                        const added = dataResp.items.filter((row) => !prevIds.has(row.id));
                        return added.concat(prev.map((row) => fresh.get(row.id) ?? row));
                    })();
                const seen = new Set<string>();
                return rows.filter((row) => {
                    if (seen.has(row.id)) return false;
                    seen.add(row.id);
                    return true;
                });
            });
            setPatientTotal(dataResp.total);
            if (!silent) setPatientPage(dataResp.page);
            setLoading(false);
            const names = dataResp.items.map((p) => p.name);
            if (!q) {
                setNameDirectory(names);
                setAllPatientNames((prev) => (prev.length > names.length ? prev : names));
            }
            writeListSnapshot<PatientListCache>(key, {
                items: dataResp.items,
                total: dataResp.total,
                page: dataResp.page,
                counts,
                invoiceIds,
            });
        } catch (e) {
            if (token !== searchLoadTokenRef.current || silent) return;
            if (!snap) {
                setLoadError(errorMessage(e));
                setPatients([]);
                setOpenPaymentPatientIds(new Set());
            }
        } finally {
            if (silent) silentLoadInflight.current = false;
            if (!silent && token === searchLoadTokenRef.current) setLoading(false);
        }
    }, [debouncedSearch, showArchived, statusFilter]);

    useEffect(() => {
        void load();
    }, [load]);

    usePageRefresh(() => {
        if (patientPage > 1 || loadingMore) return;
        void load({ silent: true });
    });

    const patientsHaveMore =
        !clientBucketComplete && patientPage * PATIENT_PAGE_SIZE < patientTotal;

    const onListScroll = useCallback(() => {
        if (!patientsHaveMore || loadingMore || loadMoreLock.current || clientBucketComplete) return;
        loadMoreLock.current = true;
        setLoadingMore(true);
        const q = debouncedSearch.trim();
        const status = patientStatusFilterServerStatus(statusFilter);
        void listPatientsPaged({
            page: patientPage + 1,
            pageSize: PATIENT_PAGE_SIZE,
            search: q || undefined,
            filter: { showArchived, ...(status ? { status } : {}) },
        })
            .then((resp) => {
                setPatientPage(resp.page);
                setPatientTotal(resp.total);
                setPatients((prev) => mergeUniqueById(prev, resp.items));
                setAllPatientNames((prev) => {
                    const next = new Set(prev);
                    for (const p of resp.items) next.add(p.name);
                    return [...next];
                });
            })
            .catch((e) => toast(tp("common.refresh_failed", { message: errorMessage(e) }), "error"))
            .finally(() => {
                setLoadingMore(false);
                loadMoreLock.current = false;
            });
    }, [
        patientsHaveMore,
        loadingMore,
        patientPage,
        toast,
        tp,
        showArchived,
        debouncedSearch,
        statusFilter,
        clientBucketComplete,
    ]);

    useEffect(() => {
        const anchor = listScrollRef.current;
        const scroller = anchor?.closest(".app-main");
        if (!(scroller instanceof HTMLElement)) return;
        let frame = 0;
        const onScroll = () => {
            if (frame) return;
            frame = window.requestAnimationFrame(() => {
                frame = 0;
                if (scroller.scrollTop < 48) return;
                if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 160) onListScroll();
            });
        };
        scroller.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            scroller.removeEventListener("scroll", onScroll);
            if (frame) window.cancelAnimationFrame(frame);
        };
    }, [onListScroll, loading, patients.length]);

    const filtered = useMemo(() => {
        const seen = new Set<string>();
        return patients.filter((p) => {
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            // Client-bucket loads already match; still re-check so invoice updates apply.
            return patientMatchesStatusFilter(p, statusFilter, openPaymentPatientIds);
        });
    }, [patients, statusFilter, openPaymentPatientIds]);

    // F57: without a search, counts come from the backend (all patients), not
    // from the rows loaded so far; search results are complete, so count those.
    const filterCounts = useMemo(
        () => serverCounts ?? buildFilterCounts(patients, openPaymentPatientIds),
        [serverCounts, patients, openPaymentPatientIds],
    );
    const searching = debouncedSearch.trim().length > 0;
    const shownTotal = searching ? patients.length : patientTotal;
    const shownFiltered = searching || !serverCounts ? filtered.length : serverCounts[statusFilter];

    const resolvePatientExport = useCallback(async () => {
        const q = debouncedSearch.trim();
        const status = patientStatusFilterServerStatus(statusFilter);
        const csv = await exportPatientsCsv({
            search: q || undefined,
            filter: { showArchived, ...(status ? { status } : {}) },
        });
        if (!csv.trim() || csv.split("\n").filter((l) => l.trim()).length <= 1) return null;
        const d = new Date().toISOString().slice(0, 10);
        return {
            exportTitle: t("patient.export.title_short"),
            hint: t("patient.export.hint"),
            suggestedFilename: `medoc-patients-${d}.csv`,
            textBody: csv,
            mime: "text/csv;charset=utf-8",
            context: { kind: "patients_migration", format: "csv", entityId: null } satisfies ExportContext,
        };
    }, [debouncedSearch, showArchived, statusFilter, t]);

    const openPatientExport = async () => {
        // F57: load the remaining pages first so the export covers every patient.
        if (!searching && patients.length < patientTotal) {
            try {
                const all = await listAllPatients(showArchived);
                setPatients(all);
                setPatientPage(Math.ceil(all.length / LAZY_PAGE_SIZE));
            } catch (e) {
                toast(errorMessage(e), "error");
                return;
            }
        }
        if (filtered.length === 0 && patientTotal === 0) {
            toast(t("patient.export.toast_empty"), "info");
            return;
        }
        setExportPickerOpen(true);
    };

    const nameSuggestions = useMemo(() => {
        const disableFuzzy = loadClientSettings().search?.autocompleteSuggestionsEnabled === false;
        return suggestSimilarTitles(
            debouncedSearch,
            allPatientNames.length > 0 ? allPatientNames : nameDirectory,
            2,
            5,
            { disabled: disableFuzzy },
        );
    }, [debouncedSearch, nameDirectory, allPatientNames]);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <WorkspacePageHeader
                titleLevel="h1"
                title={t("patient.page.title")}
                subtitle={tp("patient.page.subtitle", { filtered: shownFiltered, total: shownTotal })}
                actions={
                    canCreatePatient ? (
                        <button className="btn btn-accent" type="button" onClick={() => navigate("/patients/new")}>
                            <PlusIcon />{t("patient.new")}
                        </button>
                    ) : null
                }
            />

            <div className="page-toolbar">
                <div className="page-toolbar__search">
                    <div className="input" style={{ width: "100%", minWidth: 0 }} title={t("patient.search.placeholder")}>
                        <SearchIcon size={14} aria-hidden />
                        <input
                            placeholder={t("patient.search.placeholder")}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            aria-label={t("patient.search.placeholder")}
                        />
                        {search.trim() ? (
                            <button
                                type="button"
                                className="icon-btn"
                                style={{ width: 28, height: 28 }}
                                aria-label={t("patient.search.clear")}
                                onClick={() => setSearch("")}
                            >
                                <XIcon size={14} />
                            </button>
                        ) : null}
                    </div>
                </div>
                <div className="page-toolbar__filters">
                    <button
                        type="button"
                        className="btn btn-subtle"
                        onClick={() => void openPatientExport()}
                        disabled={loading || !!loadError || filtered.length === 0}
                        title={t("patient.export.title_attr")}
                        aria-label={t("patient.export.aria")}
                    >
                        <ExportIcon size={14} aria-hidden /> {t("patient.export.button")}
                    </button>
                </div>
            </div>

            <div id="patient-status-filters" className="seg" style={{ alignSelf: "flex-start" }}>
                {[
                    { id: "ALL", labelKey: "patient.filter.ALL" },
                    { id: "IN_TREATMENT", labelKey: "patient.filter.IN_TREATMENT" },
                    { id: "NEW_PATIENT", labelKey: "patient.filter.NEW_PATIENT" },
                    { id: "INVOICE_OPEN", labelKey: "patient.filter.INVOICE_OPEN" },
                    { id: "CHART_OPEN", labelKey: "patient.filter.CHART_OPEN" },
                    { id: "CLOSED", labelKey: "patient.filter.CLOSED" },
                ].map((f) => (
                    <button key={f.id} aria-pressed={statusFilter === f.id} onClick={() => setStatusFilter(f.id as PatientStatusFilter)}>
                        {t(f.labelKey)}{" "}
                        <span className="seg__count">{filterCounts[f.id as PatientStatusFilter]}</span>
                    </button>
                ))}
                {/* TODO(later): restore Show archived — see docs/coordination/todos-deferred-ui-blinds.md */}
                {PATIENT_LIST_SHOW_ARCHIVED_ENABLED ? (
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: 12, fontSize: 13 }}>
                    <input
                        type="checkbox"
                        checked={showArchived}
                        onChange={(e) => setShowArchived(e.target.checked)}
                    />
                    {t("patient.filter.show_archived")}
                </label>
                ) : null}
            </div>

            {loading ? (
                <PageLoading label={t("patient.loading")} />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load()} />
            ) : patients.length === 0 && !debouncedSearch.trim() ? (
                <EmptyState
                    graphic={<UsersIcon size={40} />}
                    title={t("patient.empty.title")}
                    description={t("patient.empty.description")}
                />
            ) : filtered.length === 0 ? (
                <div className="card card-pad patients-no-results">
                    <h3 className="page-title patients-no-results__title">{t("patient.search.no_results")}</h3>
                    <p className="patients-no-results__desc">
                        {debouncedSearch.trim()
                            ? tp("patient.search.query_label", { query: debouncedSearch.trim() })
                            : t("patient.search.filter_no_match")}
                    </p>
                    {nameSuggestions.length > 0 ? (
                        <p className="patients-no-results__suggest">
                            <span>{t("palette.suggest_prefix")}</span>{" "}
                            {nameSuggestions.join(" · ")}
                        </p>
                    ) : null}
                    <div className="patients-no-results__actions">
                        <button type="button" className="btn btn-subtle" onClick={() => { setSearch(""); setStatusFilter("ALL"); }}>
                            {t("common.reset_filters")}
                        </button>
                        {canCreatePatient ? (
                        <button type="button" className="btn btn-accent" onClick={() => navigate("/patients/new")}>
                            {t("patient.new")}
                        </button>
                        ) : null}
                    </div>
                </div>
            ) : (
                <div className="card patients-table card--overflow-visible tbl-scroll" ref={listScrollRef}>
                    <div className="patients-grid-head">
                        <div>{t("patient.table.patient")}</div><div>{t("patient.table.birthdate")}</div><div>{t("patient.table.contact")}</div><div>{t("patient.table.status")}</div><div />
                    </div>
                    {filtered.map((p) => {
                        const hue = hueFromId(p.id);
                        const pill = patientStatusPill(p, t);
                        const openInv = patientHasOpenInvoice(openPaymentPatientIds, p.id);
                        return (
                            <div
                                key={p.id}
                                onClick={() => navigate(`/patients/${p.id}${detailSuffix}`)}
                                className="patients-grid-row"
                            >
                                <div className="row" style={{ gap: 12 }}>
                                    <div className="av" style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 80%), hsl(${hue} 60% 50%))` }}>
                                        {initialsFromName(p.name)}
                                    </div>
                                    <div className="col">
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                                        <div style={{ color: "var(--fg-3)", fontSize: 12 }}>{p.sex === "MALE" ? t("patient.gender.MALE") : p.sex === "FEMALE" ? t("patient.gender.FEMALE") : t("patient.gender.DIVERSE")}</div>
                                    </div>
                                </div>
                                <div style={{ fontSize: 13 }}>{formatDate(p.date_of_birth)}</div>
                                <div className="col" style={{ fontSize: 12.5 }}>
                                    <div><PhoneText value={p.phone} /></div>
                                    <div style={{ color: "var(--fg-3)" }}>{p.email || "—"}</div>
                                </div>
                                <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                                    {p.status === "NEW" ? (
                                        <span title={t("patient.status.new.explanation")}>
                                            <Badge variant={pill.variant}>{pill.label}</Badge>
                                        </span>
                                    ) : (
                                        <Badge variant={pill.variant}>{pill.label}</Badge>
                                    )}
                                    {openInv ? (
                                        <span title={t("patient.pill.payment_open_title")}>
                                            <Badge variant="warning">{t("patient.pill.payment_open")}</Badge>
                                        </span>
                                    ) : null}
                                </div>
                                <div ref={actionMenuPatientId === p.id ? actionLayerRef : null} style={{ position: "relative" }}>
                                    <button
                                        className="icon-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActionMenuPatientId((prev) => (prev === p.id ? null : p.id));
                                        }}
                                        style={{ width: 30, height: 30 }}
                                        aria-haspopup="menu"
                                        aria-expanded={actionMenuPatientId === p.id}
                                        aria-label={tp("patient.menu.actions_aria", { name: p.name })}
                                    >
                                        <MoreIcon size={16} />
                                    </button>
                                    {actionMenuPatientId === p.id ? (
                                        <div className="menu-surface" style={{ insetInlineEnd: 0, top: "calc(100% + 6px)", bottom: "auto", minWidth: 220 }} role="menu">
                                            <div className="menu-list" style={{ paddingTop: 8 }}>
                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    className="menu-item"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActionMenuPatientId(null);
                                                        navigate(`/patients/${p.id}${detailSuffix}`);
                                                    }}
                                                >
                                                    {t("patient.menu.open_record")}
                                                </button>
                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    className="menu-item"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActionMenuPatientId(null);
                                                        navigate(`/appointments/new?patient_id=${encodeURIComponent(p.id)}`);
                                                    }}
                                                >
                                                    {t("patient.menu.appointment")}
                                                </button>
                                                {canViewMedical ? (
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        className="menu-item"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActionMenuPatientId(null);
                                                            navigate(`/prescriptions?patient_id=${encodeURIComponent(p.id)}`);
                                                        }}
                                                    >
                                                        {t("patient.menu.prescription")}
                                                    </button>
                                                ) : null}
                                                {PATIENT_LIST_CALL_EMAIL_ENABLED && p.email?.trim() ? (
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        className="menu-item"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActionMenuPatientId(null);
                                                            window.location.href = `mailto:${encodeURIComponent(p.email!)}`;
                                                        }}
                                                    >
                                                        {tp("patient.menu.email", { email: p.email! })}
                                                    </button>
                                                ) : null}
                                                {PATIENT_LIST_CALL_EMAIL_ENABLED && p.phone?.trim() ? (
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        className="menu-item"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActionMenuPatientId(null);
                                                            window.location.href = `tel:${p.phone!.replace(/\s+/g, "")}`;
                                                        }}
                                                    >
                                                        {t("patient.menu.call").split("{phone}").flatMap((part, i) =>
                                                            i === 0
                                                                ? [part]
                                                                : [<PhoneText key="phone" value={p.phone} empty="" />, part],
                                                        )}
                                                    </button>
                                                ) : null}
                                                {PATIENT_LIST_CALL_EMAIL_ENABLED && !p.email?.trim() && !p.phone?.trim() ? (
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        className="menu-item"
                                                        disabled
                                                        style={{ opacity: 0.6, cursor: "not-allowed" }}
                                                    >
                                                        {t("patient.menu.no_contact")}
                                                    </button>
                                                ) : null}
                                                {p.status === "ARCHIVED" && canRestorePatient ? (
                                                    <button
                                                        type="button"
                                                        className="menu-item"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActionMenuPatientId(null);
                                                            void restorePatient(p.id)
                                                                .then(() => load())
                                                                .catch((err) => toast(errorMessage(err), "error"));
                                                        }}
                                                    >
                                                        {t("patient.restore")}
                                                    </button>
                                                ) : null}
                                                {canDeletePatient && p.status !== "ARCHIVED" ? (
                                                    <button
                                                        type="button"
                                                        className="menu-item danger"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActionMenuPatientId(null);
                                                            setDeleteId(p.id);
                                                        }}
                                                    >
                                                        {t("patient.menu.archive")}
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                    {loadingMore ? <div className="patients-grid-row" style={{ color: "var(--fg-3)", fontSize: 13 }}>{t("patient.loading")}</div> : null}
                </div>
            )}

            <ConfirmDialog
                open={Boolean(deleteId)}
                onClose={() => !deleteBusy && setDeleteId(null)}
                onConfirm={() => {
                    if (!deleteId) return;
                    setDeleteBusy(true);
                    void (async () => {
                        try {
                            await deletePatient(deleteId);
                            setDeleteId(null);
                            setDeleteDoneOpen(true);
                            await load();
                        } catch (e) {
                            toast(errorMessage(e), "error");
                        } finally {
                            setDeleteBusy(false);
                        }
                    })();
                }}
                title={t("patient.archive.confirm_title")}
                message={t("patient.archive.confirm_message")}
                confirmLabel={t("common.yes_archive")}
                danger
                loading={deleteBusy}
            />
            <Dialog
                open={deleteDoneOpen}
                onClose={() => setDeleteDoneOpen(false)}
                title={t("common.notice")}
                footer={<Button onClick={() => setDeleteDoneOpen(false)}>{t("common.ok")}</Button>}
            >
                <p style={{ color: "var(--fg-2)", fontSize: 14, margin: 0 }}>{t("patient.archive.done")}</p>
            </Dialog>
            <DataExportPickerDialog
                open={exportPickerOpen}
                onClose={() => setExportPickerOpen(false)}
                title={t("patient.export.title")}
                description={t("patient.export.description")}
                formats={[{ value: "csv", label: t("patient.export.format_csv") }]}
                defaultFormat="csv"
                resolvePayload={resolvePatientExport}
            />
        </div>
    );
}
