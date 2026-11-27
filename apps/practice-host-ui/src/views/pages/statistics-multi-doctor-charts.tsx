/** Per-doctor overlay lines on monthly statistics charts (Cabinet+ T5.6). */
import { useMemo, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import type { Locale as DateFnsLocale } from "date-fns";
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import type { DoctorMonthSeries, MonthBucket } from "@/models/types";
import { useDateFnsLocale, useIntlLocaleTag } from "@/lib/i18n";
import { ChartAxisTick } from "./statistics-chart-kit";
import { cartesianMargin, CHART_AXIS, CHART_GRID, CHART_TICK, CHART_TOOLTIP_STYLE, PALETTE, useChartRtl } from "./statistics-chart-style";

export type PerDoctorChartMetric = "appointments" | "treatments" | "income";

function formatMonth(month: string, locale: DateFnsLocale): string {
    try {
        return format(parseISO(`${month}-01`), "MMM yyyy", { locale });
    } catch {
        return month;
    }
}

function metricBuckets(s: DoctorMonthSeries, metric: PerDoctorChartMetric): MonthBucket[] {
    if (metric === "appointments") return s.appointments_per_month;
    if (metric === "treatments") return s.treatments_per_month;
    return s.income_per_month ?? [];
}

export function MultiDoctorMonthLineChart({
    series,
    metric,
    months,
    valueFormatter,
}: {
    series: DoctorMonthSeries[];
    metric: PerDoctorChartMetric;
    months: MonthBucket[];
    valueFormatter?: (value: number) => string;
}) {
    const intlTag = useIntlLocaleTag();
    const dateLocale = useDateFnsLocale();
    const rtl = useChartRtl();
    const fmt = valueFormatter ?? ((v: number) => v.toLocaleString(intlTag));

    const chartData = useMemo(() => {
        return months.map(({ month }) => {
            const row: Record<string, string | number> = {
                month,
                monthLabel: formatMonth(month, dateLocale),
            };
            for (const d of series) {
                const hit = metricBuckets(d, metric).find((b) => b.month === month);
                row[d.staff_id] = hit?.value ?? 0;
            }
            return row;
        });
    }, [months, series, metric, dateLocale]);

    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={cartesianMargin(rtl)}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                <XAxis
                    dataKey="monthLabel"
                    reversed={rtl}
                    tick={(props) => <ChartAxisTick {...props} fill={CHART_TICK} />}
                    tickLine={false}
                    axisLine={{ stroke: CHART_AXIS }}
                    height={36}
                    interval={0}
                />
                <YAxis
                    orientation={rtl ? "right" : "left"}
                    tick={(props) => (
                        <ChartAxisTick {...props} axis="y" fill={CHART_TICK} ySide={rtl ? "right" : "left"} />
                    )}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={metric === "income"}
                    width={metric === "income" ? 52 : 36}
                />
                <Tooltip
                    cursor={{ stroke: CHART_GRID }}
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={{ color: "var(--fg-2)" }}
                    itemStyle={{ color: "var(--fg)" }}
                    formatter={(value: number, _name, item) => [
                        fmt(value),
                        series.find((d) => d.staff_id === item.dataKey)?.name ?? String(item.dataKey),
                    ]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {series.map((d, idx) => (
                    <Line
                        key={d.staff_id}
                        type="monotone"
                        dataKey={d.staff_id}
                        name={d.name}
                        stroke={PALETTE[idx % PALETTE.length]}
                        strokeWidth={2}
                        dot={{ r: 2.5 }}
                        activeDot={{ r: 4 }}
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
    );
}

function overlayHasData(series: DoctorMonthSeries[], metric: PerDoctorChartMetric, months: MonthBucket[]): boolean {
    return months.some((m) =>
        series.some((d) => (metricBuckets(d, metric).find((b) => b.month === m.month)?.value ?? 0) > 0),
    );
}

export function StatisticsMonthlyChart({
    aggregate,
    series,
    showOverlay,
    metric,
    children,
    valueFormatter,
}: {
    aggregate: MonthBucket[];
    series: DoctorMonthSeries[] | undefined;
    showOverlay: boolean;
    metric: PerDoctorChartMetric;
    variant: "bar" | "line";
    children: ReactNode;
    valueFormatter?: (value: number) => string;
}) {
    if (showOverlay && series?.length && overlayHasData(series, metric, aggregate)) {
        return (
            <MultiDoctorMonthLineChart
                series={series}
                metric={metric}
                months={aggregate}
                valueFormatter={valueFormatter}
            />
        );
    }
    return <>{children}</>;
}