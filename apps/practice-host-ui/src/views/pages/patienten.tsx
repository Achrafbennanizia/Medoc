import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { deletePatient, listPatienten, searchPatienten } from "@/systems/practice-host/controllers/patient.controller";
import { listPatientIdsOpenInvoice } from "@/systems/practice-host/controllers/zahlung.controller";
import { errorMessage, formatDate } from "@/lib/utils";
import { loadClientSettings } from "@/lib/client-settings";
import { suggestSimilarTitles } from "@/lib/string-suggest";
import { useT, useTParams } from "@/lib/i18n";
import type { Patient } from "../../models/types";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { MoreIcon, PlusIcon, SearchIcon, UsersIcon, XIcon, ExportIcon } from "@/lib/icons";
import { useDismissibleLayer } from "../components/ui/use-dismissible-layer";
import { buildPatientsMigrationCsv } from "@/lib/patient-csv";
import { DataExportPickerDialog } from "../components/data-export-picker-dialog";
import { ConfirmDialog, Dialog } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";

const SEARCH_DEBOUNCE_MS = 250;

function patientHasOpenInvoice(openPatientIds: ReadonlySet<string>, patientId: string): boolean {
    return openPatientIds.has(patientId);
}

/** Stable spread of avatar hues from full id (avoid UUID first-hex clustering). */
function avatarHueFromId(id: string): number {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    return Math.abs(h >>> 0) % 360;
}

type PatientStatusFilter = "ALLE" | "IN_BEHANDLUNG" | "NEUPATIENT" | "RECHNUNG_OFFEN" | "AKTE_OFFEN" | "ABGESCHLOSSEN";

function buildFilterCounts(
    patienten: Patient[],
    openPatientIds: ReadonlySet<string>,
): Record<PatientStatusFilter, number> {
    const hasOpen = (pid: string) => openPatientIds.has(pid);
    let inBehandlung = 0;
    let neupatient = 0;
    let rechnungOffen = 0;
    let akteOffen = 0;
    let abgeschlossen = 0;
    for (const p of patienten) {
        const inv = hasOpen(p.id);
        if ((p.status === "AKTIV" || p.status === "VALIDIERT") && !inv) inBehandlung += 1;
        if (p.status === "NEU") neupatient += 1;
        if (inv) rechnungOffen += 1;
        if (p.status === "NEU" && !inv) akteOffen += 1;
        if (p.status === "VALIDIERT" || p.status === "READONLY") abgeschlossen += 1;
    }
    return {
        ALLE: patienten.length,
        IN_BEHANDLUNG: inBehandlung,
        NEUPATIENT: neupatient,
        RECHNUNG_OFFEN: rechnungOffen,
        AKTE_OFFEN: akteOffen,
        ABGESCHLOSSEN: abgeschlossen,
    };
}

function patientStatusPill(p: Patient, t: (key: string) => string): { label: string; variant: "primary" | "success" | "default" | "warning" } {
    if (p.status === "NEU") return { label: t("patient.pill.neu"), variant: "primary" };
    if (p.status === "AKTIV" || p.status === "VALIDIERT") return { label: t("patient.pill.in_behandlung"), variant: "success" };
    if (p.status === "READONLY") return { label: t("patient.pill.abgeschlossen"), variant: "default" };
    return { label: p.status, variant: "default" };
}

export function PatientenPage() {
    const t = useT();
    const tp = useTParams();
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.rolle);
    const canDeletePatient = role != null && allowed("patient.write_medical", role);
    const canViewMedical = role != null && allowed("patient.read_medical", role);
    const canCreatePatient = role != null && allowed("patient.write", role);
    const [patienten, setPatienten] = useState<Patient[]>([]);
    const [nameDirectory, setNameDirectory] = useState<string[]>([]);
    /** Full directory from last unfiltered list — keeps spellcheck suggestions while searching. */
    const [allPatientNames, setAllPatientNames] = useState<string[]>([]);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<PatientStatusFilter>("ALLE");
    const [actionMenuPatientId, setActionMenuPatientId] = useState<string | null>(null);
    const [openZahlPatientIds, setOpenZahlPatientIds] = useState<ReadonlySet<string>>(() => new Set());
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deleteDoneOpen, setDeleteDoneOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [exportPickerOpen, setExportPickerOpen] = useState(false);
    const actionLayerRef = useRef<HTMLDivElement>(null);
    const searchLoadTokenRef = useRef(0);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const toast = useToastStore((s) => s.add);
    const fromTerminCreate = searchParams.get("from") === "termin-create";
    const draft = searchParams.get("draft") ?? "";
    const detailSuffix = fromTerminCreate && draft ? `?from=termin-create&draft=${encodeURIComponent(draft)}` : "";

    useDismissibleLayer({
        open: Boolean(actionMenuPatientId),
        rootRef: actionLayerRef,
        onDismiss: () => setActionMenuPatientId(null),
    });

    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(t);
    }, [search]);

    const load = useCallback(async () => {
        const token = ++searchLoadTokenRef.current;
        setLoading(true);
        setLoadError(null);
        try {
            const q = debouncedSearch.trim();
            const [data, ids] = await Promise.all([
                q
                    ? searchPatienten(q, {
                          includeVersicherungsnummer: loadClientSettings().search?.patientIncludeVersicherungsnummer !== false,
                      })
                    : listPatienten(),
                listPatientIdsOpenInvoice().catch(() => [] as string[]),
            ]);
            if (token !== searchLoadTokenRef.current) return;
            setPatienten(data);
            setOpenZahlPatientIds(new Set(ids));
            const names = data.map((p) => p.name);
            if (!q) {
                setNameDirectory(names);
                setAllPatientNames(names);
            }
        } catch (e) {
            if (token !== searchLoadTokenRef.current) return;
            setLoadError(errorMessage(e));
            setPatienten([]);
            setOpenZahlPatientIds(new Set());
        } finally {
            if (token === searchLoadTokenRef.current) setLoading(false);
        }
    }, [debouncedSearch]);

    useEffect(() => {
        void load();
    }, [load]);

    const filtered = useMemo(() => {
        return patienten.filter((p) => {
            if (statusFilter === "ALLE") return true;
            const inv = patientHasOpenInvoice(openZahlPatientIds, p.id);
            if (statusFilter === "IN_BEHANDLUNG") return (p.status === "AKTIV" || p.status === "VALIDIERT") && !inv;
            if (statusFilter === "NEUPATIENT") return p.status === "NEU";
            if (statusFilter === "RECHNUNG_OFFEN") return inv;
            if (statusFilter === "AKTE_OFFEN") return p.status === "NEU" && !inv;
            if (statusFilter === "ABGESCHLOSSEN") return p.status === "VALIDIERT" || p.status === "READONLY";
            return true;
        });
    }, [patienten, statusFilter, openZahlPatientIds]);

    const filterCounts = useMemo(
        () => buildFilterCounts(patienten, openZahlPatientIds),
        [patienten, openZahlPatientIds],
    );

    const resolvePatientExport = useCallback(() => {
        if (filtered.length === 0) return null;
        const csv = buildPatientsMigrationCsv(filtered);
        const d = new Date().toISOString().slice(0, 10);
        return {
            exportTitle: t("patient.export.title_short"),
            hint: t("patient.export.hint"),
            suggestedFilename: `medoc-patienten-${d}.csv`,
            textBody: csv,
            mime: "text/csv;charset=utf-8",
        };
    }, [filtered, t]);

    const openPatientExport = () => {
        if (filtered.length === 0) {
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
                subtitle={tp("patient.page.subtitle", { filtered: filtered.length, total: patienten.length })}
                actions={
                    canCreatePatient ? (
                        <button className="btn btn-accent" type="button" onClick={() => navigate("/patienten/neu")}>
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
                        onClick={openPatientExport}
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
                    { id: "ALLE", labelKey: "patient.filter.ALLE" },
                    { id: "IN_BEHANDLUNG", labelKey: "patient.filter.IN_BEHANDLUNG" },
                    { id: "NEUPATIENT", labelKey: "patient.filter.NEUPATIENT" },
                    { id: "RECHNUNG_OFFEN", labelKey: "patient.filter.RECHNUNG_OFFEN" },
                    { id: "AKTE_OFFEN", labelKey: "patient.filter.AKTE_OFFEN" },
                    { id: "ABGESCHLOSSEN", labelKey: "patient.filter.ABGESCHLOSSEN" },
                ].map((f) => (
                    <button key={f.id} aria-pressed={statusFilter === f.id} onClick={() => setStatusFilter(f.id as PatientStatusFilter)}>
                        {t(f.labelKey)}{" "}
                        <span className="seg__count">{filterCounts[f.id as PatientStatusFilter]}</span>
                    </button>
                ))}
            </div>

            {loading ? (
                <PageLoading label={t("patient.loading")} />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load()} />
            ) : patienten.length === 0 && !debouncedSearch.trim() ? (
                <EmptyState
                    graphic={<UsersIcon size={40} />}
                    title={t("patient.empty.title")}
                    description={t("patient.empty.description")}
                />
            ) : filtered.length === 0 ? (
                <div className="card card-pad" style={{ maxWidth: 560 }}>
                    <h3 className="page-title" style={{ fontSize: 18 }}>{t("patient.search.no_results")}</h3>
                    <p style={{ color: "var(--fg-3)", fontSize: 14, marginTop: 8 }}>
                        {debouncedSearch.trim()
                            ? tp("patient.search.query_label", { query: debouncedSearch.trim() })
                            : t("patient.search.filter_no_match")}
                    </p>
                    {nameSuggestions.length > 0 ? (
                        <p style={{ color: "var(--fg-2)", fontSize: 13, marginTop: 12 }}>
                            <span style={{ color: "var(--fg-3)" }}>{t("palette.suggest_prefix")}</span>{" "}
                            {nameSuggestions.join(" · ")}
                        </p>
                    ) : null}
                    <div className="row" style={{ gap: 8, marginTop: 18 }}>
                        <button type="button" className="btn btn-subtle" onClick={() => { setSearch(""); setStatusFilter("ALLE"); }}>
                            {t("common.reset_filters")}
                        </button>
                        {canCreatePatient ? (
                        <button type="button" className="btn btn-accent" onClick={() => navigate("/patienten/neu")}>
                            {t("patient.new")}
                        </button>
                        ) : null}
                    </div>
                </div>
            ) : (
                <div className="card patienten-table card--overflow-visible tbl-scroll">
                    <div className="patienten-grid-head">
                        <div>{t("patient.table.patient")}</div><div>{t("patient.table.birthdate")}</div><div>{t("patient.table.contact")}</div><div>{t("patient.table.status")}</div><div />
                    </div>
                    {filtered.map((p) => {
                        const hue = avatarHueFromId(p.id);
                        const pill = patientStatusPill(p, t);
                        const openInv = patientHasOpenInvoice(openZahlPatientIds, p.id);
                        return (
                            <div
                                key={p.id}
                                onClick={() => navigate(`/patienten/${p.id}${detailSuffix}`)}
                                className="patienten-grid-row"
                            >
                                <div className="row" style={{ gap: 12 }}>
                                    <div className="av" style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 80%), hsl(${hue} 60% 50%))` }}>
                                        {p.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                                    </div>
                                    <div className="col">
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                                        <div style={{ color: "var(--fg-3)", fontSize: 12 }}>{p.geschlecht === "MAENNLICH" ? t("patient.gender.MAENNLICH") : p.geschlecht === "WEIBLICH" ? t("patient.gender.WEIBLICH") : t("patient.gender.DIVERS")}</div>
                                    </div>
                                </div>
                                <div style={{ fontSize: 13 }}>{formatDate(p.geburtsdatum)}</div>
                                <div className="col" style={{ fontSize: 12.5 }}>
                                    <div>{p.telefon || "—"}</div>
                                    <div style={{ color: "var(--fg-3)" }}>{p.email || "—"}</div>
                                </div>
                                <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                                    {p.status === "NEU" ? (
                                        <span title={t("patient.status.neu.explanation")}>
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
                                        <div className="menu-surface" style={{ right: 0, top: "calc(100% + 6px)", bottom: "auto", minWidth: 220 }} role="menu">
                                            <div className="menu-list" style={{ paddingTop: 8 }}>
                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    className="menu-item"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActionMenuPatientId(null);
                                                        navigate(`/patienten/${p.id}${detailSuffix}`);
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
                                                        navigate(`/termine/neu?patient_id=${encodeURIComponent(p.id)}`);
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
                                                            navigate(`/rezepte?patient_id=${encodeURIComponent(p.id)}`);
                                                        }}
                                                    >
                                                        {t("patient.menu.prescription")}
                                                    </button>
                                                ) : null}
                                                {p.email?.trim() ? (
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
                                                {p.telefon?.trim() ? (
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        className="menu-item"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActionMenuPatientId(null);
                                                            window.location.href = `tel:${p.telefon!.replace(/\s+/g, "")}`;
                                                        }}
                                                    >
                                                        {tp("patient.menu.call", { phone: p.telefon! })}
                                                    </button>
                                                ) : null}
                                                {!p.email?.trim() && !p.telefon?.trim() ? (
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
                                                {canDeletePatient ? (
                                                    <button
                                                        type="button"
                                                        className="menu-item danger"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActionMenuPatientId(null);
                                                            setDeleteId(p.id);
                                                        }}
                                                    >
                                                        {t("patient.menu.delete")}
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
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
                title={t("patient.delete.confirm_title")}
                message={t("patient.delete.confirm_message")}
                confirmLabel={t("common.yes_delete")}
                danger
                loading={deleteBusy}
            />
            <Dialog
                open={deleteDoneOpen}
                onClose={() => setDeleteDoneOpen(false)}
                title={t("common.notice")}
                footer={<Button onClick={() => setDeleteDoneOpen(false)}>{t("common.ok")}</Button>}
            >
                <p style={{ color: "var(--fg-2)", fontSize: 14, margin: 0 }}>{t("patient.delete.done")}</p>
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
