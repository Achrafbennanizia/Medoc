import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import { useNavigate } from "react-router-dom";
import { listZahlungen } from "../../controllers/zahlung.controller";
import { listPatienten } from "../../controllers/patient.controller";
import { listBestellungen, updateBestellungStatus } from "../../controllers/bestellung.controller";
import type { BestellStatus, Bestellung } from "../../controllers/bestellung.controller";
import { parseRole, allowed } from "../../lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import { errorMessage, formatCurrency, formatDate } from "../../lib/utils";
import { openExportPreview } from "../../models/store/export-preview-store";
import type { Zahlung, Patient, ZahlungsArt } from "../../models/types";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/input";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { ExportIcon, FilterIcon, MoreIcon, NAV_ICONS } from "@/lib/icons";

const BESTELL_STATUS_OPTIONS: readonly { value: BestellStatus; label: string }[] = [
    { value: "OFFEN", label: "Offen" },
    { value: "UNTERWEGS", label: "Unterwegs" },
    { value: "GELIEFERT", label: "Geliefert" },
    { value: "STORNIERT", label: "Storniert" },
];

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

type FinanzTxRow = { kind: "zahlung"; z: Zahlung } | { kind: "bestellung"; b: Bestellung };

function toFinanzRows(z: Zahlung[], b: Bestellung[]): FinanzTxRow[] {
    return [
        ...z.map((x) => ({ kind: "zahlung" as const, z: x })),
        ...b.map((x) => ({ kind: "bestellung" as const, b: x })),
    ];
}

function rowSortTs(r: FinanzTxRow): number {
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

function statusPillToken(status: string): "ok" | "open" | "part" | "storno" {
    if (status === "BEZAHLT") return "ok";
    if (status === "AUSSTEHEND") return "open";
    if (status === "TEILBEZAHLT") return "part";
    return "storno";
}

function vorgangText(z: Zahlung): string {
    const b = bezugKurz(z);
    const note = (z.beschreibung ?? "").trim();
    if (note) return b === "Direktzahlung" ? note : `${b} — ${note}`;
    return b;
}

function escapeCsvCell(s: string): string {
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
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
    const [filterExtrasOpen, setFilterExtrasOpen] = useState(false);
    const [statusUpdatingBestellId, setStatusUpdatingBestellId] = useState<string | null>(null);
    const [listLoading, setListLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
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

    const canReadFinanzen = role != null && allowed("finanzen.read", role);
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

    const exportCsv = useCallback(() => {
        const header = ["Datum", "Typ", "Vorgang", "Gegenpartei", "Zahlungsart", "Status", "Betrag_EUR", "Notiz"];
        const lines: string[] = [header.map(escapeCsvCell).join(",")];
        for (const r of sortedRows) {
            if (r.kind === "zahlung") {
                const z = r.z;
                const row = [
                    formatDate(z.created_at),
                    "Zahlung",
                    vorgangText(z),
                    patientMap.get(z.patient_id) ?? "—",
                    zahlungsartLabel(z.zahlungsart),
                    z.status,
                    z.betrag.toFixed(2).replace(".", ","),
                    (z.beschreibung ?? "").replace(/\r?\n/g, " ").trim(),
                ];
                lines.push(row.map(escapeCsvCell).join(","));
            } else {
                const b = r.b;
                const row = [
                    formatDate(b.created_at),
                    "Bestellung",
                    `Bestellung: ${b.artikel}`,
                    b.lieferant,
                    "—",
                    b.status,
                    b.gesamtbetrag != null && Number.isFinite(b.gesamtbetrag)
                        ? b.gesamtbetrag.toFixed(2).replace(".", ",")
                        : "",
                    (b.bemerkung ?? "").replace(/\r?\n/g, " ").trim(),
                ];
                lines.push(row.map(escapeCsvCell).join(","));
            }
        }
        const csvBody = `\uFEFF${lines.join("\r\n")}`;
        openExportPreview({
            format: "csv",
            title: "Finanzen exportieren",
            hint: "Transaktionsliste (Komma, UTF-8 mit BOM für Excel). Spalten sortieren optional.",
            suggestedFilename: `medoc-finanzen-${new Date().toISOString().slice(0, 10)}.csv`,
            textBody: csvBody,
        });
    }, [sortedRows, patientMap]);

    if (listLoading) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in--sticky-safe">
                <h2 className="page-title">Finanzen</h2>
                <PageLoading label="Zahlungsdaten werden geladen…" />
            </div>
        );
    }
    if (loadError) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in--sticky-safe">
                <h2 className="page-title">Finanzen</h2>
                <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />
            </div>
        );
    }

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
                <header className="page-head" style={{ marginBottom: 0 }}>
                    <div>
                        <h2 className="page-title">Finanzen</h2>
                        <div className="page-sub">
                            {new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })} · {zahlungen.length}{" "}
                            Zahlungen · {bestellungen.length} Bestellungen
                        </div>
                    </div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap", marginLeft: "auto", justifyContent: "flex-end" }}>
                        {canReadFinanzen ? (
                            <Button type="button" variant="secondary" onClick={exportCsv}>
                                <ExportIcon size={14} /> Exportieren
                            </Button>
                        ) : null}
                        {canReadFinanzen ? (
                            <Button type="button" variant="secondary" onClick={() => navigate("/bestellungen/neu")}>
                                + Neue Bestellung
                            </Button>
                        ) : null}
                        {canWriteZahlung ? (
                            <Button type="button" onClick={() => navigate("/finanzen/neu")}>
                                + Neue Zahlung
                            </Button>
                        ) : null}
                    </div>
                </header>

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
            <div className={["finanzen-tx card card-elevated", sortedRows.length === 0 ? "finanzen-tx--empty" : ""].filter(Boolean).join(" ")}
            >
                <div className="finanzen-tx__head">
                    <h2 className="finanzen-tx__title">Transaktionen</h2>
                    <div className="finanzen-tx__tools">
                        <div className="finanzen-tx__seg">
                            <div className="seg" role="tablist" aria-label="Transaktionstyp: Alle, Einnahmen, Ausgaben">
                                {(
                                    [
                                        { id: "alle" as const, label: "Alle" },
                                        { id: "einn" as const, label: "Einnahmen" },
                                        { id: "aus" as const, label: "Ausgaben" },
                                    ] as const
                                ).map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        role="tab"
                                        aria-pressed={txTab === opt.id}
                                        onClick={() => setTxTab(opt.id)}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <span style={{ color: "var(--fg-3)", fontSize: 12, whiteSpace: "nowrap" }}>{filteredRows.length} Einträge</span>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            aria-expanded={filterExtrasOpen}
                            onClick={() => setFilterExtrasOpen((v) => !v)}
                        >
                            <FilterIcon size={14} /> Filter
                        </Button>
                    </div>
                </div>
                <div className="finanzen-tx-filters" hidden={!filterExtrasOpen} id="finanzen-art-filter">
                    <span style={{ fontSize: 12, color: "var(--fg-3)" }}>Zahlungsart</span>
                    <div className="seg" style={{ width: "100%", maxWidth: 520 }}>
                        {[{ value: "ALLE" as const, label: "Alle" }, ...ZAHLUNG_ART_ROWS].map((o) => (
                            <button
                                key={o.value}
                                type="button"
                                aria-pressed={artFilter === o.value}
                                onClick={() => setArtFilter(o.value)}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                </div>
                {sortedRows.length === 0 ? (
                    <div className="finanzen-tx__scroll" style={{ padding: "24px 18px" }}>
                        <EmptyState
                            icon="💰"
                            title="Keine Einträge im Filter"
                            description="Tab (Alle / Einnahmen / Ausgaben) oder Zahlungsart anpassen. Ausgaben umfassen Storni und Bestellungen."
                        />
                    </div>
                ) : (
                    <div className="finanzen-tx__scroll">
                        <table className="tbl tbl-finanzen-v2" style={{ width: "100%" }}>
                            <thead>
                                <tr>
                                    <th scope="col" style={{ width: "11%" }}>
                                        Datum
                                    </th>
                                    <th scope="col" style={{ width: "28%" }}>
                                        Vorgang
                                    </th>
                                    <th scope="col" style={{ width: "23%" }}>
                                        Gegenpartei
                                    </th>
                                    <th scope="col" className="finanzen-th-betrag-status" style={{ width: "24%", textAlign: "right" }}>
                                        <span className="finanzen-th-betrag-status__line">Betrag</span>
                                        <span className="finanzen-th-betrag-status__line finanzen-th-betrag-status__line--sub">Status</span>
                                    </th>
                                    <th scope="col" style={{ width: "11%", textAlign: "right" }}>
                                        Aktion
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRows.map((row) => {
                                    if (row.kind === "bestellung") {
                                        const b = row.b;
                                        const bst = bestellStatusDe(b.status);
                                        const bDot =
                                            b.status === "GELIEFERT" ? "ok" : b.status === "UNTERWEGS" ? "open" : b.status === "OFFEN" ? "open" : "storno";
                                        const bBetragEur = b.gesamtbetrag;
                                        const hasBetrag = bBetragEur != null && Number.isFinite(bBetragEur);
                                        return (
                                            <tr key={`b-${b.id}`}>
                                                <td>
                                                    <div className="finanzen-tx-v1">{formatDate(b.created_at)}</div>
                                                </td>
                                                <td>
                                                    <div className="finanzen-tx-v1">Neue Bestellung</div>
                                                    <div className="finanzen-tx-v2">
                                                        {b.artikel}
                                                        {b.bestellnummer ? ` · ${b.bestellnummer}` : ""}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="zahl-td-clip" title={b.lieferant}>
                                                        {b.lieferant}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="finanzen-amt-col">
                                                        <div
                                                            className="finanzen-amt finanzen-amt--out"
                                                            title={
                                                                hasBetrag
                                                                    ? "Voraussichtliche Ausgabe: Lager-Preis × Menge bei Erfassung (keine Rechnung ersetzen)"
                                                                    : "Kein Betrag hinterlegt (ältere Bestellung oder manuell ohne Lager-Preis)"
                                                            }
                                                        >
                                                            {hasBetrag ? `−${formatCurrency(bBetragEur)}` : "− offen"}
                                                        </div>
                                                        {canUpdateBestellStatus ? (
                                                            <div className="finanzen-zahl-status-block">
                                                                <span className="finanzen-zahl-status-hint">Bestellung</span>
                                                                <Select
                                                                    id={`bestell-status-${b.id}`}
                                                                    className="finanzen-zahl-status-select w-full min-w-0"
                                                                    aria-label={`Bestellstatus: ${b.artikel}`}
                                                                    value={b.status}
                                                                    disabled={statusUpdatingBestellId === b.id}
                                                                    onChange={(e) =>
                                                                        handleBestellStatusChange(
                                                                            b,
                                                                            e.target.value as BestellStatus,
                                                                        )
                                                                    }
                                                                    options={BESTELL_STATUS_OPTIONS.map((o) => ({
                                                                        value: o.value,
                                                                        label: o.label,
                                                                    }))}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="finanzen-pill">
                                                                <span className="finanzen-pill__dot" data-s={bDot} />
                                                                <Badge variant={bst.variant}>{bst.label}</Badge>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="finanzen-row-go">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            title="Zur Bestellung"
                                                            onClick={() => navigate(`/bestellungen/${b.id}`)}
                                                            aria-label="Bestellung öffnen"
                                                        >
                                                            <MoreIcon size={16} />
                                                        </Button>
                                                    </div>
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
                                        <tr key={z.id}>
                                            <td>
                                                <div className="finanzen-tx-v1">{formatDate(z.created_at)}</div>
                                            </td>
                                            <td>
                                                <div className="finanzen-tx-v1">{vorgangText(z)}</div>
                                                <div className="finanzen-tx-v2">{artLabel}</div>
                                            </td>
                                            <td>
                                                <div className="zahl-td-clip" title={patientName}>
                                                    {patientName}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="finanzen-amt-col">
                                                    <div className={["finanzen-amt", zahlungAmt.cls].join(" ")}>{zahlungAmt.text}</div>
                                                    <div className="finanzen-pill">
                                                        <span className="finanzen-pill__dot" data-s={statusPillToken(z.status)} />
                                                        <Badge variant={st.variant}>{st.label}</Badge>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="finanzen-row-go">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        title="Aktionen"
                                                        onClick={() => navigate(`/patienten/${z.patient_id}#zahl`)}
                                                        aria-label="Zur Patientenakte"
                                                    >
                                                        <MoreIcon size={16} />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            </div>
            </div>

        </div>
    );
}

