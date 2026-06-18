import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

export type KrankenbescheinigungRecord = {
    id: string;
    personalId: string;
    note?: string | null;
    documentRef: string;
    dateFrom: string;
    dateTo?: string | null;
    startMin?: number | null;
    endMin?: number | null;
    status: string;
    createdBy: string;
    createdAt: string;
    endedAt?: string | null;
    endedBy?: string | null;
};

export type KrankenbescheinigungSaveRequest = {
    personalId?: string | null;
    note?: string | null;
    documentRef: string;
    dateFrom: string;
    dateTo?: string | null;
    startMin?: number | null;
    endMin?: number | null;
};

export async function krankenbescheinigungSave(
    request: KrankenbescheinigungSaveRequest,
): Promise<KrankenbescheinigungRecord> {
    return practiceSystem.invoke<KrankenbescheinigungRecord>("krankenbescheinigung_save", {
        request,
    });
}

export async function listKrankenbescheinigungen(): Promise<KrankenbescheinigungRecord[]> {
    return practiceSystem.invoke<KrankenbescheinigungRecord[]>("list_krankenbescheinigungen");
}
