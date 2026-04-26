import { tauriInvoke } from "@/services/tauri.service";
import type { Leistung } from "@/models/types";

export async function listLeistungen(): Promise<Leistung[]> {
    return tauriInvoke<Leistung[]>("list_leistungen");
}

export async function createLeistung(data: {
    name: string;
    beschreibung?: string;
    kategorie: string;
    preis: number;
}): Promise<Leistung> {
    return tauriInvoke<Leistung>("create_leistung", { data });
}

/** Fields mirror Tauri `UpdateLeistung` — all optional, merged with existing row. */
export type UpdateLeistungPayload = {
    name?: string;
    beschreibung?: string | null;
    kategorie?: string;
    preis?: number;
    aktiv?: boolean;
};

export async function updateLeistung(id: string, data: UpdateLeistungPayload): Promise<Leistung> {
    return tauriInvoke<Leistung>("update_leistung", { id, data });
}

export async function deleteLeistung(id: string): Promise<void> {
    return tauriInvoke("delete_leistung", { id });
}
