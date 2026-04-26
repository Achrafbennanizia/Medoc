import { tauriInvoke } from "@/services/tauri.service";
import { CreateBilanzSnapshotSchema, parseOrThrow } from "@/lib/schemas";

export interface BilanzSnapshot {
    id: string;
    created_by: string;
    zeitraum: string;
    typ: string;
    label: string;
    einnahmen_cents: number;
    ausgaben_cents: number;
    saldo_cents: number;
    /** Stored verbatim as JSON string. */
    payload: string;
    created_at: string;
}

export interface CreateBilanzSnapshot {
    zeitraum: string;
    typ: string;
    label: string;
    einnahmen_cents: number;
    ausgaben_cents: number;
    payload: unknown;
}

export const listBilanzSnapshots = () =>
    tauriInvoke<BilanzSnapshot[]>("list_bilanz_snapshots");

export const getBilanzSnapshot = (id: string) =>
    tauriInvoke<BilanzSnapshot>("get_bilanz_snapshot", { id });

export const createBilanzSnapshot = (data: CreateBilanzSnapshot) => {
    const safe = parseOrThrow(CreateBilanzSnapshotSchema, data);
    return tauriInvoke<BilanzSnapshot>("create_bilanz_snapshot", { data: safe });
};

export const deleteBilanzSnapshot = (id: string) =>
    tauriInvoke<void>("delete_bilanz_snapshot", { id });
