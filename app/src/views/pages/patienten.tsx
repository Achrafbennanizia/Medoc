import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { deletePatient, listPatienten, searchPatienten } from "../../controllers/patient.controller";
import { listPatientIdsOpenInvoice } from "../../controllers/zahlung.controller";
import { errorMessage, formatDate } from "../../lib/utils";
import { loadClientSettings } from "@/lib/client-settings";
import { suggestSimilarTitles } from "@/lib/string-suggest";
import { useT } from "@/lib/i18n";
import type { Patient } from "../../models/types";
import { allowed, parseRole } from "../../lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { MoreIcon, PlusIcon, SearchIcon, UsersIcon, XIcon, ExportIcon } from "@/lib/icons";
import { useDismissibleLayer } from "../components/ui/use-dismissible-layer";
import { buildPatientsMigrationCsv } from "@/lib/patient-csv";
import { openExportPreview } from "@/models/store/export-preview-store";
import { ConfirmDialog, Dialog } from "../components/ui/dialog";
import { Button } from "../components/ui/button";

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

function patientStatusPill(p: Patient): { label: string; variant: "primary" | "success" | "default" | "warning" } {
    if (p.status === "NEU") return { label: "Neu", variant: "primary" };
    if (p.status === "AKTIV" || p.status === "VALIDIERT") return { label: "In Behandlung", variant: "success" };
    if (p.status === "READONLY") return { label: "Abgeschlossen", variant: "default" };
    return { label: p.status, variant: "default" };
}

export function PatientenPage() {
    const t = useT();
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.rolle);
    const canDeletePatient = role != null && allowed("patient.write_medical", role);
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

    const handleExportCsv = () => {
        if (filtered.length === 0) {
            toast("Keine Patienten zum Exportieren (Filter/Suche prüfen).", "info");
            return;
        }
        try {
            const csv = buildPatientsMigrationCsv(filtered);
            const d = new Date().toISOString().slice(0, 10);
            openExportPreview({
                format: "csv",
                title: "Patienten exportieren",
                hint: "Semikolon-CSV, kompatibel mit Betrieb → Patientenimport. Spaltenköpfe klicken zum Sortieren vor dem Speichern.",
                suggestedFilename: `medoc-patienten-${d}.csv`,
                textBody: csv,
            });
        } catch (e) {
            toast(`Export fehlgeschlagen: ${errorMessage(e)}`, "error");
        }
    };

    const nameSuggestions = useMemo(
        () =>
            suggestSimilarTitles(
                debouncedSearch,
                allPatientNames.length > 0 ? allPatientNames : nameDirectory,
                2,
                5,
            ),
        [debouncedSearch, nameDirectory, allPatientNames],
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <div className="page-head">
                <div>
                    <h1 className="page-title">Patientenakten</h1>
                    <div className="page-sub">
                        {filtered.length} von {patienten.length} Patienten
                    </div>
                </div>
                <button className="btn btn-accent" onClick={() => navigate("/patienten/neu")} style={{ flexShrink: 0 }}>
                    <PlusIcon />Neuer Patient
                </button>
            </div>

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
                        onClick={handleExportCsv}
                        disabled={loading || !!loadError || filtered.length === 0}
                        title="CSV im gleichen Format wie unter Betrieb → Patientenimport (Semikolon, Header mit name und geburtsdatum)."
                        aria-label="Patientenliste als CSV exportieren"
                    >
                        <ExportIcon size={14} aria-hidden /> CSV-Export
                    </button>
                </div>
            </div>

            <div id="patient-status-filters" className="seg" style={{ alignSelf: "flex-start" }}>
                {[
                    { id: "ALLE", label: "Alle" },
                    { id: "IN_BEHANDLUNG", label: "In Behandlung" },
                    { id: "NEUPATIENT", label: "Neupatienten" },
                    { id: "RECHNUNG_OFFEN", label: "Rechnung offen" },
                    { id: "AKTE_OFFEN", label: "Akte offen" },
                    { id: "ABGESCHLOSSEN", label: "Abgeschlossen" },
                ].map((f) => (
                    <button key={f.id} aria-pressed={statusFilter === f.id} onClick={() => setStatusFilter(f.id as PatientStatusFilter)}>
                        {f.label} <span style={{ color: "var(--fg-4)" }}>{filterCounts[f.id as PatientStatusFilter]}</span>
                    </button>
                ))}
            </div>

            {loading ? (
                <PageLoading label="Patienten werden geladen…" />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load()} />
            ) : patienten.length === 0 && !debouncedSearch.trim() ? (
                <EmptyState
                    graphic={<UsersIcon size={40} />}
                    title="Keine Patienten"
                    description="Legen Sie den ersten Patienten an."
                />
            ) : filtered.length === 0 ? (
                <div className="card card-pad" style={{ maxWidth: 560 }}>
                    <h3 className="page-title" style={{ fontSize: 18 }}>{t("patient.search.no_results")}</h3>
                    <p style={{ color: "var(--fg-3)", fontSize: 14, marginTop: 8 }}>
                        {debouncedSearch.trim()
                            ? `Suchanfrage: „${debouncedSearch.trim()}“`
                            : "Keine Treffer für die gewählten Filter."}
                    </p>
                    {nameSuggestions.length > 0 ? (
                        <p style={{ color: "var(--fg-2)", fontSize: 13, marginTop: 12 }}>
                            <span style={{ color: "var(--fg-3)" }}>{t("palette.suggest_prefix")}</span>{" "}
                            {nameSuggestions.join(" · ")}
                        </p>
                    ) : null}
                    <div className="row" style={{ gap: 8, marginTop: 18 }}>
                        <button type="button" className="btn btn-subtle" onClick={() => { setSearch(""); setStatusFilter("ALLE"); }}>
                            Filter zurücksetzen
                        </button>
                        <button type="button" className="btn btn-accent" onClick={() => navigate("/patienten/neu")}>
                            Neuer Patient
                        </button>
                    </div>
                </div>
            ) : (
                <div className="card patienten-table card--overflow-visible">
                    <div className="patienten-grid-head">
                        <div>Patient</div><div>Geburtsdatum</div><div>Kontakt</div><div>Status</div><div />
                    </div>
                    {filtered.map((p) => {
                        const hue = avatarHueFromId(p.id);
                        const pill = patientStatusPill(p);
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
                                        <div style={{ color: "var(--fg-3)", fontSize: 12 }}>{p.geschlecht === "MAENNLICH" ? "Männlich" : p.geschlecht === "WEIBLICH" ? "Weiblich" : "Divers"}</div>
                                    </div>
                                </div>
                                <div style={{ fontSize: 13 }}>{formatDate(p.geburtsdatum)}</div>
                                <div className="col" style={{ fontSize: 12.5 }}>
                                    <div>{p.telefon || "—"}</div>
                                    <div style={{ color: "var(--fg-3)" }}>{p.email || "—"}</div>
                                </div>
                                <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                                    <Badge variant={pill.variant}>{pill.label}</Badge>
                                    {openInv ? (
                                        <span title="Ausstehende oder teilbezahlte Zahlung">
                                            <Badge variant="warning">€ offen</Badge>
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
                                        aria-label={`Aktionen für ${p.name}`}
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
                                                    Akte öffnen
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
                                                    Termin anlegen
                                                </button>
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
                                                    Rezeptansicht
                                                </button>
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
                                                        E-Mail an {p.email}
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
                                                        Anrufen: {p.telefon}
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
                                                        Kein Kontakt hinterlegt
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
                                                        Patient löschen…
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
                title="Löschen bestätigen"
                message="Möchten Sie dieses Objekt wirklich löschen?"
                confirmLabel="Ja, löschen"
                danger
                loading={deleteBusy}
            />
            <Dialog
                open={deleteDoneOpen}
                onClose={() => setDeleteDoneOpen(false)}
                title="Hinweis"
                footer={<Button onClick={() => setDeleteDoneOpen(false)}>OK</Button>}
            >
                <p style={{ color: "var(--fg-2)", fontSize: 14, margin: 0 }}>Akte wurde gelöscht.</p>
            </Dialog>
        </div>
    );
}
