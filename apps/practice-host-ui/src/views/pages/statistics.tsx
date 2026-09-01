import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import type { Locale as DateFnsLocale } from "date-fns";
import { Link } from "react-router-dom";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
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
    getStatisticsOverview,
    type StatisticsOverview,
} from "@/systems/practice-host/controllers/statistics.controller";
import type { LabelValue, MonthBucket } from "../../models/types";
import { errorMessage, formatCurrency } from "@/lib/utils";
import { buildStatisticsReportBundle } from "@/lib/report-export";
import { ReportExportToolbar } from "../components/report-export-toolbar";
import { Card, CardHeader } from "../components/ui/card";
import { DismissibleNotice } from "../components/ui/dismissible-notice";
import { Button } from "../components/ui/button";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { NAV_ICONS } from "@/lib/icons";
import { kpiIconChrome } from "@/lib/kpi-icon-chrome";
import { WorkspacePageHeader } from "../components/administration-page-header";
import {
    workTimeGetStatistics,
    type WorkTimeDaySummary,
    type WorkTimeStatistics,
    type WorkTimeTeamMemberRow,
} from "@/systems/practice-host/controllers/work-time.controller";
import { formatStaffShortName, formatWorkMinutes } from "@/lib/work-time-ui";
import { useT, useTParams, useDateFnsLocale, useIntlLocaleTag } from "@/lib/i18n";

type Period = "6m" | "12m";

const PANEL_IDS = [
    "sec-overview",
    "sec-patients",
    "sec-disease-patterns",
    "sec-treatments",
    "sec-appointments",
    "sec-finance",
    "sec-workTime",
] as const;

function panelMeta(id: string): { titleKey: string; descKey: string; introKey?: string } {
    switch (id) {
        case "sec-overview":
            return { titleKey: "page.statistics.section.overview.title", descKey: "page.statistics.section.overview.desc" };
        case "sec-patients":
            return { titleKey: "page.statistics.section.patients.title", descKey: "page.statistics.section.patients.desc" };
        case "sec-disease-patterns":
            return {
                titleKey: "page.statistics.section.disease_patterns.title",
                descKey: "page.statistics.section.disease_patterns.desc",
                introKey: "page.statistics.section.disease_patterns.intro",
            };
        case "sec-treatments":
            return { titleKey: "page.statistics.section.treatments.title", descKey: "page.statistics.section.treatments.desc" };
        case "sec-appointments":
            return { titleKey: "page.statistics.section.appointments.title", descKey: "page.statistics.section.appointments.desc" };
        case "sec-finance":
            return { titleKey: "page.statistics.section.finance.title", descKey: "page.statistics.section.finance.desc" };
        case "sec-workTime":
            return { titleKey: "page.statistics.workTime.title", descKey: "page.statistics.workTime.description" };
        default:
            return { titleKey: "page.statistics.title", descKey: "page.statistics.subtitle" };
    }
}

// Apple-system-inspired palette; first color follows selected theme accent (`--accent`).
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
                            {emptyHint ?? t("page.statistics.chart.empty")}
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
    valueFormatter?: (version: number) => string;
}

function MonthBar({ data, color = PALETTE[0], valueFormatter }: MonthBarProps) {
    const t = useT();
    const intlTag = useIntlLocaleTag();
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
                    formatter={(version: number) => [valueFormatter ? valueFormatter(version) : version.toLocaleString(intlTag), t("page.statistics.chart.value")]}
                />
                <Bar dataKey="value" fill={color} radius={[6, 6, 2, 2]} maxBarSize={42} />
            </BarChart>
        </ResponsiveContainer>
    );
}

function MonthLine({ data, color = PALETTE[1] }: { data: MonthBucket[]; color?: string }) {
    const t = useT();
    const intlTag = useIntlLocaleTag();
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
                    formatter={(version: number) => [version.toLocaleString(intlTag), t("page.statistics.chart.value")]}
                />
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.4} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
            </LineChart>
        </ResponsiveContainer>
    );
}

function CategoryBar({ data, color = PALETTE[0], valueFormatter }: { data: LabelValue[]; color?: string; valueFormatter?: (version: number) => string }) {
    const t = useT();
    const intlTag = useIntlLocaleTag();
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6E6E73" }} tickLine={false} axisLine={{ stroke: "rgba(0,0,0,0.08)" }} interval={0} angle={-15} dy={8} height={50} />
                <YAxis tick={{ fontSize: 11, fill: "#6E6E73" }} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12 }}
                    formatter={(version: number) => [valueFormatter ? valueFormatter(version) : version.toLocaleString(intlTag), t("page.statistics.chart.value")]}
                />
                <Bar dataKey="value" fill={color} radius={[6, 6, 2, 2]} maxBarSize={48} />
            </BarChart>
        </ResponsiveContainer>
    );
}

type WorkTimeBarRow = {
    staffId: string;
    name: string;
    shortName: string;
    minutes: number;
};

function WorkTimeBarTooltip({
    active,
    payload,
}: {
    active?: boolean;
    payload?: ReadonlyArray<{ payload?: WorkTimeBarRow }>;
}) {
    const t = useT();
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload;
    if (!row) return null;
    return (
        <div className="statistics-chart-tooltip">
            <div className="statistics-chart-tooltip__title">{row.name}</div>
            <div className="statistics-chart-tooltip__value">{formatWorkMinutes(row.minutes)}</div>
            <div className="statistics-chart-tooltip__meta">{t("page.statistics.workTime.week_actual")}</div>
        </div>
    );
}

function workTimeStatusLabel(status: string, t: (key: string) => string): string {
    if (status === "RUNNING") return t("page.workTime.status.active");
    if (status === "PAUSED") return t("page.workTime.status.paused");
    if (status === "AUS") return t("page.workTime.status.off");
    return status;
}

function WorkTimePersonBar({ members }: { members: WorkTimeTeamMemberRow[] }) {
    const chartData = useMemo<WorkTimeBarRow[]>(
        () =>
            [...members]
                .sort((a, b) => b.weekMinutes - a.weekMinutes || a.name.localeCompare(b.name, "de"))
                .map((p) => ({
                    staffId: p.staffId,
                    name: p.name,
                    shortName: formatStaffShortName(p.name),
                    minutes: p.weekMinutes,
                })),
        [members],
    );
    const yMax = useMemo(() => {
        const peak = Math.max(...chartData.map((d) => d.minutes), 0);
        if (peak <= 0) return 60;
        return Math.ceil(peak / 30) * 30;
    }, [chartData]);
    const barSize = chartData.length <= 3 ? 64 : chartData.length <= 6 ? 48 : 36;

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: 11, fill: "var(--fg-3)" }}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(0,0,0,0.08)" }}
                    interval={0}
                />
                <YAxis
                    tick={{ fontSize: 10, fill: "var(--fg-3)" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={48}
                    domain={[0, yMax]}
                    tickFormatter={(version) => formatWorkMinutes(version)}
                />
                <Tooltip cursor={false} content={<WorkTimeBarTooltip />} />
                <Bar dataKey="minutes" radius={[6, 6, 2, 2]} maxBarSize={barSize} minPointSize={3}>
                    <LabelList
                        dataKey="minutes"
                        position="top"
                        formatter={(version: number) => (version > 0 ? formatWorkMinutes(version) : "")}
                        style={{ fontSize: 10, fontWeight: 650, fill: "var(--fg-2)" }}
                    />
                    {chartData.map((entry, index) => (
                        <Cell
                            key={entry.staffId}
                            fill={
                                entry.minutes > 0
                                    ? PALETTE[index % PALETTE.length]
                                    : "color-mix(in oklab, var(--fg) 12%, transparent)"
                            }
                        />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

function WorkTimeDayBar({ days }: { days: WorkTimeDaySummary[] }) {
    const dateLocale = useDateFnsLocale();
    const chartData = useMemo(
        () =>
            [...days]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((d) => ({
                    ...d,
                    shortLabel: format(parseISO(d.date), "EEE", { locale: dateLocale }),
                })),
        [days, dateLocale],
    );
    const yMax = useMemo(() => {
        const peak = Math.max(...chartData.map((d) => d.workedMinutes), 0);
        if (peak <= 0) return 60;
        return Math.ceil(peak / 60) * 60;
    }, [chartData]);

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis
                    dataKey="shortLabel"
                    tick={{ fontSize: 10, fill: "var(--fg-3)" }}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(0,0,0,0.08)" }}
                    interval={0}
                />
                <YAxis
                    tick={{ fontSize: 10, fill: "var(--fg-3)" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={44}
                    domain={[0, yMax]}
                    tickFormatter={(version) => formatWorkMinutes(version)}
                />
                <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12 }}
                    formatter={(version: number, _name, item) => {
                        const row = item?.payload as WorkTimeDaySummary | undefined;
                        const pause = row?.pauseMinutes ?? 0;
                        return [
                            `${formatWorkMinutes(version)}${pause > 0 ? ` · ${formatWorkMinutes(pause)} pause` : ""}`,
                            row?.date ?? "",
                        ];
                    }}
                />
                <Bar dataKey="workedMinutes" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
        </ResponsiveContainer>
    );
}

function WorkTimeTeamTable({ members }: { members: WorkTimeTeamMemberRow[] }) {
    const t = useT();
    const rows = useMemo(
        () => [...members].sort((a, b) => b.weekMinutes - a.weekMinutes || a.name.localeCompare(b.name, "de")),
        [members],
    );
    const weekMax = useMemo(() => Math.max(...rows.map((r) => r.weekMinutes), 1), [rows]);

    return (
        <div className="statistics-work-team">
            <h3 className="statistics-work-section-title">{t("page.workTime.team.title")}</h3>
            <div className="statistics-work-team-scroll">
                <table className="statistics-work-team-table">
                    <thead>
                        <tr>
                            <th>{t("page.workTime.team.col.staff")}</th>
                            <th>{t("page.workTime.team.col.status")}</th>
                            <th>{t("page.workTime.team.col.today")}</th>
                            <th>{t("page.workTime.team.col.week")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const pct = Math.min(100, (row.weekMinutes / weekMax) * 100);
                            return (
                                <tr key={row.staffId}>
                                    <td>
                                        <span className="statistics-work-team-name">{row.name}</span>
                                    </td>
                                    <td>
                                        <span
                                            className={`statistics-work-team-status statistics-work-team-status--${row.status.toLowerCase()}`}
                                        >
                                            {workTimeStatusLabel(row.status, t)}
                                        </span>
                                    </td>
                                    <td className="statistics-work-team-num">{formatWorkMinutes(row.todayMinutes)}</td>
                                    <td>
                                        <div className="statistics-work-team-week">
                                            <span className="statistics-work-team-num">{formatWorkMinutes(row.weekMinutes)}</span>
                                            <div className="statistics-work-team-bar" aria-hidden>
                                                <div className="statistics-work-team-bar__fill" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function PiePanel({ data }: { data: LabelValue[] }) {
    const t = useT();
    const intlTag = useIntlLocaleTag();
    const filtered = data.filter((d) => d.value > 0);
    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12 }}
                    formatter={(version: number, _n: string, item) => {
                        const total = filtered.reduce((s, d) => s + d.value, 0);
                        const pct = total > 0 ? Math.round((version / total) * 100) : 0;
                        return [`${version.toLocaleString(intlTag)} (${pct}%)`, item?.payload?.label ?? t("page.statistics.chart.value")];
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

function appointmentStatusMap(rows: LabelValue[]): Record<string, number> {
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
                    tickFormatter={(version) => (Number(version) >= 1000 ? `${Math.round(Number(version) / 1000)}k` : String(version))}
                />
                <Tooltip
                    cursor={{ fill: "color-mix(in oklab, var(--accent) 9%, transparent)" }}
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12 }}
                    formatter={(version: number) => [formatCurrency(version), t("page.statistics.chart.revenue")]}
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
                {t("page.statistics.treatment_mix.empty")}
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

export function StatisticsPage() {
    const t = useT();
    const tp = useTParams();
    const intlTag = useIntlLocaleTag();
    const dateLocale = useDateFnsLocale();
    const [period, setPeriod] = useState<Period>("6m");
    const [stats, setStats] = useState<StatisticsOverview | null>(null);
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
        getStatisticsOverview()
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
        if (activePanel !== "sec-workTime") return;
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

    const trimmedPatNew = useMemo(() => trim(stats?.new_patients_per_month ?? [], period), [period, stats]);
    const trimmedPatKum = useMemo(() => trim(stats?.patients_cumulative_per_month ?? [], period), [period, stats]);
    const trimmedAppointments = useMemo(() => trim(stats?.appointments_per_month ?? [], period), [period, stats]);
    const trimmedTreatments = useMemo(() => trim(stats?.treatments_per_month ?? [], period), [period, stats]);
    const trimmedDiseasePatterns = useMemo(
        () => trim(stats?.disease_patterns_monthly ?? [], period),
        [period, stats],
    );
    const trimmedIncome = useMemo(() => trim(stats?.income_per_month ?? [], period), [period, stats]);
    const trimmedOrders = useMemo(() => trim(stats?.orders_per_month ?? [], period), [period, stats]);

    const dashboardMetrics = useMemo(() => {
        if (!stats) return null;
        const income = trim(stats.income_per_month, period);
        const income6 = income.slice(-6);
        const newPatients = trim(stats.new_patients_per_month, period);
        const appts = trim(stats.appointments_per_month, period);
        const st = appointmentStatusMap(stats.appointment_status);
        const cancelled = st["Cancelled"] ?? 0;
        const totalAppointments = stats.appointment_status.reduce((s, x) => s + x.value, 0);
        const completed = st["Completed"] ?? st["Durchgeführt"] ?? 0;
        const denomAct = Math.max(1, totalAppointments - cancelled);
        const occupancyPct = totalAppointments > 0 ? (100 * completed) / denomAct : null;
        const nIncome = income6.length;
        const eCur = nIncome > 0 ? income6[nIncome - 1]!.value : 0;
        const ePrev = nIncome > 1 ? income6[nIncome - 2]!.value : 0;
        const incomeMom = momPercent(eCur, ePrev);
        const nNew = newPatients.length;
        const newCur = nNew > 0 ? newPatients[nNew - 1]!.value : 0;
        const newPrev = nNew > 1 ? newPatients[nNew - 2]!.value : 0;
        const newDelta = newCur - newPrev;
        const kum = trim(stats.patients_cumulative_per_month, period);
        const nk = kum.length;
        const kCur = nk > 0 ? kum[nk - 1]!.value : 0;
        const kPrev = nk > 1 ? kum[nk - 2]!.value : 0;
        const patientMomPct = momPercent(kCur, kPrev);
        const nt = appts.length;
        const tCur = nt > 0 ? appts[nt - 1]!.value : 0;
        const tPrev = nt > 1 ? appts[nt - 2]!.value : 0;
        const appointmentMom = momPercent(tCur, tPrev);
        const noShow = st["No-show"] ?? st["Nicht erschienen"] ?? 0;
        const loyaltyDenom = completed + noShow;
        const loyaltyPct = loyaltyDenom > 0 ? (100 * completed) / loyaltyDenom : null;
        const treatments = trim(stats.treatments_per_month, period);
        const nb = treatments.length;
        const treatmentsCur = nb > 0 ? treatments[nb - 1]!.value : 0;
        const treatmentsPrev = nb > 1 ? treatments[nb - 2]!.value : 0;
        const treatmentsMom = momPercent(treatmentsCur, treatmentsPrev);
        return {
            income6,
            incomeMom,
            newCur,
            newDelta,
            patientMomPct,
            occupancyPct,
            appointmentMom,
            loyaltyPct,
            tCur,
            treatmentsCur,
            treatmentsMom,
        };
    }, [stats, period]);

    const buildExportBundle = useCallback(() => {
        if (!stats) return null;
        return buildStatisticsReportBundle(stats, period);
    }, [stats, period]);

    if (loadError) return <PageLoadError message={loadError} onRetry={reload} />;
    if (!stats) return <PageLoading />;

    const periodLabel = period === "6m" ? t("page.statistics.period.6m_long") : t("page.statistics.period.12m_long");
    const dash = dashboardMetrics!;

    const fmtMom = (pct: number | null) =>
        pct != null && Number.isFinite(pct)
            ? tp("page.statistics.kpi.mom_prev", { pct: `${pct >= 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")}%` })
            : null;

    const panelTitle = (id: string) => t(panelMeta(id).titleKey);
    const panelDescription = (id: string) => t(panelMeta(id).descKey);
    const panelIntro = (id: string) => {
        const introKey = panelMeta(id).introKey;
        return introKey ? t(introKey) : t(panelMeta(id).descKey);
    };

    const lastIncomeMonth = dash.income6.length > 0 ? dash.income6[dash.income6.length - 1]! : null;
    const incomeBadge = fmtMom(dash.incomeMom);
    const patientDeltaPct =
        dash.patientMomPct != null && Number.isFinite(dash.patientMomPct)
            ? tp("page.statistics.kpi.mom_prev_stock", { pct: `${dash.patientMomPct >= 0 ? "+" : ""}${dash.patientMomPct.toFixed(1).replace(".", ",")}%` })
            : t("page.statistics.kpi.no_prev_period");
    const newDeltaStr =
        trim(stats.new_patients_per_month, period).length > 1
            ? tp("page.statistics.kpi.new_delta", { delta: `${dash.newDelta >= 0 ? "+" : ""}${Math.round(dash.newDelta)}` })
            : undefined;
    const occupancyDeltaStr =
        dash.appointmentMom != null && Number.isFinite(dash.appointmentMom)
            ? tp("page.statistics.kpi.term_delta", { pct: `${dash.appointmentMom >= 0 ? "+" : ""}${dash.appointmentMom.toFixed(1).replace(".", ",")}%` })
            : undefined;

    return (
        <div className="animate-fade-in--sticky-safe" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <WorkspacePageHeader
                title={t("page.statistics.title")}
                subtitle={
                    <>
                        {t("page.statistics.subtitle")} <b>{periodLabel}</b>.
                    </>
                }
            />

            <div className="page-toolbar" style={{ alignItems: "center" }}>
                <div
                    className="page-toolbar__filters row"
                    style={{ gap: 8, flexWrap: "wrap", marginInlineStart: "auto", justifyContent: "flex-end", alignItems: "center" }}
                >
                    <div className="seg" role="group" aria-label={t("page.statistics.period_aria")}>
                        <button type="button" aria-pressed={period === "6m"} onClick={() => setPeriod("6m")}>{t("page.statistics.period.6m")}</button>
                        <button type="button" aria-pressed={period === "12m"} onClick={() => setPeriod("12m")}>{t("page.statistics.period.12m")}</button>
                    </div>
                    <Button type="button" variant="ghost" onClick={reload} title={t("page.statistics.refresh_title")}>
                        {t("page.statistics.refresh")}
                    </Button>
                    <ReportExportToolbar
                        dialogTitle={t("page.statistics.export_title")}
                        buildBundle={buildExportBundle}
                        defaultFormat="pdf"
                        showImport
                    />
                </div>
            </div>

            <div className="statistics-workspace">
                <nav
                    className="statistics-workspace__nav"
                    role="tablist"
                    aria-label={t("page.statistics.nav_aria")}
                >
                    {PANEL_IDS.map((id) => {
                        const isActive = activePanel === id;
                        return (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                id={`statistics-tab-${id}`}
                                aria-selected={isActive}
                                className={["statistics-nav__item", isActive ? "statistics-nav__item--active" : ""]
                                    .filter(Boolean)
                                    .join(" ")}
                                onClick={() => setActivePanel(id)}
                            >
                                <span className="statistics-nav__title">{panelTitle(id)}</span>
                                <span className="statistics-nav__desc">{panelDescription(id)}</span>
                            </button>
                        );
                    })}
                </nav>

                <div
                    id="statistics-main-panel"
                    role="tabpanel"
                    aria-labelledby={`statistics-tab-${activePanel}`}
                    className="statistics-workspace__main"
                >
                    {activePanel === "sec-overview" ? (
                        <>
                            <h2 className="statistics-workspace__panel-title">{t("page.statistics.overview.title")}</h2>
                            <p className="statistics-workspace__panel-intro">
                                {tp("page.statistics.overview.intro", { period: periodLabel })}
                            </p>
                <div
                    className="dashboard-kpis"
                    style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}
                >
                    <StatOverviewCard
                        label={t("page.statistics.kpi.patients_total")}
                        value={stats.patients_total.toLocaleString(intlTag)}
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
                        label={t("page.statistics.kpi.new_patients")}
                        value={Math.round(dash.newCur).toLocaleString(intlTag)}
                        icon="Sparkle"
                        accent="#FF9500"
                        sub={newDeltaStr}
                        trend={dash.newDelta > 0 ? "positive" : dash.newDelta < 0 ? "negative" : "neutral"}
                    />
                    <StatOverviewCard
                        label={
                            lastIncomeMonth
                                ? tp("page.statistics.kpi.revenue_month", { month: formatMonth(lastIncomeMonth.month, dateLocale) })
                                : t("page.statistics.kpi.revenue_paid")
                        }
                        value={lastIncomeMonth ? formatCurrency(lastIncomeMonth.value) : "—"}
                        icon="Wallet"
                        accent="#0A84FF"
                        sub={incomeBadge ?? t("page.statistics.kpi.revenue_compare_min")}
                        trend={
                            dash.incomeMom != null && dash.incomeMom > 0
                                ? "positive"
                                : dash.incomeMom != null && dash.incomeMom < 0
                                    ? "negative"
                                    : "neutral"
                        }
                    />
                    <StatOverviewCard
                        label={t("page.statistics.kpi.utilization")}
                        value={dash.occupancyPct != null ? `${Math.round(dash.occupancyPct)} %` : "—"}
                        icon="Calendar"
                        accent="#AF52DE"
                        sub={occupancyDeltaStr ?? t("page.statistics.kpi.utilization_sub")}
                        trend={
                            dash.appointmentMom != null && dash.appointmentMom > 0
                                ? "positive"
                                : dash.appointmentMom != null && dash.appointmentMom < 0
                                    ? "negative"
                                    : "neutral"
                        }
                    />
                </div>

                <p className="page-sub" style={{ margin: 0, fontSize: 12.5 }}>
                    {t("page.statistics.kpi.calendar_month")} <b>{formatCurrency(stats.income_current_month)}</b>
                    {" "}
                    <span style={{ color: "var(--fg-4)" }}>
                        {t("page.statistics.kpi.calendar_month_hint")}
                    </span>
                </p>

                <div className="statistics-overview-charts">
                    <Card>
                        <CardHeader
                            title={t("page.statistics.overview.chart_revenue_title")}
                            subtitle={tp("page.statistics.overview.chart_revenue_sub", { period: periodLabel.toLowerCase() })}
                            action={incomeBadge ? <span className="pill blue">{incomeBadge}</span> : undefined}
                        />
                        {dash.income6.some((m) => m.value > 0) ? (
                            <div className="card-pad" style={{ paddingTop: 0 }}>
                                <RevenueDevelopmentChart data={dash.income6} />
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
                                {t("page.statistics.overview.no_revenue")}
                            </div>
                        )}
                    </Card>
                    <Card>
                        <CardHeader title={t("page.statistics.overview.chart_mix_title")} subtitle={t("page.statistics.overview.chart_mix_sub")} />
                        <TreatmentMixPanel data={stats.treatments_by_category} />
                    </Card>
                </div>

                <div
                    className="dashboard-kpis"
                    style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 16 }}
                >
                    <StatOverviewCard
                        label={t("page.statistics.kpi.appointments_last_month")}
                        value={Math.round(dash.tCur).toLocaleString(intlTag)}
                        icon="Calendar"
                        accent="#0A84FF"
                        sub={fmtMom(dash.appointmentMom) ?? undefined}
                        trend={
                            dash.appointmentMom != null && dash.appointmentMom > 0
                                ? "positive"
                                : dash.appointmentMom != null && dash.appointmentMom < 0
                                    ? "negative"
                                    : "neutral"
                        }
                    />
                    <StatOverviewCard
                        label={t("page.statistics.kpi.punctuality")}
                        value={dash.loyaltyPct != null ? `${dash.loyaltyPct.toFixed(0)} %` : "—"}
                        icon="Sparkle"
                        accent="var(--accent)"
                        sub={
                            dash.loyaltyPct != null
                                ? t("page.statistics.kpi.punctuality_sub")
                                : t("page.statistics.kpi.punctuality_empty")
                        }
                        trend="neutral"
                    />
                    <StatOverviewCard
                        label={t("page.statistics.kpi.treatments_last_month")}
                        value={Math.round(dash.treatmentsCur).toLocaleString(intlTag)}
                        icon="/services"
                        accent="var(--accent)"
                        sub={fmtMom(dash.treatmentsMom) ?? undefined}
                        trend={
                            dash.treatmentsMom != null && dash.treatmentsMom > 0
                                ? "positive"
                                : dash.treatmentsMom != null && dash.treatmentsMom < 0
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
                        label={tp("page.statistics.kpi.revenue_sum", { period: periodLabel })}
                        value={formatCurrency(trimmedIncome.reduce((s, m) => s + m.value, 0))}
                        icon="/finance"
                        accent="var(--accent)"
                        sub={t("page.statistics.kpi.revenue_sum_sub")}
                        trend="neutral"
                    />
                    <StatOverviewCard
                        label={tp("page.statistics.kpi.appointments_sum", { period: periodLabel })}
                        value={trimmedAppointments.reduce((s, m) => s + m.value, 0).toLocaleString(intlTag)}
                        icon="/appointments"
                        accent="#0A84FF"
                        sub={t("page.statistics.kpi.appointments_sum_sub")}
                        trend="neutral"
                    />
                    <StatOverviewCard
                        label={t("page.statistics.kpi.low_stock")}
                        value={stats.products_low.toLocaleString(intlTag)}
                        icon="Package"
                        accent={stats.products_low > 0 ? "#FF3B30" : "#FF9500"}
                        sub={stats.products_low > 0 ? t("page.statistics.kpi.low_stock_alert") : t("page.statistics.kpi.low_stock_ok")}
                        trend={stats.products_low > 0 ? "negative" : "neutral"}
                    />
                    <StatOverviewCard
                        label={tp("page.statistics.kpi.treatments_sum", { period: periodLabel })}
                        value={trimmedTreatments.reduce((s, m) => s + m.value, 0).toLocaleString(intlTag)}
                        icon="/services"
                        accent="#AF52DE"
                        sub={t("page.statistics.kpi.treatments_sum_sub")}
                        trend="neutral"
                    />
                </div>
                        </>
                    ) : null}

                    {activePanel === "sec-patients" ? (
                    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <h2 className="statistics-workspace__panel-title">{panelTitle("sec-patients")}</h2>
                        <p className="statistics-workspace__panel-intro">{panelDescription("sec-patients")}</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ChartCard title={t("page.statistics.chart.patients_kumuliert")} subtitle={t("page.statistics.chart.patients_kumuliert_sub")} hasData={trimmedPatKum.some((m) => m.value > 0)}>
                                <MonthBar data={trimmedPatKum} color={PALETTE[2]} />
                            </ChartCard>
                            <ChartCard title={t("page.statistics.chart.neue_patients")} subtitle={t("page.statistics.chart.neue_patients_sub")} hasData={trimmedPatNew.some((m) => m.value > 0)}>
                                <MonthLine data={trimmedPatNew} color={PALETTE[1]} />
                            </ChartCard>
                            <ChartCard title={t("page.statistics.chart.age_groups")} hasData={stats.age_groups.length > 0}>
                                <PiePanel data={stats.age_groups} />
                            </ChartCard>
                            <ChartCard title={t("page.statistics.chart.sex")} hasData={stats.sexes.length > 0}>
                                <PiePanel data={stats.sexes} />
                            </ChartCard>
                            <ChartCard title={t("page.statistics.chart.patients_status")} subtitle={t("page.statistics.chart.patients_status_sub")} hasData={stats.patient_status.length > 0}>
                                <CategoryBar data={stats.patient_status} color={PALETTE[3]} />
                            </ChartCard>
                        </div>
                    </section>
                    ) : null}

                    {activePanel === "sec-disease-patterns" ? (
                    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <h2 className="statistics-workspace__panel-title">{panelTitle("sec-disease-patterns")}</h2>
                        <p className="statistics-workspace__panel-intro">{panelIntro("sec-disease-patterns")}</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ChartCard
                                title={t("page.statistics.chart.disease_patterns_top")}
                                hasData={(stats.disease_patterns_top ?? []).length > 0}
                                emptyHint={t("page.statistics.chart.disease_patterns_empty")}
                            >
                                <CategoryBar data={stats.disease_patterns_top ?? []} color={PALETTE[4]} />
                            </ChartCard>
                            <ChartCard
                                title={t("page.statistics.chart.disease_patterns_trend")}
                                hasData={trimmedDiseasePatterns.some((m) => m.value > 0)}
                            >
                                <MonthLine data={trimmedDiseasePatterns} color={PALETTE[0]} />
                            </ChartCard>
                        </div>
                    </section>
                    ) : null}

                    {activePanel === "sec-treatments" ? (
                    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <h2 className="statistics-workspace__panel-title">{panelTitle("sec-treatments")}</h2>
                        <p className="statistics-workspace__panel-intro">{panelDescription("sec-treatments")}</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ChartCard title={t("page.statistics.chart.treatments_month")} hasData={trimmedTreatments.some((m) => m.value > 0)}>
                                <MonthBar data={trimmedTreatments} color={PALETTE[0]} />
                            </ChartCard>
                            <ChartCard title={t("page.statistics.chart.treatments_category")} hasData={stats.treatments_by_category.length > 0}>
                                <CategoryBar data={stats.treatments_by_category} color={PALETTE[2]} />
                            </ChartCard>
                            <ChartCard title={t("page.statistics.chart.active_ingredient_top")} subtitle={t("page.statistics.chart.active_ingredient_top_sub")} hasData={stats.medications_top.length > 0}>
                                <CategoryBar data={stats.medications_top} color={PALETTE[3]} />
                            </ChartCard>
                            <ChartCard title={t("page.statistics.chart.active_ingredient_vert")} hasData={stats.medications_top.length > 0}>
                                <PiePanel data={stats.medications_top} />
                            </ChartCard>
                        </div>
                    </section>
                    ) : null}

                    {activePanel === "sec-appointments" ? (
                    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <h2 className="statistics-workspace__panel-title">{panelTitle("sec-appointments")}</h2>
                        <p className="statistics-workspace__panel-intro">{panelDescription("sec-appointments")}</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ChartCard title={t("page.statistics.chart.appointment_utilization")} hasData={trimmedAppointments.some((m) => m.value > 0)}>
                                <MonthBar data={trimmedAppointments} color={PALETTE[1]} />
                            </ChartCard>
                            <ChartCard title={t("page.statistics.chart.appointment_status")} hasData={stats.appointment_status.length > 0}>
                                <PiePanel data={stats.appointment_status} />
                            </ChartCard>
                            <ChartCard title={t("page.statistics.chart.appointment_kind")} hasData={stats.appointment_kind.length > 0}>
                                <CategoryBar data={stats.appointment_kind} color={PALETTE[5]} />
                            </ChartCard>
                            <DismissibleNotice
                                variant="info"
                                dismissKey="statistics-auslastung-hinweis"
                                title={t("page.statistics.notice.utilization_title")}
                            >
                                {t("page.statistics.notice.utilization_body")}
                            </DismissibleNotice>
                        </div>
                    </section>
                    ) : null}

                    {activePanel === "sec-finance" ? (
                    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <h2 className="statistics-workspace__panel-title">{panelTitle("sec-finance")}</h2>
                        <p className="statistics-workspace__panel-intro">{panelDescription("sec-finance")}</p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <ChartCard title={t("page.statistics.chart.revenue_month")} subtitle={t("page.statistics.chart.income_month_sub")} hasData={trimmedIncome.some((m) => m.value > 0)}>
                                <MonthBar data={trimmedIncome} color={PALETTE[4]} valueFormatter={(version) => formatCurrency(version)} />
                            </ChartCard>
                            <ChartCard title={t("page.statistics.chart.umsatz_payment_method")} hasData={stats.revenue_by_payment_method.length > 0}>
                                <PiePanel data={stats.revenue_by_payment_method} />
                            </ChartCard>
                            <ChartCard title={t("page.statistics.chart.purchase_orders_month")} hasData={trimmedOrders.some((m) => m.value > 0)}>
                                <MonthBar data={trimmedOrders} color={PALETTE[2]} />
                            </ChartCard>
                            <ChartCard title={t("page.statistics.chart.purchase_orders_status")} hasData={stats.orders_by_status.length > 0}>
                                <PiePanel data={stats.orders_by_status} />
                            </ChartCard>
                        </div>
                    </section>
                    ) : null}

                    {activePanel === "sec-workTime" ? (
                    <section className="statistics-work-section">
                        <h2 className="statistics-workspace__panel-title">{t("page.statistics.workTime.title")}</h2>
                        <p className="statistics-workspace__panel-intro">{t("page.statistics.workTime.intro")}</p>
                        {workStatsError ? (
                            <DismissibleNotice variant="warning" dismissKey="statistics-workTime-err" title={t("page.statistics.workTime.load_failed")}>
                                {workStatsError}
                            </DismissibleNotice>
                        ) : null}
                        {workStats ? (
                            <Card className="statistics-work-panel">
                                <div className="statistics-work-kpis">
                                    <div className="statistics-work-kpi statistics-work-kpi--week">
                                        <span className="statistics-work-kpi__label">{t("page.statistics.workTime.week_actual")}</span>
                                        <span className="statistics-work-kpi__value">{formatWorkMinutes(workStats.weekMinutes)}</span>
                                    </div>
                                    <div className="statistics-work-kpi statistics-work-kpi--month">
                                        <span className="statistics-work-kpi__label">{t("page.statistics.workTime.month_actual")}</span>
                                        <span className="statistics-work-kpi__value">{formatWorkMinutes(workStats.monthMinutes)}</span>
                                    </div>
                                    <div className="statistics-work-kpi statistics-work-kpi--pause">
                                        <span className="statistics-work-kpi__label">{t("page.statistics.workTime.pause_week")}</span>
                                        <span className="statistics-work-kpi__value">{formatWorkMinutes(workStats.pauseMinutesWeek)}</span>
                                    </div>
                                </div>

                                <div className="statistics-work-charts">
                                    <div className="statistics-work-chart-block">
                                        <h3 className="statistics-work-section-title">{t("page.statistics.workTime.chart_by_person")}</h3>
                                        {workStats.byPerson.length > 0 ? (
                                            <div className="statistics-work-chart-canvas">
                                                <WorkTimePersonBar members={workStats.byPerson} />
                                            </div>
                                        ) : (
                                            <p className="statistics-work-empty">{t("page.statistics.workTime.chart_empty")}</p>
                                        )}
                                    </div>
                                    {workStats.byDay.length > 0 ? (
                                        <div className="statistics-work-chart-block statistics-work-chart-block--daily">
                                            <h3 className="statistics-work-section-title">{t("page.workTime.week_overview")}</h3>
                                            <div className="statistics-work-chart-canvas statistics-work-chart-canvas--compact">
                                                <WorkTimeDayBar days={workStats.byDay} />
                                            </div>
                                        </div>
                                    ) : null}
                                </div>

                                {workStats.byPerson.length > 0 ? <WorkTimeTeamTable members={workStats.byPerson} /> : null}

                                <div className="statistics-work-footer">
                                    <Link to="/staff/work-time" className="statistics-work-link">
                                        {t("page.workTime.team.own_tracking")}
                                    </Link>
                                    <Link to="/administration/team/work-time" className="statistics-work-link">
                                        {t("page.workTime.team.title")}
                                    </Link>
                                </div>
                            </Card>
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
