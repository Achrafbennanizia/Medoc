import { formatCurrency, localIsoDate } from "@/lib/utils";

/** Billing period for the entered amount (the amount applies to this cadence). */
export type ContractInterval = "DAY" | "WEEK" | "MONTH" | "YEAR";

export const CONTRACT_INTERVAL_OPTIONS: { value: ContractInterval; labelKey: string }[] = [
    { value: "DAY", labelKey: "page.administration.contracts.interval.DAY" },
    { value: "WEEK", labelKey: "page.administration.contracts.interval.WEEK" },
    { value: "MONTH", labelKey: "page.administration.contracts.interval.MONTH" },
    { value: "YEAR", labelKey: "page.administration.contracts.interval.YEAR" },
];

export type ContractItem = {
    id: string;
    designation: string;
    partner: string;
    /** Amount per `interval` (0 = intentionally variable, see e.g. partner note) */
    amount: number;
    interval: ContractInterval;
    /** true = no fixed term; `periodFrom` / `periodUntil` ignored. */
    unlimited: boolean;
    periodFrom: string | null;
    periodUntil: string | null;
    createdAt: string;
    /** Optional: scanned or archived contract document (absolute path). */
    documentPath: string | null;
    /** Running (true) or deactivated (false). Missing on old rows → running. */
    active?: boolean;
    /** Day the contract was deactivated (YYYY-MM-DD); cost is counted up to and including this day. */
    deactivatedAt?: string | null;
};

/** Lifecycle of a contract (status registry entity `contract`). */
export type ContractStatus = "NOT_STARTED" | "ACTIVE" | "INACTIVE" | "EXPIRED";

/** Last day that costs money: earlier of end date and deactivation day (null = open-ended). */
export function contractEffectiveEnd(c: ContractItem): string | null {
    const end = c.unlimited ? null : c.periodUntil ?? null;
    const off = c.active === false ? c.deactivatedAt ?? null : null;
    if (end && off) return off < end ? off : end;
    return off ?? end;
}

export function contractStatus(c: ContractItem, today: string = localIsoDate(new Date())): ContractStatus {
    if (c.active === false) return "INACTIVE";
    if (!c.unlimited && c.periodFrom && today < c.periodFrom) return "NOT_STARTED";
    if (!c.unlimited && c.periodUntil && today > c.periodUntil) return "EXPIRED";
    return "ACTIVE";
}

const DAY_MS = 86_400_000;
function dayNumber(ymd: string): number {
    const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
    return Math.floor(Date.UTC(y!, (m ?? 1) - 1, d ?? 1) / DAY_MS);
}

/** Cost per calendar day for an amount billed every `interval`. */
export function contractDailyRate(amount: number, interval: ContractInterval): number {
    if (amount <= 0) return 0;
    switch (interval) {
        case "DAY":
            return amount;
        case "WEEK":
            return amount / 7;
        case "MONTH":
            return (amount * 12) / 365.25;
        case "YEAR":
            return amount / 365.25;
        default:
            return 0;
    }
}

/**
 * Cost accrued inside [from, to] (inclusive), honouring the contract's start, end and deactivation day.
 * Same proration rule as the period report on the server (`period_report.rs`).
 */
export function contractCostBetween(c: ContractItem, from: string, to: string): number {
    const start = !c.unlimited && c.periodFrom ? (c.periodFrom > from ? c.periodFrom : from) : from;
    const end0 = contractEffectiveEnd(c);
    const end = end0 && end0 < to ? end0 : to;
    if (end < start) return 0;
    const days = dayNumber(end) - dayNumber(start) + 1;
    return Math.round(contractDailyRate(c.amount, c.interval) * days * 100) / 100;
}

/** Cost from the contract start (or creation) until today / its deactivation / end. */
export function contractCostToDate(c: ContractItem, today: string = localIsoDate(new Date())): number {
    const start = (!c.unlimited && c.periodFrom) || c.createdAt.slice(0, 10);
    return contractCostBetween(c, start, today);
}

export function intervalShort(i: ContractInterval): string {
    switch (i) {
        case "DAY":
            return "day";
        case "WEEK":
            return "wk";
        case "MONTH":
            return "mo";
        case "YEAR":
            return "yr";
        default:
            return i;
    }
}

/** Guideline: approximate monthly rate (for table/overview). */
export function amountEquivalentPerMonth(amount: number, interval: ContractInterval): number {
    if (amount <= 0) return 0;
    switch (interval) {
        case "DAY":
            return amount * (365.25 / 12);
        case "WEEK":
            return amount * (365.25 / 12 / 7);
        case "MONTH":
            return amount;
        case "YEAR":
            return amount / 12;
        default:
            return amount;
    }
}

/** Is the contract running today? (not deactivated, inside its term) */
export function contractActiveToday(version: ContractItem): boolean {
    return contractStatus(version) === "ACTIVE";
}

export function formatContractTerm(version: ContractItem): string {
    if (version.unlimited) return "unlimited";
    if (version.periodFrom && version.periodUntil) return `${version.periodFrom} – ${version.periodUntil}`;
    if (version.periodFrom) return `from ${version.periodFrom}`;
    if (version.periodUntil) return `until ${version.periodUntil}`;
    return "—";
}

export function formatContractAmountLine(amount: number, interval: ContractInterval): string {
    if (amount <= 0) return "variable";
    return `${formatCurrency(amount)} / ${intervalShort(interval)}`;
}

export function formatMonthlyEquivalentText(version: ContractItem): string {
    if (version.amount <= 0) return "—";
    const m = amountEquivalentPerMonth(version.amount, version.interval);
    return `≈ ${formatCurrency(m)} / month (guideline)`;
}
