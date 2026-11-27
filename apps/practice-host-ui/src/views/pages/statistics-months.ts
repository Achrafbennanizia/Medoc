/** Month labels and period trimming for the statistics charts. */
import { format } from "date-fns";
import type { Locale as DateFnsLocale } from "date-fns";
import type { MonthBucket } from "../../models/types";

export type Period = "6m" | "12m";

export function formatMonth(month: string, locale: DateFnsLocale): string {
    const parts = month.split("-");
    if (parts.length !== 2) return month;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return month;
    return format(new Date(y, m - 1, 1), "MMM yy", { locale });
}

export function formatMonthShortOnly(month: string, locale: DateFnsLocale): string {
    const parts = month.split("-");
    if (parts.length !== 2) return month;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return month;
    return format(new Date(y, m - 1, 1), "MMM", { locale });
}

export function trim(months: MonthBucket[], period: Period): MonthBucket[] {
    if (period === "6m") return months.slice(-6);
    return months;
}
