import { useCallback, useEffect, useMemo, useState, type FC, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { listZahlungen } from "@/systems/practice-host/controllers/zahlung.controller";
import { listPatienten } from "@/systems/practice-host/controllers/patient.controller";
import { listBestellungen, updateBestellungStatus } from "@/systems/practice-host/controllers/bestellung.controller";
import type { BestellStatus, Bestellung } from "@/systems/practice-host/controllers/bestellung.controller";
import { parseRole, allowed, canReadFinanzen } from "@/lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import { errorMessage, formatCurrency, formatDate } from "@/lib/utils";
import { buildFinanzenReportBundle, type FinanzTxRow } from "@/lib/report-export";
import { ReportExportToolbar } from "../components/report-export-toolbar";
import type { Zahlung, Patient, ZahlungsArt } from "../../models/types";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { FilterOptionBar } from "../components/ui/filter-option-bar";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { NAV_ICONS } from "@/lib/icons";
import { FinanzenTxDetailDrawer, finanzenTxRowKey } from "../components/finanzen-tx-detail-drawer";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";
import type { DocumentKind } from "@/lib/document-template-schema";
import { checkPraxisDocumentReadiness } from "@/lib/praxis-completeness";
import { getInvoicePraxisFromStorage } from "@/lib/invoice-leistung";
import { buildQuittungExportForZahlung, QUITTUNG_DOCUMENT_KIND } from "@/lib/quittung-export-flow";
import type { ClinicalDocumentExportBundle } from "@/lib/document-print-html";
import type { HtmlExportDocumentKind } from "@/views/components/export-picker-dialog";
import { HtmlDocumentExportPickerDialog } from "@/views/components/export-picker-dialog";
import { PraxisReadinessDialog } from "@/views/components/praxis-readiness-dialog";

const ZAHLUNG_ART_ROWS = [
    { value: "BAR", label: "Bar" },
    { value: "KARTE", label: "Karte" },
    { value: "UEBERWEISUNG", label: "Überweisung" },
    { value: "RECHNUNG", label: "Rechnung" },
] as const;

function zahlungsartLabel(art: string): string {
    const row = ZAHLUNG_ART_ROWS.find((o) => o.value === art);
    return row?.label ?? art;
}

function zahlStatusDisplay(status: string): { variant: "success" | "warning" | "default"; label: string } {
    const s = status.trim();
    if (s === "BEZAHLT") return { variant: "success", label: "Bezahlt" };
    if (s === "TEILBEZAHLT") return { variant: "warning", label: "Teilbezahlt" };
    if (s === "AUSSTEHEND") return { variant: "warning", label: "Ausstehend" };
    if (s === "STORNIERT") return { variant: "default", label: "Storniert" };
    return { variant: "default", label: s || "—" };
}

function bezugKurz(z: Zahlung): string {
    if (z.behandlung_id) return "Behandlung";
    if (z.untersuchung_id) return "Untersuchung";
    return "Direktzahlung";
}

type FinanzTxTab = "alle" | "einn" | "aus";

const FIN_TX_TAB_OPTIONS: readonly { value: FinanzTxTab; label: string }[] = [
    { value: "alle", label: "Alle" },
    { value: "einn", label: "Einnahmen" },
    { value: "aus", label: "Ausgaben" },
];

const FIN_TX_ART_OPTIONS: readonly { value: "ALLE" | ZahlungsArt; label: string }[] = [
    { value: "ALLE", label: "Alle Arten" },
    ...ZAHLUNG_ART_ROWS,
];

function finanzFilterLabel(tab: FinanzTxTab, art: "ALLE" | ZahlungsArt): string {
    const tabLabel = tab === "alle" ? "Alle Transaktionen" : tab === "einn" ? "Einnahmen" : "Ausgaben/Storni";
    const artLabel = art === "ALLE" ? "alle Zahlungsarten" : zahlungsartLabel(art);
    return `${tabLabel} · ${artLabel}`;
}

type FinanzTxRowLocal = FinanzTxRow;

function toFinanzRows(z: Zahlung[], b: Bestellung[]): FinanzTxRowLocal[] {
    return [
        ...z.map((x) => ({ kind: "zahlung" as const, z: x })),
        ...b.map((x) => ({ kind: "bestellung" as const, b: x })),
    ];
}

function rowSortTs(r: FinanzTxRowLocal): number {
    return new Date(r.kind === "zahlung" ? r.z.created_at : r.b.created_at).getTime();
}

function bestellStatusDe(s: string): { variant: "success" | "warning" | "default"; label: string } {
    if (s === "GELIEFERT") return { variant: "success", label: "Geliefert" };
    if (s === "UNTERWEGS") return { variant: "warning", label: "Unterwegs" };
    if (s === "OFFEN") return { variant: "warning", label: "Offen" };
    if (s === "STORNIERT") return { variant: "default", label: "Storniert" };
    return { variant: "default", label: s };
}

function isInCalendarMonth(iso: string, year: number, month0: number): boolean {
    const t = new Date(iso);
    return t.getFullYear() === year && t.getMonth() === month0;
}

function sumEinnahmenMtd(list: Zahlung[], year: number, month0: number): number {
    return list
        .filter((z) => isInCalendarMonth(z.created_at, year, month0))
        .filter((z) => z.status === "BEZAHLT" || z.status === "TEILBEZAHLT")
        .reduce((s, z) => s + z.betrag, 0);
}

function sumStornoMtd(list: Zahlung[], year: number, month0: number): number {
    return list
        .filter((z) => isInCalendarMonth(z.created_at, year, month0))
        .filter((z) => z.status === "STORNIERT")
        .reduce((s, z) => s + z.betrag, 0);
}

function formatPctDe(pct: number): string {
    const s = (pct >= 0 ? "+" : "") + Math.abs(pct).toFixed(1).replace(".", ",");
    return s + "%";
}

function monthOverMonthEinn(list: Zahlung[], year: number, month0: number): { current: number; prev: number; deltaPct: number | null } {
    const current = sumEinnahmenMtd(list, year, month0);
    const py = month0 === 0 ? year - 1 : year;
    const pm = month0 === 0 ? 11 : month0 - 1;
    const prev = sumEinnahmenMtd(list, py, pm);
    const deltaPct = prev > 0 ? ((current - prev) / prev) * 100 : current > 0 && prev === 0 ? 100 : null;
    return { current, prev, deltaPct };
}

function vorgangText(z: Zahlung): string {
    const b = bezugKurz(z);
    const note = (z.beschreibung ?? "").trim();
    if (note) return b === "Direktzahlung" ? note : `${b} — ${note}`;
    return b;
}

type FinanzKpiTone = "mint" | "red" | "blue" | "amber";
type KpiSubTone = "up" | "down" | "muted";

interface FinanzKpiCardProps {
    label: string;
    value: string;
    iconKey: string;
    iconBg: string;
    iconColor: string;
    tone: FinanzKpiTone;
    sub?: string;
    subTone?: KpiSubTone;
}

const FinanzKpiCard: FC<FinanzKpiCardProps> = ({ label, value, sub, subTone, iconKey, iconBg, iconColor, tone }) => {
    const Ic = NAV_ICONS[iconKey] ?? NAV_ICONS["/"];
    return (
        <div className={`finanzen-kpi finanzen-kpi--${tone}`}>
            <div className="finanzen-kpi__label">
                <span
                    style={{
                        background: iconBg,
                        color: iconColor,
                    }}
                    aria-hidden
                >
                    <Ic size={14} />
                </span>
                {label}
            </div>
            <div className="finanzen-kpi__val">{value}</div>
            {sub ? (
                <div className="finanzen-kpi__foot">
                    <span
                        className={[
                            "finanzen-kpi__delta",
                            subTone === "up"
                                ? "finanzen-kpi__delta--up"
                                : subTone === "down"
                                  ? "finanzen-kpi__delta--down"
                                  : "finanzen-kpi__delta--muted",
                        ].join(" ")}
                    >
                        {sub}
                    </span>
                </div>
            ) : null}
        </div>
    );
};

export function FinanzenPage() {
    const navigate = useNavigate();
    const role = parseRole(useAuthStore((s) => s.session?.rolle));
    const canWriteZahlung = role != null && allowed("finanzen.write", role);
    const canUpdateBestellStatus = role != null && allowed("bestellung.write", role);
    const [zahlungen, setZahlungen] = useState<Zahlung[]>([]);
    const [bestellungen, setBestellungen] = useState<Bestellung[]>([]);
    const [patienten, setPatienten] = useState<Patient[]>([]);
    const [txTab, setTxTab] = useState<FinanzTxTab>("alle");
    const [artFilter, setArtFilter] = useState<"ALLE" | ZahlungsArt>("ALLE");
    const [selectedTxKey, setSelectedTxKey] = useState<string | null>(null);
    const [statusUpdatingBestellId, setStatusUpdatingBestellId] = useState<string | null>(null);
    const [listLoading, setListLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [quittungBusyId, setQuittungBusyId] = useState<string | null>(null);
    const [praxisGuardKind, setPraxisGuardKind] = useState<DocumentKind | null>(null);
    const [htmlDocExport, setHtmlDocExport] = useState<{
        kind: HtmlExportDocumentKind;
        bundle: ClinicalDocumentExportBundle;
        suggestedBasename: string;
        exportPreviewTitle: string;
    } | null>(null);
    const toast = useToastStore((s) => s.add);

    const load = useCallback(async (opts?: { initial?: boolean }) => {
        const isInitial = opts?.initial === true;
        if (isInitial) {
            setListLoading(true);
            setLoadError(null);
        }
        try {
            const [z, p, b] = await Promise.all([listZahlungen(), listPatienten(), listBestellungen()]);
            setZahlungen(z);
            setPatienten(p);
            setBestellungen(b);
        } catch (e) {
            const msg = errorMessage(e);
            if (isInitial) {
                setLoadError(msg);
            } else {
                toast(`Aktualisieren fehlgeschlagen: ${msg}`);
            }
        } finally {
            if (isInitial) setListLoading(false);
        }
    }, [toast, setZahlungen, setBestellungen, setListLoading, setLoadError]);

    useEffect(() => {
        void load({ initial: true });
    }, [load]);

    const canReadFinanzenFlag = role != null && canReadFinanzen(role);
    const allRows = useMemo(() => toFinanzRows(zahlungen, bestellungen), [zahlungen, bestellungen]);
    const filteredRows = useMemo(() => {
        return allRows.filter((row) => {
            if (row.kind === "bestellung") {
                if (txTab === "einn") return false;
                if (artFilter !== "ALLE") return false;
                return txTab === "alle" || txTab === "aus";
            }
            const z = row.z;
            if (txTab === "einn") {
                if (z.status !== "BEZAHLT" && z.status !== "TEILBEZAHLT") return false;
            } else if (txTab === "aus") {
                if (z.status !== "STORNIERT") return false;
            }
            if (artFilter !== "ALLE" && z.zahlungsart !== artFilter) return false;
            return true;
        });
    }, [allRows, txTab, artFilter]);
    const kpiMtd = useMemo(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = d.getMonth();
        const mom = monthOverMonthEinn(zahlungen, y, m);
        const einnM = mom.current;
        const st = sumStornoMtd(zahlungen, y, m);
        const offene = zahlungen.filter((z) => z.status === "AUSSTEHEND" || z.status === "TEILBEZAHLT");
        const offeneN = offene.length;
        const offeneSum = offene.reduce((s, z) => s + z.betrag, 0);
        const gew = einnM - st;
        const prevSt = m === 0 ? sumStornoMtd(zahlungen, y - 1, 11) : sumStornoMtd(zahlungen, y, m - 1);
        const stDelta = prevSt > 0 ? ((st - prevSt) / prevSt) * 100 : st > 0 ? 100 : 0;
        return {
            einnM,
            einnDeltaPct: mom.deltaPct,
            st,
            stDeltaPct: st === 0 && prevSt === 0 ? null : stDelta,
            offeneN,
            offeneSum,
            gew,
        };
    }, [zahlungen]);
    const patientMap = useMemo(() => new Map(patienten.map((p) => [p.id, p.name])), [patienten]);
    const sortedRows = useMemo(
        () => [...filteredRows].sort((a, b) => rowSortTs(b) - rowSortTs(a)),
        [filteredRows],
    );
    const selectedRow = useMemo(
        () => sortedRows.find((r) => finanzenTxRowKey(r) === selectedTxKey) ?? null,
        [sortedRows, selectedTxKey],
    );

    useEffect(() => {
        if (selectedTxKey && !sortedRows.some((r) => finanzenTxRowKey(r) === selectedTxKey)) {
            setSelectedTxKey(null);
        }
    }, [sortedRows, selectedTxKey]);

    const buildExportBundle = useCallback(() => {
        return buildFinanzenReportBundle(
            sortedRows,
            patientMap,
            kpiMtd,
            finanzFilterLabel(txTab, artFilter),
        );
    }, [sortedRows, patientMap, kpiMtd, txTab, artFilter]);

    if (listLoading) {
        return (
            <div className="praxis-workspace-page animate-fade-in--sticky-safe">
                <WorkspacePageHeader title="Finanzen" />
                <PageLoading label="Zahlungsdaten werden geladen…" />
            </div>
        );
    }
    if (loadError) {
        return (
            <div className="praxis-workspace-page animate-fade-in--sticky-safe">
                <WorkspacePageHeader title="Finanzen" />
                <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />
            </div>
        );
    }

    const handleQuittungExport = async (z: Zahlung) => {
        const readiness = checkPraxisDocumentReadiness(getInvoicePraxisFromStorage(), QUITTUNG_DOCUMENT_KIND);
        if (!readiness.ready) {
            setPraxisGuardKind(QUITTUNG_DOCUMENT_KIND);
            return;
        }
        setQuittungBusyId(z.id);
        try {
            setHtmlDocExport(await buildQuittungExportForZahlung(z));
        } catch (e) {
            toast(`Quittung: ${errorMessage(e)}`, "error");
        } finally {
            setQuittungBusyId(null);
        }
    };

    const handleBestellStatusChange = async (b: Bestellung, status: BestellStatus) => {
        if (status === b.status) return;
        setStatusUpdatingBestellId(b.id);
        try {
            const updated = await updateBestellungStatus(b.id, status);
            setBestellungen((list) => list.map((row) => (row.id === updated.id ? updated : row)));
            toast("Bestellstatus aktualisiert");
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setStatusUpdatingBestellId(null);
        }
    };

    const dNow = new Date();
    const py = dNow.getMonth() === 0 ? dNow.getFullYear() - 1 : dNow.getFullYear();
    const pm = dNow.getMonth() === 0 ? 11 : dNow.getMonth() - 1;
    const stPrevM = sumStornoMtd(zahlungen, py, pm);
    const einnSub =
        kpiMtd.einnDeltaPct == null
            ? { s: "Kein Vormonats-Vergleich", t: "muted" as KpiSubTone }
            : {
                  s: `${kpiMtd.einnDeltaPct >= 0 ? "↑" : "↓"} ${formatPctDe(kpiMtd.einnDeltaPct)} ggü. Vormonat`,
                  t: (kpiMtd.einnDeltaPct >= 0 ? "up" : "down") as KpiSubTone,
              };
    const stDeltaNum = kpiMtd.stDeltaPct;
    const stSub =
        kpiMtd.st === 0 && stPrevM === 0
            ? { s: "Keine Storni im laufenden Monat", t: "muted" as KpiSubTone }
            : stDeltaNum == null
              ? { s: "—", t: "muted" as KpiSubTone }
              : {
                    s: `${(stDeltaNum as number) >= 0 ? "↑" : "↓"} ${formatPctDe(stDeltaNum as number)} ggü. Vormonat`,
                    t: ((stDeltaNum as number) > 0 ? "down" : "up") as KpiSubTone,
                };
    const gewSub: { s: string; t: KpiSubTone } = {
        s: "Einnahmen MTD − Storni MTD",
        t: "muted",
    };

    return (
        <div className="finanzen-page animate-fade-in--sticky-safe" style={{ gap: 0 }}>
            <div className="finanzen-page__sticky">
                <WorkspacePageHeader
                    title="Finanzen"
                    subtitle={`${new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })} · ${zahlungen.length} Zahlungen · ${bestellungen.length} Bestellungen`}
                    actions={
                        <>
                            {canReadFinanzenFlag ? (
                                <ReportExportToolbar
                                    dialogTitle="Export — Finanzen"
                                    buildBundle={buildExportBundle}
                                    defaultFormat="pdf"
                                    showImport
                                    legacyCsv={{ rows: sortedRows, patientNames: patientMap }}
                                />
                            ) : null}
                            {canReadFinanzenFlag ? (
                                <Button type="button" variant="secondary" onClick={() => navigate("/bestellungen/neu")}>
                                    + Neue Bestellung
                                </Button>
                            ) : null}
                            {canWriteZahlung ? (
                                <Button type="button" onClick={() => navigate("/finanzen/neu")}>
                                    + Neue Zahlung
                                </Button>
                            ) : null}
                        </>
                    }
                />

                <div className="finanzen-kpi-row" aria-label="Kennzahlen Monat">
                    <FinanzKpiCard
                        tone="mint"
                        label="Einnahmen MTD"
                        value={formatCurrency(kpiMtd.einnM)}
                        iconKey="/finanzen"
                        iconBg="rgba(20, 139, 76, 0.12)"
                        iconColor="#148B4C"
                        sub={einnSub.s}
                        subTone={einnSub.t}
                    />
                    <FinanzKpiCard
                        tone="red"
                        label="Storni & Abgänge (MTD)"
                        value={formatCurrency(kpiMtd.st)}
                        iconKey="/bilanz"
                        iconBg="rgba(255, 59, 48, 0.12)"
                        iconColor="var(--red)"
                        sub={stSub.s}
                        subTone={stSub.t}
                    />
                    <FinanzKpiCard
                        tone="blue"
                        label="Gewinn (MTD, netto)"
                        value={formatCurrency(kpiMtd.gew)}
                        iconKey="/statistik"
                        iconBg="var(--blue-soft)"
                        iconColor="var(--blue)"
                        sub={gewSub.s}
                        subTone={gewSub.t}
                    />
                    <FinanzKpiCard
                        tone="amber"
                        label="Offene Posten"
                        value={formatCurrency(kpiMtd.offeneSum)}
                        iconKey="Calendar"
                        iconBg="var(--yellow-soft)"
                        iconColor="#B45309"
                        sub={`${kpiMtd.offeneN} Posten`}
                        subTone="muted"
                    />
                </div>
            </div>

            <div className="finanzen-workspace finanzen-workspace--single">
            <div className="finanzen-workspace__list">
                <div className="finanzen-tx-section-head">
                    <h2 className="finanzen-tx-section-title">Transaktionen</h2>
                    <div className="finanzen-tx-section-head__meta">
                        <span className="finanzen-tx-count">{filteredRows.length} Einträge</span>
                        {txTab !== "alle" || artFilter !== "ALLE" ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setTxTab("alle");
                                    setArtFilter("ALLE");
                                }}
                            >
                                Zurücksetzen
                            </Button>
                        ) : null}
                    </div>
                </div>
                <div className="finanzen-tx-filter-strip">
                    <div className="finanzen-tx-filter-row">
                        <span className="finanzen-tx-filter-row__label">Typ</span>
                        <FilterOptionBar
                            ariaLabel="Transaktionstyp filtern"
                            value={txTab}
                            options={FIN_TX_TAB_OPTIONS}
                            onChange={setTxTab}
                            fill
                            className="finanzen-tx-filter-row__bar"
                        />
                    </div>
                    <div className="finanzen-tx-filter-row">
                        <span className="finanzen-tx-filter-row__label">Zahlungsart</span>
                        <FilterOptionBar
                            ariaLabel="Zahlungsart filtern"
                            value={artFilter}
                            options={FIN_TX_ART_OPTIONS}
                            onChange={setArtFilter}
                            fill
                            className="finanzen-tx-filter-row__bar"
                        />
                    </div>
                </div>
                {sortedRows.length === 0 ? (
                    <EmptyState
                        icon="💰"
                        title="Keine Einträge im Filter"
                        description="Filter (Transaktionstyp oder Zahlungsart) anpassen. Ausgaben umfassen Storni und Bestellungen."
                    />
                ) : (
                    <div className="card finanzen-tx-table-card tbl-data-card card--overflow-visible">
                        <div className="tbl-scroll finanzen-tx__scroll">
                            <table className="tbl tbl-finanzen-tx">
                                <colgroup>
                                    <col className="fin-tx-col-datum" />
                                    <col className="fin-tx-col-vorgang" />
                                    <col className="fin-tx-col-gegenpartei" />
                                    <col className="fin-tx-col-betrag" />
                                    <col className="fin-tx-col-status" />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th scope="col">Datum</th>
                                        <th scope="col">Vorgang</th>
                                        <th scope="col">Gegenpartei</th>
                                        <th scope="col" className="tbl-th-num">Betrag</th>
                                        <th scope="col">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedRows.map((row) => {
                                        const rowKey = finanzenTxRowKey(row);
                                        const isSelected = selectedTxKey === rowKey;
                                        const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                setSelectedTxKey(rowKey);
                                            }
                                        };
                                        if (row.kind === "bestellung") {
                                            const b = row.b;
                                            const bst = bestellStatusDe(b.status);
                                            const bBetragEur = b.gesamtbetrag;
                                            const hasBetrag = bBetragEur != null && Number.isFinite(bBetragEur);
                                            return (
                                                <tr
                                                    key={rowKey}
                                                    className={[
                                                        "fin-tx-row",
                                                        "bestellungen-row--clickable",
                                                        isSelected ? "fin-tx-row--selected" : "",
                                                    ]
                                                        .filter(Boolean)
                                                        .join(" ")}
                                                    tabIndex={0}
                                                    role="button"
                                                    aria-pressed={isSelected}
                                                    onClick={() => setSelectedTxKey(rowKey)}
                                                    onKeyDown={onRowKeyDown}
                                                >
                                                    <td className="fin-tx-td-datum">{formatDate(b.created_at)}</td>
                                                    <td className="fin-tx-td-vorgang">
                                                        <div className="finanzen-tx-v1">Neue Bestellung</div>
                                                        <div className="finanzen-tx-v2">
                                                            {b.artikel}
                                                            {b.bestellnummer ? ` · ${b.bestellnummer}` : ""}
                                                        </div>
                                                        {hasBetrag ? (
                                                            <div className="finanzen-tx-v2" style={{ color: "var(--fg-2)" }}>
                                                                {formatCurrency(bBetragEur)}
                                                                {b.menge != null && b.menge > 1 ? ` · ${b.menge}×` : ""}
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                    <td className="fin-tx-td-gegenpartei">
                                                        <span className="zahl-td-clip" title={b.lieferant}>
                                                            {b.lieferant}
                                                        </span>
                                                    </td>
                                                    <td className="tbl-td-num fin-tx-td-betrag">
                                                        <span
                                                            className="finanzen-amt finanzen-amt--out"
                                                            title={
                                                                hasBetrag
                                                                    ? "Voraussichtliche Ausgabe: Lager-Preis × Menge bei Erfassung (keine Rechnung ersetzen)"
                                                                    : "Kein Betrag hinterlegt (ältere Bestellung oder manuell ohne Lager-Preis)"
                                                            }
                                                        >
                                                            {hasBetrag ? `−${formatCurrency(bBetragEur)}` : "− offen"}
                                                        </span>
                                                    </td>
                                                    <td className="fin-tx-td-status">
                                                        <Badge variant={bst.variant}>{bst.label}</Badge>
                                                    </td>
                                                </tr>
                                            );
                                        }
                                        const z = row.z;
                                        const st = zahlStatusDisplay(z.status);
                                        const patientName = patientMap.get(z.patient_id) ?? "—";
                                        const artLabel = zahlungsartLabel(z.zahlungsart);
                                        const cur = formatCurrency(Math.abs(z.betrag));
                                        const zahlungAmt =
                                            z.status === "STORNIERT"
                                                ? { cls: "finanzen-amt--out" as const, text: `−${cur}` }
                                                : z.status === "BEZAHLT" || z.status === "TEILBEZAHLT"
                                                  ? { cls: "finanzen-amt--in" as const, text: `+${cur}` }
                                                  : { cls: "finanzen-amt--warn" as const, text: `+${cur}` };
                                        return (
                                            <tr
                                                key={rowKey}
                                                className={[
                                                    "fin-tx-row",
                                                    "bestellungen-row--clickable",
                                                    isSelected ? "fin-tx-row--selected" : "",
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ")}
                                                tabIndex={0}
                                                role="button"
                                                aria-pressed={isSelected}
                                                onClick={() => setSelectedTxKey(rowKey)}
                                                onKeyDown={onRowKeyDown}
                                            >
                                                <td className="fin-tx-td-datum">{formatDate(z.created_at)}</td>
                                                <td className="fin-tx-td-vorgang">
                                                    <div className="finanzen-tx-v1">{vorgangText(z)}</div>
                                                    <div className="finanzen-tx-v2">{artLabel}</div>
                                                </td>
                                                <td className="fin-tx-td-gegenpartei">
                                                    <span className="zahl-td-clip" title={patientName}>
                                                        {patientName}
                                                    </span>
                                                </td>
                                                <td className="tbl-td-num fin-tx-td-betrag">
                                                    <span className={["finanzen-amt", zahlungAmt.cls].join(" ")}>
                                                        {zahlungAmt.text}
                                                    </span>
                                                </td>
                                                <td className="fin-tx-td-status">
                                                    <Badge variant={st.variant}>{st.label}</Badge>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
            </div>

            {selectedRow ? (
                <FinanzenTxDetailDrawer
                    row={selectedRow}
                    patientName={
                        selectedRow.kind === "zahlung"
                            ? patientMap.get(selectedRow.z.patient_id) ?? "—"
                            : selectedRow.b.lieferant
                    }
                    onClose={() => setSelectedTxKey(null)}
                    onOpenBestellung={(id) => navigate(`/bestellungen?bestellung=${encodeURIComponent(id)}`)}
                    onOpenAkte={(patientId) => navigate(`/patienten/${patientId}#zahl`)}
                    onQuittungExport={(z) => void handleQuittungExport(z)}
                    onBestellStatusChange={handleBestellStatusChange}
                    canUpdateBestellStatus={canUpdateBestellStatus}
                    canExportQuittung={canReadFinanzenFlag}
                    quittungBusy={quittungBusyId != null}
                    statusUpdatingBestellId={statusUpdatingBestellId}
                />
            ) : null}

            <PraxisReadinessDialog
                open={praxisGuardKind != null}
                documentKind={praxisGuardKind ?? "quittung"}
                result={checkPraxisDocumentReadiness(getInvoicePraxisFromStorage(), praxisGuardKind ?? "quittung")}
                onClose={() => setPraxisGuardKind(null)}
            />
            {htmlDocExport ? (
                <HtmlDocumentExportPickerDialog
                    open
                    onClose={() => setHtmlDocExport(null)}
                    templateKind={htmlDocExport.kind}
                    exportPreviewTitle={htmlDocExport.exportPreviewTitle}
                    suggestedBasename={htmlDocExport.suggestedBasename}
                    bundle={htmlDocExport.bundle}
                />
            ) : null}

        </div>
    );
}

