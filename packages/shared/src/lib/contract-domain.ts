import { formatCurrency } from "@/lib/utils";

/** Billing period for the entered amount (the amount applies to this cadence). */
export type ContractInterval = "DAY" | "WEEK" | "MONTH" | "YEAR";

export const CONTRACT_INTERVAL_OPTIONS: { value: ContractInterval; label: string }[] = [
    { value: "DAY", label: "per day" },
    { value: "WEEK", label: "per week" },
    { value: "MONTH", label: "per month" },
    { value: "YEAR", label: "per year" },
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
};

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

export function todayYmd(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/** Is the contract active today? (termination / expiry date) */
export function contractActiveToday(version: ContractItem): boolean {
    if (version.unlimited) return true;
    const from = version.periodFrom;
    const until = version.periodUntil;
    if (!from || !until) return true;
    const t = todayYmd();
    return t >= from && t <= until;
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
