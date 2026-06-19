import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type { Locale as DateFnsLocale } from "date-fns";
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
} from "@/systems/practice-host/controllers/statistik.controller";
import type { LabelValue, MonthBucket } from "../../models/types";
import { errorMessage, formatCurrency } from "@/lib/utils";
import { buildStatistikReportBundle } from "@/lib/report-export";
import { ReportExportToolbar } from "../components/report-export-toolbar";
import { Card, CardHeader } from "../components/ui/card";
import { DismissibleNotice } from "../components/ui/dismissible-notice";
import { Button } from "../components/ui/button";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { NAV_ICONS } from "@/lib/icons";
import { kpiIconChrome } from "@/lib/kpi-icon-chrome";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";
import { workTimeGetStatistics, type WorkTimeStatistics } from "@/systems/practice-host/controllers/work-time.controller";
import { formatWorkMinutes } from "@/lib/work-time-ui";
import { useT, useTParams, useDateFnsLocale } from "@/lib/i18n";

type Period = "6m" | "12m";

const PANEL_IDS = [
    "sec-ueberblick",
    "sec-patienten",
    "sec-krankheitsbilder",
    "sec-behandlungen",
    "sec-termine",
    "sec-finanzen",
    "sec-arbeitszeit",
] as const;

function panelMeta(id: string): { titleKey: string; descKey: string; introKey?: string } {
    switch (id) {
        case "sec-ueberblick":
            return { titleKey: "page.statistik.section.ueberblick.title", descKey: "page.statistik.section.ueberblick.desc" };
        case "sec-patienten":
            return { titleKey: "page.statistik.section.patienten.title", descKey: "page.statistik.section.patienten.desc" };
        case "sec-krankheitsbilder":
            return {
                titleKey: "page.statistik.section.krankheitsbilder.title",
                descKey: "page.statistik.section.krankheitsbilder.desc",
                introKey: "page.statistik.section.krankheitsbilder.intro",
            };
        case "sec-behandlungen":
            return { titleKey: "page.statistik.section.behandlungen.title", descKey: "page.statistik.section.behandlungen.desc" };
        case "sec-termine":
            return { titleKey: "page.statistik.section.termine.title", descKey: "page.statistik.section.termine.desc" };
        case "sec-finanzen":
            return { titleKey: "page.statistik.section.finance.title", descKey: "page.statistik.section.finance.desc" };
        case "sec-arbeitszeit":
            return { titleKey: "page.statistik.arbeitszeit.title", descKey: "page.statistik.arbeitszeit.description" };
        default:
            return { titleKey: "page.statistik.title", descKey: "page.statistik.subtitle" };
    }
}

// Apple-system-inspired palette; erste Farbe folgt dem gewählten Theme-Akzent (`--accent`).
const PALETTE = [
    "var(--accent)",
    "#0A84FF", // blue
    "#FF9500", // orange
    "#AF52DE", // purple
    "#30D158", // green
    "#FF3B30", // red
    "#FFCC00", // yellow
    "#5AC8FA", // light blue
];

function formatMonth(month: string, locale: DateFnsLocale): string {
    const parts = month.split("-");
    if (parts.length !== 2) return month;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return month;
    return format(new Date(y, m - 1, 1), "MMM yy", { locale });
}

function formatMonthShortOnly(month: string, locale: DateFnsLocale): string {
    const parts = month.split("-");
    if (parts.length !== 2) return month;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return month;
    return format(new Date(y, m - 1, 1), "MMM", { locale });
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
    const t = useT();
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
                            {emptyHint ?? t("page.statistik.chart.empty")}
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
    const t = useT();
    const dateLocale = useDateFnsLocale();
    const formatted = data.map((d) => ({ ...d, monthLabel: formatMonth(d.month, dateLocale) }));
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "#6E6E73" }} tickLine={false} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6E6E73" }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12 }}
                    formatter={(v: number) => [valueFormatter ? valueFormatter(v) : v.toLocaleString("de-DE"), t("page.statistik.chart.value")]}
                />
                <Bar dataKey="value" fill={color} radius={[6, 6, 2, 2]} maxBarSize={42} />
            </BarChart>
        </ResponsiveContainer>
    );
}

function MonthLine({ data, color = PALETTE[1] }: { data: MonthBucket[]; color?: string }) {
    const t = useT();
    const dateLocale = useDateFnsLocale();
    const formatted = data.map((d) => ({ ...d, monthLabel: formatMonth(d.month, dateLocale) }));
    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "#6E6E73" }} tickLine={false} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6E6E73" }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12 }}
                    formatter={(v: number) => [v.toLocaleString("de-DE"), t("page.statistik.chart.value")]}
                />
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.4} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
            </LineChart>
        </ResponsiveContainer>
    );
}

function CategoryBar({ data, color = PALETTE[0], valueFormatter }: { data: LabelValue[]; color?: string; valueFormatter?: (v: number) => string }) {
    const t = useT();
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6E6E73" }} tickLine={false} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} interval={0} angle={-15} dy={8} height={50} />
                <YAxis tick={{ fontSize: 11, fill: "#6E6E73" }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12 }}
                    formatter={(v: number) => [valueFormatter ? valueFormatter(v) : v.toLocaleString("de-DE"), t("page.statistik.chart.value")]}
                />
                <Bar dataKey="value" fill={color} radius={[6, 6, 2, 2]} maxBarSize={48} />
            </BarChart>
        </ResponsiveContainer>
    );
}

function PiePanel({ data }: { data: LabelValue[] }) {
    const t = useT();
    const filtered = data.filter((d) => d.value > 0);
    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12 }}
                    formatter={(v: number, _n: string, item) => {
                        const total = filtered.reduce((s, d) => s + d.value, 0);
                        const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                        return [`${v.toLocaleString("de-DE")} (${pct}%)`, item?.payload?.label ?? t("page.statistik.chart.value")];
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
    const iconChrome = kpiIconChrome(accent);
    return (
        <div className="card kpi">
            <div className="kpi-label">
                <span
                    style={{
                        width: 22,
                        height: 22,
                        borderRadius: 7,
                        display: "grid",
                        placeItems: "center",
                        ...iconChrome,
                    }}
                >
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

function RevenueDevelopmentChart({ data }: { data: MonthBucket[] }) {
    const t = useT();
    const dateLocale = useDateFnsLocale();
    const formatted = data.map((d) => ({
        ...d,
        short: formatMonthShortOnly(d.month, dateLocale),
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
                    cursor={{ fill: "color-mix(in oklab, var(--accent) 9%, transparent)" }}
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12 }}
                    formatter={(v: number) => [formatCurrency(v), t("page.statistik.chart.revenue")]}
                    labelFormatter={(label, payload) => {
                        const m = payload?.[0]?.payload?.month as string | undefined;
                        if (m) return formatMonth(m, dateLocale);
                        return typeof label === "string" ? label : "";
                    }}
                />
                <Bar dataKey="value" radius={[8, 8, 3, 3]} maxBarSize={52}>
                    {formatted.map((_, i) => (
                        <Cell
                            key={i}
                            fill={i === n - 1 ? "var(--accent)" : "color-mix(in oklab, var(--accent) 18%, transparent)"}
                            stroke={i === n - 1 ? "var(--accent)" : "var(--accent)"}
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
    const t = useT();
    const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
    const total = sorted.reduce((s, d) => s + d.value, 0);
    if (sorted.length === 0) {
        return (
            <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--fg-3)", fontSize: 13 }}>
                {t("page.statistik.treatment_mix.empty")}
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
    const t = useT();
    const tp = useTParams();
    const dateLocale = useDateFnsLocale();
    const [period, setPeriod] = useState<Period>("6m");
    const [stats, setStats] = useState<StatistikOverview | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const [activePanel, setActivePanel] = useState<string>(PANEL_IDS[0]!);
    const [workStats, setWorkStats] = useState<WorkTimeStatistics | null>(null);
    const [workStatsError, setWorkStatsError] = useState<string | null>(null);
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

    useEffect(() => {
        if (activePanel !== "sec-arbeitszeit") return;
        let cancelled = false;
        setWorkStatsError(null);
        void workTimeGetStatistics()
            .then((s) => {
                if (!cancelled) setWorkStats(s);
            })
            .catch((e) => {
                if (!cancelled) setWorkStatsError(errorMessage(e));
            });
        return () => {
            cancelled = true;
        };
    }, [activePanel, reloadToken]);

    const trimmedPatNeu = useMemo(() => trim(stats?.patienten_neu_pro_monat ?? [], period), [period, stats]);
    const trimmedPatKum = useMemo(() => trim(stats?.patienten_kumuliert_pro_monat ?? [], period), [period, stats]);
    const trimmedTermine = useMemo(() => trim(stats?.termine_pro_monat ?? [], period), [period, stats]);
    const trimmedBeh = useMemo(() => trim(stats?.behandlungen_pro_monat ?? [], period), [period, stats]);
    const trimmedKrankheitsVerlauf = useMemo(
        () => trim(stats?.krankheitsbilder_verlauf_pro_monat ?? [], period),
        [period, stats],
    );
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

    const buildExportBundle = useCallback(() => {
        if (!stats) return null;
        return buildStatistikReportBundle(stats, period);
    }, [stats, period]);

    if (loadError) return <PageLoadError message={loadError} onRetry={reload} />;
    if (!stats) return <PageLoading />;

    const periodLabel = period === "6m" ? t("page.statistik.period.6m_long") : t("page.statistik.period.12m_long");
    const dash = dashboardMetrics!;

    const fmtMom = (pct: number | null) =>
        pct != null && Number.isFinite(pct)
            ? tp("page.statistik.kpi.mom_prev", { pct: `${pct >= 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")}%` })
            : null;

    const panelTitle = (id: string) => t(panelMeta(id).titleKey);
    const panelDescription = (id: string) => t(panelMeta(id).descKey);
    const panelIntro = (id: string) => {
        const introKey = panelMeta(id).introKey;
        return introKey ? t(introKey) : t(panelMeta(id).descKey);
    };

    const lastEinnMonth = dash.einn6.length > 0 ? dash.einn6[dash.einn6.length - 1]! : null;
    const einnBadge = fmtMom(dash.einnMom);
    const patientDeltaPct =
        dash.patientMomPct != null && Number.isFinite(dash.patientMomPct)
            ? tp("page.statistik.kpi.mom_prev_stock", { pct: `${dash.patientMomPct >= 0 ? "+" : ""}${dash.patientMomPct.toFixed(1).replace(".", ",")}%` })
            : t("page.statistik.kpi.no_prev_period");
    const neuDeltaStr =
        trim(stats.patienten_neu_pro_monat, period).length > 1
            ? tp("page.statistik.kpi.neu_delta", { delta: `${dash.neuDelta >= 0 ? "+" : ""}${Math.round(dash.neuDelta)}` })
            : undefined;
    const auslastDeltaStr =
        dash.termMom != null && Number.isFinite(dash.termMom)
            ? tp("page.statistik.kpi.term_delta", { pct: `${dash.termMom >= 0 ? "+" : ""}${dash.termMom.toFixed(1).replace(".", ",")}%` })
            : undefined;

    return (
        <div className="animate-fade-in--sticky-safe" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <WorkspacePageHeader
                title={t("page.statistik.title")}
                subtitle={
                    <>
                        {t("page.statistik.subtitle")} <b>{periodLabel}</b>.
                    </>
                }
            />

            <div className="page-toolbar" style={{ alignItems: "center" }}>
                <div
                    className="page-toolbar__filters row"
                    style={{ gap: 8, flexWrap: "wrap", marginLeft: "auto", justifyContent: "flex-end", alignItems: "center" }}
                >
                    <div className="seg" role="group" aria-label={t("page.statistik.period_aria")}>
                        <button type="button" aria-pressed={period === "6m"} onClick={() => setPeriod("6m")}>{t("page.statistik.period.6m")}</button>
                        <button type="button" aria-pressed={period === "12m"} onClick={() => setPeriod("12m")}>{t("page.statistik.period.12m")}</button>
                    </div>
                    <Button type="button" variant="ghost" onClick={reload} title={t("page.statistik.refresh_title")}>
                        {t("page.statistik.refresh")}
                    </Button>
                    <ReportExportToolbar
                        dialogTitle={t("page.statistik.export_title")}
                        buildBundle={buildExportBundle}
                        defaultFormat="pdf"
                        showImport
                    />
                </div>
            </div>

            <div className="statistik-workspace">
                <nav
                    className="statistik-workspace__nav"
                    role="tablist"
                    aria-label={t("page.statistik.nav_aria")}
                >
                    {PANEL_IDS.map((id) => {
                        const isActive = activePanel === id;
                        return (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                id={`statistik-tab-${id}`}
                                aria-selected={isActive}
                                className={["statistik-nav__item", isActive ? "statistik-nav__item--active" : ""]
                                    .filter(Boolean)
                                    .join(" ")}
                                onClick={() => setActivePanel(id)}
                            >
                                <span className="statistik-nav__title">{panelTitle(id)}</span>
                                <span className="statistik-nav__desc">{panelDescription(id)}</span>
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
                            <h2 className="statistik-workspace__panel-title">{t("page.statistik.overview.title")}</h2>
                            <p className="statistik-workspace__panel-intro">
                                {tp("page.statistik.overview.intro", { period: periodLabel })}
                            </p>
                <div
                    className="dashboard-kpis"
                    style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}
                >
                    <StatOverviewCard
                        label={t("page.statistik.kpi.patients_total")}
                        value={stats.patienten_gesamt.toLocaleString("de-DE")}
                        icon="Users"
                        accent="var(--accent)"
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
                        label={t("page.statistik.kpi.new_patients")}
                        value={Math.round(dash.neuCur).toLocaleString("de-DE")}
                        icon="Sparkle"
                        accent="#FF9500"
                        sub={neuDeltaStr}
                        trend={dash.neuDelta > 0 ? "positive" : dash.neuDelta < 0 ? "negative" : "neutral"}
                    />
                    <StatOverviewCard
                        label={
                            lastEinnMonth
                                ? tp("page.statistik.kpi.revenue_month", { month: formatMonth(lastEinnMonth.month, dateLocale) })
                                : t("page.statistik.kpi.revenue_paid")
                        }
                        value={lastEinnMonth ? formatCurrency(lastEinnMonth.value) : "—"}
                        icon="Wallet"
                        accent="#0A84FF"
                        sub={einnBadge ?? t("page.statistik.kpi.revenue_compare_min")}
                        trend={
                            dash.einnMom != null && dash.einnMom > 0
                                ? "positive"
                                : dash.einnMom != null && dash.einnMom < 0
                                    ? "negative"
                                    : "neutral"
                        }
                    />
                    <StatOverviewCard
                        label={t("page.statistik.kpi.utilization")}
                        value={dash.auslastQuote != null ? `${Math.round(dash.auslastQuote)} %` : "—"}
                        icon="Calendar"
                        accent="#AF52DE"
                        sub={auslastDeltaStr ?? t("page.statistik.kpi.utilization_sub")}
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
                    {t("page.statistik.kpi.calendar_month")} <b>{formatCurrency(stats.einnahmen_aktueller_monat)}</b>
                    {" "}
                    <span style={{ color: "var(--fg-4)" }}>
                        {t("page.statistik.kpi.calendar_month_hint")}
                    </span>
                </p>

                <div className="statistik-overview-charts">
                    <Card>
                        <CardHeader
                            title={t("page.statistik.overview.chart_revenue_title")}
                            subtitle={tp("page.statistik.overview.chart_revenue_sub", { period: periodLabel.toLowerCase() })}
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
                                {t("page.statistik.overview.no_revenue")}
                            </div>
                        )}
                    </Card>
                    <Card>
                        <CardHeader title={t("page.statistik.overview.chart_mix_title")} subtitle={t("page.statistik.overview.chart_mix_sub")} />
                        <TreatmentMixPanel data={stats.behandlungen_nach_kategorie} />
                    </Card>
                </div>

                <div
                    className="dashboard-kpis"
                    style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 16 }}
                >
                    <StatOverviewCard
                        label={t("page.statistik.kpi.appointments_last_month")}
                        value={Math.round(dash.tCur).toLocaleString("de-DE")}
                        icon="Calendar"
                        accent="#0A84FF"
                        sub={fmtMom(dash.termMom) ?? undefined}
                        trend={
                            dash.termMom != null && dash.termMom > 0
                                ? "positive"
                                : dash.termMom != null && dash.termMom < 0
                                    ? "negative"
                                    : "neutral"
                        }
                    />
                    <StatOverviewCard
                        label={t("page.statistik.kpi.punctuality")}
                        value={dash.treuePct != null ? `${dash.treuePct.toFixed(0)} %` : "—"}
                        icon="Sparkle"
                        accent="var(--accent)"
                        sub={
                            dash.treuePct != null
                                ? t("page.statistik.kpi.punctuality_sub")
                                : t("page.statistik.kpi.punctuality_empty")
                        }
                        trend="neutral"
                    />
                    <StatOverviewCard
                        label={t("page.statistik.kpi.treatments_last_month")}
                        value={Math.round(dash.behCur).toLocaleString("de-DE")}
                        icon="/leistungen"
                        accent="var(--accent)"
                        sub={fmtMom(dash.behMom) ?? undefined}
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
                        label={tp("page.statistik.kpi.revenue_sum", { period: periodLabel })}
                        value={formatCurrency(trimmedEinn.reduce((s, m) => s + m.value, 0))}
                        icon="/finanzen"
                        accent="var(--accent)"
                        sub={t("page.statistik.kpi.revenue_sum_sub")}
                        trend="neutral"
                    />
                    <StatOverviewCard
                        label={tp("page.statistik.kpi.appointments_sum", { period: periodLabel })}
                        value={trimmedTermine.reduce((s, m) => s + m.value, 0).toLocaleString("de-DE")}
                        icon="/termine"
                        accent="#0A84FF"
                        sub={t("page.statistik.kpi.appointments_sum_sub")}
                        trend="neutral"
                    />
                    <StatOverviewCard
                        label={t("page.statistik.kpi.low_stock")}
                        value={stats.produkte_niedrig.toLocaleString("de-DE")}
                        icon="Package"
                        accent={stats.produkte_niedrig > 0 ? "#FF3B30" : "#FF9500"}
                        sub={stats.produkte_niedrig > 0 ? t("page.statistik.kpi.low_stock_alert") : t("page.statistik.kpi.low_stock_ok")}
                        trend={stats.produkte_niedrig > 0 ? "negative" : "neutral"}
                    />
                    <StatOverviewCard
                        label={tp("page.statistik.kpi.treatments_sum", { period: periodLabel })}
                        value={trimmedBeh.reduce((s, m) => s + m.value, 0).toLocaleString("de-DE")}
                        icon="/leistungen"
                        accent="#AF52DE"
                        sub={t("page.statistik.kpi.treatments_sum_sub")}
                        trend="neutral"
                    />
                </div>
                        </>
                    ) : null}

                    {activePanel === "sec-patienten" ? (
                    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <h2 className="statistik-workspace__panel-title">{panelTitle("sec-patienten")}</h2>
                        <p className="statistik-workspace__panel-intro">{panelDescription("sec-patienten")}</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ChartCard title={t("page.statistik.chart.patienten_kumuliert")} subtitle={t("page.statistik.chart.patienten_kumuliert_sub")} hasData={trimmedPatKum.some((m) => m.value > 0)}>
                                <MonthBar data={trimmedPatKum} color={PALETTE[2]} />
                            </ChartCard>
                            <ChartCard title={t("page.statistik.chart.neue_patienten")} subtitle={t("page.statistik.chart.neue_patienten_sub")} hasData={trimmedPatNeu.some((m) => m.value > 0)}>
                                <MonthLine data={trimmedPatNeu} color={PALETTE[1]} />
                            </ChartCard>
                            <ChartCard title={t("page.statistik.chart.altersgruppen")} hasData={stats.altersgruppen.length > 0}>
                                <PiePanel data={stats.altersgruppen} />
                            </ChartCard>
                            <ChartCard title={t("page.statistik.chart.geschlecht")} hasData={stats.geschlechter.length > 0}>
                                <PiePanel data={stats.geschlechter} />
                            </ChartCard>
                            <ChartCard title={t("page.statistik.chart.patienten_status")} subtitle={t("page.statistik.chart.patienten_status_sub")} hasData={stats.patient_status.length > 0}>
                                <CategoryBar data={stats.patient_status} color={PALETTE[3]} />
                            </ChartCard>
                        </div>
                    </section>
                    ) : null}

                    {activePanel === "sec-krankheitsbilder" ? (
                    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <h2 className="statistik-workspace__panel-title">{panelTitle("sec-krankheitsbilder")}</h2>
                        <p className="statistik-workspace__panel-intro">{panelIntro("sec-krankheitsbilder")}</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ChartCard
                                title={t("page.statistik.chart.krankheitsbilder_top")}
                                hasData={(stats.krankheitsbilder_top ?? []).length > 0}
                                emptyHint={t("page.statistik.chart.krankheitsbilder_empty")}
                            >
                                <CategoryBar data={stats.krankheitsbilder_top ?? []} color={PALETTE[4]} />
                            </ChartCard>
                            <ChartCard
                                title={t("page.statistik.chart.krankheitsbilder_verlauf")}
                                hasData={trimmedKrankheitsVerlauf.some((m) => m.value > 0)}
                            >
                                <MonthLine data={trimmedKrankheitsVerlauf} color={PALETTE[0]} />
                            </ChartCard>
                        </div>
                    </section>
                    ) : null}

                    {activePanel === "sec-behandlungen" ? (
                    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <h2 className="statistik-workspace__panel-title">{panelTitle("sec-behandlungen")}</h2>
                        <p className="statistik-workspace__panel-intro">{panelDescription("sec-behandlungen")}</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ChartCard title={t("page.statistik.chart.behandlungen_monat")} hasData={trimmedBeh.some((m) => m.value > 0)}>
                                <MonthBar data={trimmedBeh} color={PALETTE[0]} />
                            </ChartCard>
                            <ChartCard title={t("page.statistik.chart.behandlungen_kategorie")} hasData={stats.behandlungen_nach_kategorie.length > 0}>
                                <CategoryBar data={stats.behandlungen_nach_kategorie} color={PALETTE[2]} />
                            </ChartCard>
                            <ChartCard title={t("page.statistik.chart.wirkstoff_top")} subtitle={t("page.statistik.chart.wirkstoff_top_sub")} hasData={stats.medikamente_top.length > 0}>
                                <CategoryBar data={stats.medikamente_top} color={PALETTE[3]} />
                            </ChartCard>
                            <ChartCard title={t("page.statistik.chart.wirkstoff_vert")} hasData={stats.medikamente_top.length > 0}>
                                <PiePanel data={stats.medikamente_top} />
                            </ChartCard>
                        </div>
                    </section>
                    ) : null}

                    {activePanel === "sec-termine" ? (
                    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <h2 className="statistik-workspace__panel-title">{panelTitle("sec-termine")}</h2>
                        <p className="statistik-workspace__panel-intro">{panelDescription("sec-termine")}</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ChartCard title={t("page.statistik.chart.termin_auslastung")} hasData={trimmedTermine.some((m) => m.value > 0)}>
                                <MonthBar data={trimmedTermine} color={PALETTE[1]} />
                            </ChartCard>
                            <ChartCard title={t("page.statistik.chart.termin_status")} hasData={stats.termin_status.length > 0}>
                                <PiePanel data={stats.termin_status} />
                            </ChartCard>
                            <ChartCard title={t("page.statistik.chart.termin_art")} hasData={stats.termin_art.length > 0}>
                                <CategoryBar data={stats.termin_art} color={PALETTE[5]} />
                            </ChartCard>
                            <DismissibleNotice
                                variant="info"
                                dismissKey="statistik-auslastung-hinweis"
                                title={t("page.statistik.notice.utilization_title")}
                            >
                                {t("page.statistik.notice.utilization_body")}
                            </DismissibleNotice>
                        </div>
                    </section>
                    ) : null}

                    {activePanel === "sec-finanzen" ? (
                    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <h2 className="statistik-workspace__panel-title">{panelTitle("sec-finanzen")}</h2>
                        <p className="statistik-workspace__panel-intro">{panelDescription("sec-finanzen")}</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ChartCard title={t("page.statistik.chart.einnahmen_monat")} subtitle={t("page.statistik.chart.einnahmen_monat_sub")} hasData={trimmedEinn.some((m) => m.value > 0)}>
                                <MonthBar data={trimmedEinn} color={PALETTE[4]} valueFormatter={(v) => formatCurrency(v)} />
                            </ChartCard>
                            <ChartCard title={t("page.statistik.chart.umsatz_zahlungsart")} hasData={stats.umsatz_nach_zahlungsart.length > 0}>
                                <PiePanel data={stats.umsatz_nach_zahlungsart} />
                            </ChartCard>
                            <ChartCard title={t("page.statistik.chart.bestellungen_monat")} hasData={trimmedBest.some((m) => m.value > 0)}>
                                <MonthBar data={trimmedBest} color={PALETTE[2]} />
                            </ChartCard>
                            <ChartCard title={t("page.statistik.chart.bestellungen_status")} hasData={stats.bestellungen_nach_status.length > 0}>
                                <PiePanel data={stats.bestellungen_nach_status} />
                            </ChartCard>
                        </div>
                    </section>
                    ) : null}

                    {activePanel === "sec-arbeitszeit" ? (
                    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <h2 className="statistik-workspace__panel-title">{t("page.statistik.arbeitszeit.title")}</h2>
                        <p className="statistik-workspace__panel-intro">{t("page.statistik.arbeitszeit.intro")}</p>
                        {workStatsError ? (
                            <DismissibleNotice variant="warning" dismissKey="statistik-arbeitszeit-err" title={t("page.statistik.arbeitszeit.load_failed")}>
                                {workStatsError}
                            </DismissibleNotice>
                        ) : null}
                        {workStats ? (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <Card>
                                        <CardHeader title={t("page.statistik.arbeitszeit.week_actual")} />
                                        <div className="card-pad" style={{ fontSize: 22, fontWeight: 700 }}>
                                            {formatWorkMinutes(workStats.weekMinutes)}
                                        </div>
                                    </Card>
                                    <Card>
                                        <CardHeader title={t("page.statistik.arbeitszeit.month_actual")} />
                                        <div className="card-pad" style={{ fontSize: 22, fontWeight: 700 }}>
                                            {formatWorkMinutes(workStats.monthMinutes)}
                                        </div>
                                    </Card>
                                    <Card>
                                        <CardHeader title={t("page.statistik.arbeitszeit.pause_week")} />
                                        <div className="card-pad" style={{ fontSize: 22, fontWeight: 700 }}>
                                            {formatWorkMinutes(workStats.pauseMinutesWeek)}
                                        </div>
                                    </Card>
                                </div>
                                {workStats.byPerson.length > 0 ? (
                                    <ChartCard title={t("page.statistik.arbeitszeit.chart_by_person")} hasData>
                                        <ResponsiveContainer width="100%" height={260}>
                                            <BarChart data={workStats.byPerson.map((p) => ({
                                                name: p.name,
                                                minutes: p.weekMinutes,
                                            }))}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                                <YAxis tick={{ fontSize: 11 }} />
                                                <Tooltip formatter={(v: number) => formatWorkMinutes(v)} />
                                                <Bar dataKey="minutes" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </ChartCard>
                                ) : null}
                            </>
                        ) : (
                            <PageLoading />
                        )}
                    </section>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
