import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import { CreateBalanceSheetSnapshotSchema, parseOrThrow } from "@/lib/schemas";

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

export interface CreateBalanceSheetSnapshot {
    period: string;
    kind: string;
    label: string;
    income_cents: number;
    expenses_cents: number;
    payload: unknown;
}

export const listBalanceSheetSnapshots = () =>
    practiceSystem.invoke<BalanceSheetSnapshot[]>("list_balance_sheet_snapshots");

export const getBalanceSheetSnapshot = (id: string) =>
    practiceSystem.invoke<BalanceSheetSnapshot>("get_balance_sheet_snapshot", { id });

export const createBalanceSheetSnapshot = (data: CreateBalanceSheetSnapshot) => {
    const safe = parseOrThrow(CreateBalanceSheetSnapshotSchema, data);
    return practiceSystem.invoke<BalanceSheetSnapshot>("create_balance_sheet_snapshot", { data: safe });
};

export const deleteBalanceSheetSnapshot = (id: string) =>
    practiceSystem.invoke<void>("delete_balance_sheet_snapshot", { id });
