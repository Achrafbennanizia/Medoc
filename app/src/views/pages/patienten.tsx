import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { deletePatient, listPatienten, searchPatienten } from "../../controllers/patient.controller";
import { listZahlungen } from "../../controllers/zahlung.controller";
import { errorMessage, formatDate } from "../../lib/utils";
import { suggestSimilarTitles } from "@/lib/string-suggest";
import { useT } from "@/lib/i18n";
import type { Patient, Zahlung } from "../../models/types";
import { allowed, parseRole } from "../../lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { FilterIcon, MoreIcon, PlusIcon, SearchIcon, XIcon } from "@/lib/icons";
import { useDismissibleLayer } from "../components/ui/use-dismissible-layer";
import { Button } from "../components/ui/button";
import { ConfirmDialog, Dialog } from "../components/ui/dialog";

const SEARCH_DEBOUNCE_MS = 250;
function patientHasOpenInvoice(zahlungen: Zahlung[], patientId: string): boolean {
    return zahlungen.some(
        (z) => z.patient_id === patientId && (z.status === "AUSSTEHEND" || z.status === "TEILBEZAHLT"),
    );
}

export function PatientenPage() {
    const t = useT();
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.rolle);
    const canDeletePatient = role != null && allowed("patient.write_medical", role);
    const [patienten, setPatienten] = useState<Patient[]>([]);
    const [nameDirectory, setNameDirectory] = useState<string[]>([]);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALLE" | "IN_BEHANDLUNG" | "NEUPATIENT" | "RECHNUNG_OFFEN" | "AKTE_OFFEN" | "ABGESCHLOSSEN">("ALLE");
    const [actionMenuPatientId, setActionMenuPatientId] = useState<string | null>(null);
    const [zahlungen, setZahlungen] = useState<Zahlung[]>([]);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deleteDoneOpen, setDeleteDoneOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const actionLayerRef = useRef<HTMLDivElement>(null);
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
        setLoading(true);
        setLoadError(null);
        try {
            const q = debouncedSearch.trim();
            const [data, z] = await Promise.all([
                q ? searchPatienten(q) : listPatienten(),
                listZahlungen().catch(() => [] as Zahlung[]),
            ]);
            setPatienten(data);
            setZahlungen(z);
            if (!q) setNameDirectory(data.map((p) => p.name));
        } catch (e) {
            setLoadError(errorMessage(e));
            setPatienten([]);
            setZahlungen([]);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch]);

    useEffect(() => {
        void load();
    }, [load]);

    const filtered = patienten.filter((p) => {
        if (statusFilter === "ALLE") return true;
        const inv = patientHasOpenInvoice(zahlungen, p.id);
        if (statusFilter === "IN_BEHANDLUNG") return (p.status === "AKTIV" || p.status === "VALIDIERT") && !inv;
        if (statusFilter === "NEUPATIENT") return p.status === "NEU";
        if (statusFilter === "RECHNUNG_OFFEN") return inv;
        if (statusFilter === "AKTE_OFFEN") return p.status === "NEU" && !inv;
        if (statusFilter === "ABGESCHLOSSEN") return p.status === "VALIDIERT" || p.status === "READONLY";
        return true;
    });

    const countBy = (key: typeof statusFilter) => {
        if (key === "ALLE") return patienten.length;
        if (key === "IN_BEHANDLUNG") {
            return patienten.filter((p) => (p.status === "AKTIV" || p.status === "VALIDIERT") && !patientHasOpenInvoice(zahlungen, p.id)).length;
        }
        if (key === "NEUPATIENT") return patienten.filter((p) => p.status === "NEU").length;
        if (key === "RECHNUNG_OFFEN") return patienten.filter((p) => patientHasOpenInvoice(zahlungen, p.id)).length;
        if (key === "AKTE_OFFEN") return patienten.filter((p) => p.status === "NEU" && !patientHasOpenInvoice(zahlungen, p.id)).length;
        if (key === "ABGESCHLOSSEN") return patienten.filter((p) => p.status === "VALIDIERT" || p.status === "READONLY").length;
        return 0;
    };

    const wireframeBadge = (p: Patient) => {
        if (patientHasOpenInvoice(zahlungen, p.id)) return { label: "Rechnung offen", variant: "warning" as const };
        if (p.status === "NEU") return { label: "Neu", variant: "primary" as const };
        if (p.status === "AKTIV" || p.status === "VALIDIERT") return { label: "In Behandlung", variant: "success" as const };
        if (p.status === "READONLY") return { label: "Abgeschlossen", variant: "default" as const };
        return { label: p.status, variant: "default" as const };
    };

    const nameSuggestions = useMemo(
        () => suggestSimilarTitles(debouncedSearch, nameDirectory, 2, 5),
        [debouncedSearch, nameDirectory],
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <div className="page-head">
                <div><h1 className="page-title">Patientenakten</h1><div className="page-sub">{filtered.length} von {patienten.length} Patienten</div></div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <div className="input" style={{ width: "min(280px, 100%)", flex: "1 1 220px" }} title={t("patient.search.placeholder")}>
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
                    <button type="button" className="btn btn-subtle" onClick={() => toast("Export: CSV/PDF-Anbindung folgt.", "info")} aria-label="Export">
                        <span aria-hidden>⎘</span> Export
                    </button>
                    <button
                        type="button"
                        className="btn btn-subtle"
                        onClick={() => document.getElementById("patient-status-filters")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    >
                        <FilterIcon />
                        Filter
                    </button>
                    <button className="btn btn-accent" onClick={() => navigate("/patienten/neu")}><PlusIcon />Neuer Patient</button>
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
                    <button key={f.id} aria-pressed={statusFilter === f.id} onClick={() => setStatusFilter(f.id as typeof statusFilter)}>
                        {f.label} <span style={{ color: "var(--fg-4)" }}>{countBy(f.id as typeof statusFilter)}</span>
                    </button>
                ))}
            </div>

            {loading ? (
                <PageLoading label="Patienten werden geladen…" />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load()} />
            ) : patienten.length === 0 && !debouncedSearch.trim() ? (
                <EmptyState icon="👥" title="Keine Patienten" description="Legen Sie den ersten Patienten an." />
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
                <div className="card patienten-table">
                    <div className="patienten-grid-head" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1.3fr 1fr 1fr 40px", padding: "12px 20px", borderBottom: "1px solid var(--line)", fontSize: 11, fontWeight: 600, color: "var(--fg-4)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        <div>Patient</div><div>Geburtsdatum</div><div>Kontakt</div><div>Letzter Termin</div><div>Status</div><div />
                    </div>
                    {filtered.map((p) => {
                        const hue = (p.id.charCodeAt(0) * 7) % 360;
                        const wb = wireframeBadge(p);
                        return (
                            <div
                                key={p.id}
                                onClick={() => navigate(`/patienten/${p.id}${detailSuffix}`)}
                                className="patienten-grid-row"
                                style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1.3fr 1fr 1fr 40px", padding: "14px 20px", borderBottom: "1px solid var(--line)", alignItems: "center", cursor: "pointer", transition: "background 120ms" }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.025)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
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
                                <div style={{ color: "var(--fg-3)", fontSize: 13 }}>
                                    {p.status === "NEU" ? "Neuzugang" : p.status === "AKTIV" ? "Heute · Kontrolle" : "vor 4 Tagen · PZR"}
                                </div>
                                <div><Badge variant={wb.variant}>{wb.label}</Badge></div>
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
                                        <div className="menu-surface" style={{ right: 0, top: "calc(100% + 6px)", bottom: "auto", minWidth: 220 }}>
                                            <div className="menu-list" style={{ paddingTop: 8 }}>
                                                <button
                                                    className="menu-item"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActionMenuPatientId(null);
                                                        navigate(`/patienten/${p.id}${detailSuffix}`);
                                                    }}
                                                >
                                                    {fromTerminCreate ? "Akte wählen" : "Akte oeffnen"}
                                                </button>
                                                <button
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
                                                    className="menu-item"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActionMenuPatientId(null);
                                                        navigate(`/rezepte?patient_id=${encodeURIComponent(p.id)}`);
                                                    }}
                                                >
                                                    Rezeptansicht
                                                </button>
                                                <button
                                                    className="menu-item"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActionMenuPatientId(null);
                                                        if (p.email) {
                                                            window.location.href = `mailto:${encodeURIComponent(p.email)}`;
                                                        } else if (p.telefon) {
                                                            window.location.href = `tel:${p.telefon.replace(/\s+/g, "")}`;
                                                        } else {
                                                            toast("Keine E-Mail oder Telefonnummer hinterlegt.", "info");
                                                        }
                                                    }}
                                                >
                                                    Kontakt aufnehmen
                                                </button>
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
