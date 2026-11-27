import { localIsoDate } from "@/lib/utils";
import type { z } from "zod";
import type { IssuedPdf } from "@/systems/practice-host/controllers/document.controller";
import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";
import { CreateBalanceSheetSnapshotSchema, parseOrThrow } from "@/lib/schemas";

import { documentLocale } from "@/lib/document-locale";
export interface BalanceSheetSnapshot {
    id: string;
    created_by: string;
    period: string;
    kind: string;
    label: string;
    income_cents: number;
    expenses_cents: number;
    balance_cents: number;
    /** Stored verbatim as JSON string. */
    payload: string;
    created_at: string;
}

export type CreateBalanceSheetSnapshot = z.input<typeof CreateBalanceSheetSnapshotSchema>;

export const listBalanceSheetSnapshots = () =>
    practiceSystem.invoke<BalanceSheetSnapshot[]>("list_balance_sheet_snapshots");

export const getBalanceSheetSnapshot = (id: string) =>
    practiceSystem.invoke<BalanceSheetSnapshot>("get_balance_sheet_snapshot", { id });

export const createBalanceSheetSnapshot = (data: CreateBalanceSheetSnapshot) => {
    const safe = parseOrThrow(CreateBalanceSheetSnapshotSchema, data);
    return practiceSystem.invoke<BalanceSheetSnapshot>("create_balance_sheet_snapshot", {
        data: { ...safe, locale: documentLocale() },
    });
};

// ---------------------------------------------------------------------------
// Period report (Einnahmen-Überschuss-Übersicht), computed on the server
// ---------------------------------------------------------------------------


export type PeriodKind = "MONTH" | "QUARTER" | "YEAR" | "CUSTOM";

export interface PeriodAmount {
    label: string;
    cents: number;
}

export interface PeriodExpenseLine {
    source: "CASH" | "PURCHASE" | "CONTRACT";
    date: string;
    label: string;
    cents: number;
    /** Contracts are pro-rata estimates, not payments. */
    estimate: boolean;
    /** Cash-book voucher number, when the movement has one. */
    voucher?: string | null;
}

export interface PeriodReport {
    from: string;
    to: string;
    kind: PeriodKind;
    incomeCents: number;
    incomeByMethod: PeriodAmount[];
    incomeByMonth: PeriodAmount[];
    invoicedCents: number;
    invoiceCount: number;
    cancellationCents: number;
    cancellationCount: number;
    openReceivablesCents: number;
    openReceivablesCount: number;
    expensesCents: number;
    expensesEstimateCents: number;
    expenses: PeriodExpenseLine[];
    resultCents: number;
    unclosedDays: string[];
    /** Cabinet+: block numbers never issued (see period_report.rs). Absent in older snapshots. */
    voidNumbers?: { prefix: string; first: string; last: string; count: number }[];
}

export interface PeriodReportResult {
    snapshotId: string | null;
    report: PeriodReport;
    pdf: IssuedPdf;
}

export const computePeriodReport = (from: string, to: string, kind: PeriodKind) =>
    practiceSystem.invoke<PeriodReport>("compute_period_report", { from, to, kind });

/** `preview: true` → watermarked PDF, nothing stored. Otherwise numbered BE-… report. */
export const createPeriodReport = (args: { from: string; to: string; kind: PeriodKind; label?: string; preview?: boolean }) =>
    practiceSystem.invoke<PeriodReportResult>("create_period_report", {
        args: { preview: false, ...args, locale: documentLocale() },
    });

/** PDF copy of a saved period report, looked up by snapshot id. */
export const reprintPeriodReport = (snapshotId: string) =>
    practiceSystem.invoke<IssuedPdf>("reprint_period_report", { snapshotId });

/** First and last day (YYYY-MM-DD, local) of a month/quarter/year containing `ref`. */
export function periodBounds(kind: Exclude<PeriodKind, "CUSTOM">, ref: Date): { from: string; to: string } {
    const y = ref.getFullYear();
    const m = ref.getMonth();
    if (kind === "YEAR") return { from: `${y}-01-01`, to: `${y}-12-31` };
    if (kind === "QUARTER") {
        const q0 = Math.floor(m / 3) * 3;
        return { from: localIsoDate(new Date(y, q0, 1)), to: localIsoDate(new Date(y, q0 + 3, 0)) };
    }
    return { from: localIsoDate(new Date(y, m, 1)), to: localIsoDate(new Date(y, m + 1, 0)) };
}
