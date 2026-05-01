import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {
    getStatistikOverview,
    type StatistikOverview,
} from "../../controllers/statistik.controller";
import type { LabelValue, MonthBucket } from "../../models/types";
import { errorMessage, formatCurrency } from "../../lib/utils";
import { openExportPreview } from "../../models/store/export-preview-store";
import { Card, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { ExportIcon, NAV_ICONS } from "@/lib/icons";

type Period = "6m" | "12m";

interface Section {
    id: string;
    title: string;
    description: string;
}

const SECTIONS: Section[] = [
    { id: "sec-patienten", title: "Patientenstatistiken", description: "Demographie, Wachstum, Status." },
    { id: "sec-behandlungen", title: "Behandlungsstatistiken", description: "Leistungen und Verordnungen." },
    { id: "sec-termine", title: "Termin- & Organisationsstatistiken", description: "Auslastung, Status, Termin-Art." },
    { id: "sec-finanzen", title: "Finanz- & Bestellstatistiken", description: "Einnahmen, Zahlungsarten, Lager." },
];

/** Sidebar: Überblick + Detail-Sektionen — steuert genau ein Hauptpanel. */
const PANELS: Section[] = [
    { id: "sec-ueberblick", title: "Überblick", description: "Kennzahlen, Umsatzverlauf, Behandlungsmix, Perioden-Summen." },
    ...SECTIONS,
];

// Apple-system-inspired palette aligned with the app accent colors.
const PALETTE = [
    "#0EA07E", // accent
    "#0A84FF", // blue
    "#FF9500", // orange
    "#AF52DE", // purple
    "#30D158", // green
    "#FF3B30", // red
    "#FFCC00", // yellow
    "#5AC8FA", // light blue
];

const ACCENT_BLUE = "#0A84FF";

function formatMonth(month: string): string {
    // month = "YYYY-MM"
    const parts = month.split("-");
    if (parts.length !== 2) return month;
    const y = parts[0]!;
    const m = parts[1]!;
    const monthNames = [
        "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
        "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
    ];
    const idx = Number(m) - 1;
    if (idx < 0 || idx > 11) return month;
    const yy = y.slice(2);
    return `${monthNames[idx]} ${yy}`;
}

/** Kurzlabel nur Monat (für Umsatz-Balken). */
function formatMonthShortOnly(month: string): string {
    const parts = month.split("-");
    if (parts.length !== 2) return month;
    const m = parts[1]!;
    const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    const idx = Number(m) - 1;
    if (idx < 0 || idx > 11) return month;
    return monthNames[idx] ?? month;
}

function trim(months: MonthBucket[], period: Period): MonthBucket[] {
    if (period === "6m") return months.slice(-6);
    return months;
}

interface ChartCardProps {
    title: string;
    subtitle?: string;
    height?: number;
    hasData: boolean;
    children: React.ReactNode;
    emptyHint?: string;
}

function ChartCard({ title, subtitle, height = 240, hasData, children, emptyHint }: ChartCardProps) {
    return (
        <Card>
            <CardHeader title={title} subtitle={subtitle} />
            <div
                className="card-pad"
                style={{
                    paddingTop: 0,
                    height,
                    minHeight: height,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                }}
            >
                {hasData ? (
                    <div style={{ flex: "1 1 auto", minWidth: 0, minHeight: height }}>{children}</div>
                ) : (
                    <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "12px 0 8px" }}>
                        <div style={{ textAlign: "center", color: "var(--fg-3)", fontSize: 12.5 }}>
                            {emptyHint ?? "Keine Daten im Zeitraum"}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}

interface MonthBarProps {
    data: MonthBucket[];
    color?: string;
    /** Optional formatter for tooltip values (default toLocaleString). */
    valueFormatter?: (v: number) => string;
}

function MonthBar({ data, color = PALETTE[0], valueFormatter }: MonthBarProps) {
    const formatted = data.map((d) => ({ ...d, monthLabel: formatMonth(d.month) }));
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "#6E6E73" }} tickLine={false} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6E6E73" }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12 }}
                    formatter={(v: number) => [valueFormatter ? valueFormatter(v) : v.toLocaleString("de-DE"), "Wert"]}
                />
                <Bar dataKey="value" fill={color} radius={[6, 6, 2, 2]} maxBarSize={42} />
            </BarChart>
        </ResponsiveContainer>
    );
}

function MonthLine({ data, color = PALETTE[1] }: { data: MonthBucket[]; color?: string }) {
    const formatted = data.map((d) => ({ ...d, monthLabel: formatMonth(d.month) }));
    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "#6E6E73" }} tickLine={false} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6E6E73" }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12 }}
                    formatter={(v: number) => [v.toLocaleString("de-DE"), "Wert"]}
                />
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.4} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
            </LineChart>
        </ResponsiveContainer>
    );
}

function CategoryBar({ data, color = PALETTE[0], valueFormatter }: { data: LabelValue[]; color?: string; valueFormatter?: (v: number) => string }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6E6E73" }} tickLine={false} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} interval={0} angle={-15} dy={8} height={50} />
                <YAxis tick={{ fontSize: 11, fill: "#6E6E73" }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12 }}
                    formatter={(v: number) => [valueFormatter ? valueFormatter(v) : v.toLocaleString("de-DE"), "Wert"]}
                />
                <Bar dataKey="value" fill={color} radius={[6, 6, 2, 2]} maxBarSize={48} />
            </BarChart>
        </ResponsiveContainer>
    );
}

function PiePanel({ data }: { data: LabelValue[] }) {
    const filtered = data.filter((d) => d.value > 0);
    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12 }}
                    formatter={(v: number, _n: string, item) => {
                        const total = filtered.reduce((s, d) => s + d.value, 0);
                        const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                        return [`${v.toLocaleString("de-DE")} (${pct}%)`, item?.payload?.label ?? "Wert"];
                    }}
                />
                <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value) => <span style={{ color: "#3C3C43" }}>{value}</span>}
                />
                <Pie
                    data={filtered}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    stroke="#fff"
                    strokeWidth={2}
                >
                    {filtered.map((_, idx) => (
                        <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
                    ))}
                </Pie>
            </PieChart>
        </ResponsiveContainer>
    );
}

function terminStatusMap(rows: LabelValue[]): Record<string, number> {
    return Object.fromEntries(rows.map((r) => [r.label, r.value]));
}

function momPercent(cur: number, prev: number): number | null {
    if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) return null;
    return ((cur - prev) / prev) * 100;
}

/** KPI surface aligned with the main Dashboard (`card` + `kpi` + icon chip). */
interface StatOverviewCardProps {
    label: string;
    value: string;
    icon: string;
    accent: string;
    sub?: string;
    trend?: "positive" | "negative" | "neutral";
}

function StatOverviewCard({ label, value, icon, accent, sub, trend = "neutral" }: StatOverviewCardProps) {
    const Ic = NAV_ICONS[icon] ?? NAV_ICONS["/"];
    const subColor =
        trend === "positive" ? "#5FAF8F" : trend === "negative" ? "#E57C7C" : "var(--fg-3)";
    return (
        <div className="card kpi">
            <div className="kpi-label">
                <span
                    style={{
                        width: 22,
                        height: 22,
                        borderRadius: 7,
                        background: `${accent}20`,
                        color: accent,
                        display: "grid",
                        placeItems: "center",
                    }}
                >
                    <Ic size={13} />
                </span>
                {label}
            </div>
            <div className="kpi-val">{value}</div>
            {sub ? (
                <div className="kpi-delta">
                    <span style={{ color: subColor }}>{sub}</span>
                </div>
            ) : null}
        </div>
    );
}

function RevenueDevelopmentChart({ data }: { data: MonthBucket[] }) {
    const formatted = data.map((d) => ({
        ...d,
        short: formatMonthShortOnly(d.month),
    }));
    const n = formatted.length;
    return (
        <ResponsiveContainer width="100%" height={260}>
            <BarChart data={formatted} margin={{ top: 16, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis
                    dataKey="short"
                    tick={{ fontSize: 11, fill: "var(--fg-3)" }}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(0,0,0,0.08)" }}
                />
                <YAxis
                    tick={{ fontSize: 11, fill: "var(--fg-3)" }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    tickFormatter={(v) => (Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v))}
                />
                <Tooltip
                    cursor={{ fill: "rgba(10,132,255,0.06)" }}
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12 }}
                    formatter={(v: number) => [formatCurrency(v), "Einnahmen"]}
                    labelFormatter={(label, payload) => {
                        const m = payload?.[0]?.payload?.month as string | undefined;
                        if (m) return formatMonth(m);
                        return typeof label === "string" ? label : "";
                    }}
                />
                <Bar dataKey="value" radius={[8, 8, 3, 3]} maxBarSize={52}>
                    {formatted.map((_, i) => (
                        <Cell
                            key={i}
                            fill={i === n - 1 ? ACCENT_BLUE : "rgba(10,132,255,0.14)"}
                            stroke={i === n - 1 ? ACCENT_BLUE : ACCENT_BLUE}
                            strokeWidth={i === n - 1 ? 0 : 1.5}
                            fillOpacity={i === n - 1 ? 1 : 1}
                        />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

function TreatmentMixPanel({ data }: { data: LabelValue[] }) {
    const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
    const total = sorted.reduce((s, d) => s + d.value, 0);
    if (sorted.length === 0) {
        return (
            <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--fg-3)", fontSize: 13 }}>
                Noch keine Behandlungen nach Kategorie.
            </div>
        );
    }
    return (
        <div style={{ padding: "4px 16px 16px" }}>
            {sorted.map((row, idx) => {
                const pct = total > 0 ? Math.round((row.value / total) * 100) : 0;
                const color = PALETTE[idx % PALETTE.length];
                const last = idx === sorted.length - 1;
                return (
                    <div
                        key={row.label}
                        style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1fr) auto",
                            gap: "10px 14px",
                            alignItems: "center",
                            padding: "10px 0",
                            borderBottom: last ? undefined : "1px solid var(--line)",
                        }}
                    >
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{row.label}</div>
                        <div
                            style={{
                                fontSize: 13,
                                fontWeight: 700,
                                fontVariantNumeric: "tabular-nums",
                                color: "var(--fg-2)",
                            }}
                        >
                            {pct}%
                        </div>
                        <div
                            style={{
                                gridColumn: "1 / -1",
                                height: 8,
                                borderRadius: 6,
                                background: "rgba(0,0,0,0.06)",
                                overflow: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    width: `${pct}%`,
                                    height: "100%",
                                    borderRadius: 6,
                                    background: color,
                                    transition: "width 400ms ease",
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function StatistikPage() {
    const [period, setPeriod] = useState<Period>("6m");
    const [stats, setStats] = useState<StatistikOverview | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const [activePanel, setActivePanel] = useState<string>(PANELS[0]!.id);
    const reload = useCallback(() => setReloadToken((n) => n + 1), []);

    useEffect(() => {
        let cancelled = false;
        setLoadError(null);
        setStats(null);
        getStatistikOverview()
            .then((s) => {
                if (!cancelled) setStats(s);
            })
            .catch((e) => {
                if (!cancelled) setLoadError(errorMessage(e));
            });
        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    const trimmedPatNeu = useMemo(() => trim(stats?.patienten_neu_pro_monat ?? [], period), [period, stats]);
    const trimmedPatKum = useMemo(() => trim(stats?.patienten_kumuliert_pro_monat ?? [], period), [period, stats]);
    const trimmedTermine = useMemo(() => trim(stats?.termine_pro_monat ?? [], period), [period, stats]);
    const trimmedBeh = useMemo(() => trim(stats?.behandlungen_pro_monat ?? [], period), [period, stats]);
    const trimmedEinn = useMemo(() => trim(stats?.einnahmen_pro_monat ?? [], period), [period, stats]);
    const trimmedBest = useMemo(() => trim(stats?.bestellungen_pro_monat ?? [], period), [period, stats]);

    const dashboardMetrics = useMemo(() => {
        if (!stats) return null;
        const einn = trim(stats.einnahmen_pro_monat, period);
        const einn6 = einn.slice(-6);
        const neu = trim(stats.patienten_neu_pro_monat, period);
        const term = trim(stats.termine_pro_monat, period);
        const st = terminStatusMap(stats.termin_status);
        const abgesagt = st["Abgesagt"] ?? 0;
        const totalTer = stats.termin_status.reduce((s, x) => s + x.value, 0);
        const durch = st["Durchgeführt"] ?? 0;
        const denomAct = Math.max(1, totalTer - abgesagt);
        const auslastQuote = totalTer > 0 ? (100 * durch) / denomAct : null;
        const nEinn = einn6.length;
        const eCur = nEinn > 0 ? einn6[nEinn - 1]!.value : 0;
        const ePrev = nEinn > 1 ? einn6[nEinn - 2]!.value : 0;
        const einnMom = momPercent(eCur, ePrev);
        const nNeu = neu.length;
        const neuCur = nNeu > 0 ? neu[nNeu - 1]!.value : 0;
        const neuPrev = nNeu > 1 ? neu[nNeu - 2]!.value : 0;
        const neuDelta = neuCur - neuPrev;
        const kum = trim(stats.patienten_kumuliert_pro_monat, period);
        const nk = kum.length;
        const kCur = nk > 0 ? kum[nk - 1]!.value : 0;
        const kPrev = nk > 1 ? kum[nk - 2]!.value : 0;
        const patientMomPct = momPercent(kCur, kPrev);
        const nt = term.length;
        const tCur = nt > 0 ? term[nt - 1]!.value : 0;
        const tPrev = nt > 1 ? term[nt - 2]!.value : 0;
        const termMom = momPercent(tCur, tPrev);
        const nichtErsch = st["Nicht erschienen"] ?? 0;
        const treueDenom = durch + nichtErsch;
        const treuePct = treueDenom > 0 ? (100 * durch) / treueDenom : null;
        const beh = trim(stats.behandlungen_pro_monat, period);
        const nb = beh.length;
        const behCur = nb > 0 ? beh[nb - 1]!.value : 0;
        const behPrev = nb > 1 ? beh[nb - 2]!.value : 0;
        const behMom = momPercent(behCur, behPrev);
        return {
            einn6,
            einnMom,
            neuCur,
            neuDelta,
            patientMomPct,
            auslastQuote,
            termMom,
            treuePct,
            tCur,
            behCur,
            behMom,
        };
    }, [stats, period]);

    if (loadError) return <PageLoadError message={loadError} onRetry={reload} />;
    if (!stats) return <PageLoading />;

    const periodLabel = period === "6m" ? "Letzte 6 Monate" : "Letzte 12 Monate";
    const dash = dashboardMetrics!;

    function exportCsv() {
        if (!stats) return;
        const rows: (string | number)[][] = [["Sektion", "Kennzahl", "Wert"]];
        rows.push(["Patienten", "Gesamt", stats.patienten_gesamt]);
        rows.push(["Produkte", "Artikel unter Mindestbestand", stats.produkte_niedrig]);
        rows.push(["Finanzen", "Einnahmen Kalendermonat (laufend)", formatCurrency(stats.einnahmen_aktueller_monat)]);
        for (const m of stats.patienten_neu_pro_monat) {
            rows.push(["Patienten", `Neue Patienten ${m.month}`, m.value]);
        }
        for (const m of stats.einnahmen_pro_monat) {
            rows.push(["Finanzen", `Einnahmen ${m.month}`, m.value]);
        }
        for (const m of stats.termine_pro_monat) {
            rows.push(["Termine", `Termine ${m.month}`, m.value]);
        }
        for (const m of stats.behandlungen_pro_monat) {
            rows.push(["Behandlungen", `Behandlungen ${m.month}`, m.value]);
        }
        for (const m of stats.bestellungen_pro_monat) {
            rows.push(["Bestellungen", `Bestellungen ${m.month}`, m.value]);
        }
        for (const v of stats.altersgruppen) rows.push(["Patienten", `Altersgruppe ${v.label}`, v.value]);
        for (const v of stats.geschlechter) rows.push(["Patienten", `Geschlecht ${v.label}`, v.value]);
        for (const v of stats.behandlungen_nach_kategorie) rows.push(["Behandlungen", `Kategorie ${v.label}`, v.value]);
        for (const v of stats.medikamente_top) rows.push(["Behandlungen", `Top-Wirkstoff ${v.label}`, v.value]);
        for (const v of stats.termin_status) rows.push(["Termine", `Status ${v.label}`, v.value]);
        for (const v of stats.termin_art) rows.push(["Termine", `Art ${v.label}`, v.value]);
        for (const v of stats.umsatz_nach_zahlungsart) rows.push(["Finanzen", `Zahlungsart ${v.label}`, v.value]);
        for (const v of stats.bestellungen_nach_status) rows.push(["Bestellungen", `Status ${v.label}`, v.value]);

        const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
        const csvBody = `\uFEFF${csv}`;
        openExportPreview({
            format: "csv",
            title: "Statistik exportieren",
            hint: `Auswertung ${periodLabel} · Semikolon-getrennt. Spaltenköpfe zum Sortieren.`,
            suggestedFilename: `medoc-statistik-${period}-${new Date().toISOString().slice(0, 10)}.csv`,
            textBody: csvBody,
        });
    }

    const lastEinnMonth = dash.einn6.length > 0 ? dash.einn6[dash.einn6.length - 1]! : null;
    const einnBadge =
        dash.einnMom != null && Number.isFinite(dash.einnMom)
            ? `${dash.einnMom >= 0 ? "+" : ""}${dash.einnMom.toFixed(1).replace(".", ",")}% ggü. Vormonat`
            : null;
    const patientDeltaPct =
        dash.patientMomPct != null && Number.isFinite(dash.patientMomPct)
            ? `${dash.patientMomPct >= 0 ? "+" : ""}${dash.patientMomPct.toFixed(1).replace(".", ",")}% ggü. Vormonat (Bestand)`
            : "Kein Vorperioden-Vergleich";
    const neuDeltaStr =
        trim(stats.patienten_neu_pro_monat, period).length > 1
            ? `${dash.neuDelta >= 0 ? "+" : ""}${Math.round(dash.neuDelta)} ggü. Vormonat`
            : undefined;
    const auslastDeltaStr =
        dash.termMom != null && Number.isFinite(dash.termMom)
            ? `${dash.termMom >= 0 ? "+" : ""}${dash.termMom.toFixed(1).replace(".", ",")}% Termine ggü. Vormonat`
            : undefined;

    return (
        <div className="animate-fade-in--sticky-safe" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <header className="page-head" style={{ alignItems: "flex-start" }}>
                <div>
                    <h2 className="page-title">Statistiken</h2>
                    <p className="page-sub" style={{ maxWidth: 640, margin: "6px 0 0" }}>
                        Überblick und Detailauswertungen aus der Praxis-Datenbank.
                        Zeitraum: <b>{periodLabel}</b>.
                    </p>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <div className="seg" role="group" aria-label="Zeitraum">
                        <button type="button" aria-pressed={period === "6m"} onClick={() => setPeriod("6m")}>6 Monate</button>
                        <button type="button" aria-pressed={period === "12m"} onClick={() => setPeriod("12m")}>12 Monate</button>
                    </div>
                    <Button type="button" variant="ghost" onClick={reload} title="Daten neu laden">
                        Aktualisieren
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => void exportCsv()}>
                        <ExportIcon size={14} /> CSV-Export
                    </Button>
                </div>
            </header>

            <div className="statistik-workspace">
                <nav
                    className="statistik-workspace__nav"
                    role="tablist"
                    aria-label="Statistik: Überblick und Detailauswertungen"
                >
                    {PANELS.map((p) => {
                        const isActive = activePanel === p.id;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                role="tab"
                                id={`statistik-tab-${p.id}`}
                                aria-selected={isActive}
                                className={["statistik-nav__item", isActive ? "statistik-nav__item--active" : ""]
                                    .filter(Boolean)
                                    .join(" ")}
                                onClick={() => setActivePanel(p.id)}
                            >
                                <span className="statistik-nav__title">{p.title}</span>
                                <span className="statistik-nav__desc">{p.description}</span>
                            </button>
                        );
                    })}
                </nav>

                <div
                    id="statistik-main-panel"
                    role="tabpanel"
                    aria-labelledby={`statistik-tab-${activePanel}`}
                    className="statistik-workspace__main"
                >
                    {activePanel === "sec-ueberblick" ? (
                        <>
                            <h2 className="statistik-workspace__panel-title">Überblick</h2>
                            <p className="statistik-workspace__panel-intro">
                                Kennzahlen, Umsatzverlauf und Perioden-Summen für <b>{periodLabel}</b>.
                            </p>
                <div
                    className="dashboard-kpis"
                    style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}
                >
                    <StatOverviewCard
                        label="Patienten gesamt"
                        value={stats.patienten_gesamt.toLocaleString("de-DE")}
                        icon="Users"
                        accent="#0EA07E"
                        sub={patientDeltaPct}
                        trend={
                            dash.patientMomPct != null && dash.patientMomPct > 0
                                ? "positive"
                                : dash.patientMomPct != null && dash.patientMomPct < 0
                                    ? "negative"
                                    : "neutral"
                        }
                    />
                    <StatOverviewCard
                        label="Neupatienten (letzter Monat im Chart)"
                        value={Math.round(dash.neuCur).toLocaleString("de-DE")}
                        icon="Sparkle"
                        accent="#FF9500"
                        sub={neuDeltaStr}
                        trend={dash.neuDelta > 0 ? "positive" : dash.neuDelta < 0 ? "negative" : "neutral"}
                    />
                    <StatOverviewCard
                        label={
                            lastEinnMonth
                                ? `Umsatz ${formatMonth(lastEinnMonth.month)}`
                                : "Umsatz (bezahlt)"
                        }
                        value={lastEinnMonth ? formatCurrency(lastEinnMonth.value) : "—"}
                        icon="Wallet"
                        accent="#0A84FF"
                        sub={
                            einnBadge
                                ? einnBadge
                                : "Vergleich nur bei mindestens zwei Monaten mit Umsatz"
                        }
                        trend={
                            dash.einnMom != null && dash.einnMom > 0
                                ? "positive"
                                : dash.einnMom != null && dash.einnMom < 0
                                    ? "negative"
                                    : "neutral"
                        }
                    />
                    <StatOverviewCard
                        label="Auslastung (Durchgeführt / aktiv)"
                        value={dash.auslastQuote != null ? `${Math.round(dash.auslastQuote)} %` : "—"}
                        icon="Calendar"
                        accent="#AF52DE"
                        sub={auslastDeltaStr ?? "Termintreue siehe unten"}
                        trend={
                            dash.termMom != null && dash.termMom > 0
                                ? "positive"
                                : dash.termMom != null && dash.termMom < 0
                                    ? "negative"
                                    : "neutral"
                        }
                    />
                </div>

                <p className="page-sub" style={{ margin: 0, fontSize: 12.5 }}>
                    Kalendermonat bis heute (bezahlt): <b>{formatCurrency(stats.einnahmen_aktueller_monat)}</b>
                    {" "}
                    <span style={{ color: "var(--fg-4)" }}>
                        Hinweis: kann vom letzten Monatsbalken abweichen, solange der Monat noch läuft.
                    </span>
                </p>

                <div className="statistik-overview-charts">
                    <Card>
                        <CardHeader
                            title="Umsatzentwicklung"
                            subtitle={`Bezahlte Zahlungen: jeweils die letzten 6 Monate innerhalb von ${periodLabel.toLowerCase()}.`}
                            action={einnBadge ? <span className="pill blue">{einnBadge}</span> : undefined}
                        />
                        {dash.einn6.some((m) => m.value > 0) ? (
                            <div className="card-pad" style={{ paddingTop: 0 }}>
                                <RevenueDevelopmentChart data={dash.einn6} />
                            </div>
                        ) : (
                            <div
                                className="card-pad"
                                style={{
                                    paddingTop: 0,
                                    height: 200,
                                    display: "grid",
                                    placeItems: "center",
                                    color: "var(--fg-3)",
                                    fontSize: 13,
                                }}
                            >
                                Noch keine Einnahmen im gewählten Zeitraum.
                            </div>
                        )}
                    </Card>
                    <Card>
                        <CardHeader title="Behandlungsmix" subtitle="Anteil nach Kategorie (Top 6)" />
                        <TreatmentMixPanel data={stats.behandlungen_nach_kategorie} />
                    </Card>
                </div>

                <div
                    className="dashboard-kpis"
                    style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 16 }}
                >
                    <StatOverviewCard
                        label="Termine (letzter Monat)"
                        value={Math.round(dash.tCur).toLocaleString("de-DE")}
                        icon="Calendar"
                        accent="#0A84FF"
                        sub={
                            dash.termMom != null && Number.isFinite(dash.termMom)
                                ? `${dash.termMom >= 0 ? "+" : ""}${dash.termMom.toFixed(1).replace(".", ",")}% ggü. Vormonat`
                                : undefined
                        }
                        trend={
                            dash.termMom != null && dash.termMom > 0
                                ? "positive"
                                : dash.termMom != null && dash.termMom < 0
                                    ? "negative"
                                    : "neutral"
                        }
                    />
                    <StatOverviewCard
                        label="Termintreue"
                        value={dash.treuePct != null ? `${dash.treuePct.toFixed(0)} %` : "—"}
                        icon="Sparkle"
                        accent="#0EA07E"
                        sub={
                            dash.treuePct != null
                                ? "Durchgeführt vs. nicht erschienen"
                                : "Noch keine abgeschlossenen Termine mit Status"
                        }
                        trend="neutral"
                    />
                    <StatOverviewCard
                        label="Behandlungen (letzter Monat)"
                        value={Math.round(dash.behCur).toLocaleString("de-DE")}
                        icon="/leistungen"
                        accent="#0EA07E"
                        sub={
                            dash.behMom != null && Number.isFinite(dash.behMom)
                                ? `${dash.behMom >= 0 ? "+" : ""}${dash.behMom.toFixed(1).replace(".", ",")}% ggü. Vormonat`
                                : undefined
                        }
                        trend={
                            dash.behMom != null && dash.behMom > 0
                                ? "positive"
                                : dash.behMom != null && dash.behMom < 0
                                    ? "negative"
                                    : "neutral"
                        }
                    />
                </div>

                <div
                    className="dashboard-kpis"
                    style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 16 }}
                >
                    <StatOverviewCard
                        label={`Einnahmen (${periodLabel})`}
                        value={formatCurrency(trimmedEinn.reduce((s, m) => s + m.value, 0))}
                        icon="/finanzen"
                        accent="#0EA07E"
                        sub="Summe bezahlter Zahlungen im gewählten Zeitraum"
                        trend="neutral"
                    />
                    <StatOverviewCard
                        label={`Termine (${periodLabel})`}
                        value={trimmedTermine.reduce((s, m) => s + m.value, 0).toLocaleString("de-DE")}
                        icon="/termine"
                        accent="#0A84FF"
                        sub="Alle Termine nach Kalendermonat"
                        trend="neutral"
                    />
                    <StatOverviewCard
                        label="Niedrige Lagerstände"
                        value={stats.produkte_niedrig.toLocaleString("de-DE")}
                        icon="Package"
                        accent={stats.produkte_niedrig > 0 ? "#FF3B30" : "#FF9500"}
                        sub={stats.produkte_niedrig > 0 ? "Unter Mindestbestand — Nachbestellen prüfen" : "Keine kritischen Artikel"}
                        trend={stats.produkte_niedrig > 0 ? "negative" : "neutral"}
                    />
                    <StatOverviewCard
                        label={`Behandlungen (${periodLabel})`}
                        value={trimmedBeh.reduce((s, m) => s + m.value, 0).toLocaleString("de-DE")}
                        icon="/leistungen"
                        accent="#AF52DE"
                        sub="Nach Behandlungsdatum bzw. Erfassung"
                        trend="neutral"
                    />
                </div>
                        </>
                    ) : null}

                    {activePanel === "sec-patienten" ? (
                    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <h2 className="statistik-workspace__panel-title">Patientenstatistiken</h2>
                        <p className="statistik-workspace__panel-intro">Demographie, Wachstum, Status.</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ChartCard title="Anzahl Patienten pro Monat" subtitle="Kumulierter Stand am Monatsende" hasData={trimmedPatKum.some((m) => m.value > 0)}>
                                <MonthBar data={trimmedPatKum} color={PALETTE[2]} />
                            </ChartCard>
                            <ChartCard title="Neue Patienten pro Monat" subtitle="Patientenanlage im Zeitraum" hasData={trimmedPatNeu.some((m) => m.value > 0)}>
                                <MonthLine data={trimmedPatNeu} color={PALETTE[1]} />
                            </ChartCard>
                            <ChartCard title="Verteilung nach Altersgruppe" hasData={stats.altersgruppen.length > 0}>
                                <PiePanel data={stats.altersgruppen} />
                            </ChartCard>
                            <ChartCard title="Geschlechterverteilung" hasData={stats.geschlechter.length > 0}>
                                <PiePanel data={stats.geschlechter} />
                            </ChartCard>
                            <ChartCard title="Patienten-Status" subtitle="Aktiv, validiert, neu, archiviert" hasData={stats.patient_status.length > 0}>
                                <CategoryBar data={stats.patient_status} color={PALETTE[3]} />
                            </ChartCard>
                        </div>
                    </section>
                    ) : null}

                    {activePanel === "sec-behandlungen" ? (
                    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <h2 className="statistik-workspace__panel-title">Behandlungsstatistiken</h2>
                        <p className="statistik-workspace__panel-intro">Leistungen und Verordnungen.</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ChartCard title="Behandlungen pro Monat" hasData={trimmedBeh.some((m) => m.value > 0)}>
                                <MonthBar data={trimmedBeh} color={PALETTE[0]} />
                            </ChartCard>
                            <ChartCard title="Behandlungen nach Kategorie" hasData={stats.behandlungen_nach_kategorie.length > 0}>
                                <CategoryBar data={stats.behandlungen_nach_kategorie} color={PALETTE[2]} />
                            </ChartCard>
                            <ChartCard title="Top Wirkstoffe (Rezepte)" subtitle="Häufigste verordnete Wirkstoffe" hasData={stats.medikamente_top.length > 0}>
                                <CategoryBar data={stats.medikamente_top} color={PALETTE[3]} />
                            </ChartCard>
                            <ChartCard title="Wirkstoff-Verteilung" hasData={stats.medikamente_top.length > 0}>
                                <PiePanel data={stats.medikamente_top} />
                            </ChartCard>
                        </div>
                    </section>
                    ) : null}

                    {activePanel === "sec-termine" ? (
                    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <h2 className="statistik-workspace__panel-title">Termin- &amp; Organisationsstatistiken</h2>
                        <p className="statistik-workspace__panel-intro">Auslastung, Status, Termin-Art.</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ChartCard title="Terminauslastung pro Monat" hasData={trimmedTermine.some((m) => m.value > 0)}>
                                <MonthBar data={trimmedTermine} color={PALETTE[1]} />
                            </ChartCard>
                            <ChartCard title="Termin-Status" hasData={stats.termin_status.length > 0}>
                                <PiePanel data={stats.termin_status} />
                            </ChartCard>
                            <ChartCard title="Termin-Art" hasData={stats.termin_art.length > 0}>
                                <CategoryBar data={stats.termin_art} color={PALETTE[5]} />
                            </ChartCard>
                            <Card>
                                <div style={{ padding: 16 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600 }}>Auslastungs-Hinweis</div>
                                    <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 6, lineHeight: 1.5 }}>
                                        Wartezeiten und Sprechstundenauslastung folgen, sobald die geplanten vs. tatsächlichen Slots
                                        in der Datenbank dokumentiert werden (siehe <code>arbeitstag</code>-Erweiterung).
                                    </p>
                                </div>
                            </Card>
                        </div>
                    </section>
                    ) : null}

                    {activePanel === "sec-finanzen" ? (
                    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <h2 className="statistik-workspace__panel-title">Finanz- &amp; Bestellstatistiken</h2>
                        <p className="statistik-workspace__panel-intro">Einnahmen, Zahlungsarten, Lager.</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ChartCard title="Einnahmen pro Monat" subtitle="Bezahlte Zahlungen (€)" hasData={trimmedEinn.some((m) => m.value > 0)}>
                                <MonthBar data={trimmedEinn} color={PALETTE[4]} valueFormatter={(v) => formatCurrency(v)} />
                            </ChartCard>
                            <ChartCard title="Umsatz nach Zahlungsart" hasData={stats.umsatz_nach_zahlungsart.length > 0}>
                                <PiePanel data={stats.umsatz_nach_zahlungsart} />
                            </ChartCard>
                            <ChartCard title="Bestellungen pro Monat" hasData={trimmedBest.some((m) => m.value > 0)}>
                                <MonthBar data={trimmedBest} color={PALETTE[2]} />
                            </ChartCard>
                            <ChartCard title="Bestellungen nach Status" hasData={stats.bestellungen_nach_status.length > 0}>
                                <PiePanel data={stats.bestellungen_nach_status} />
                            </ChartCard>
                        </div>
                    </section>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
