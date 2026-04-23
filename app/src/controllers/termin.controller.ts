import { tauriInvoke } from "../services/tauri.service";
import type { Termin } from "../models/types";

export async function listTermine(): Promise<Termin[]> {
    return tauriInvoke<Termin[]>("list_termine");
}

export async function listTermineByDate(datum: string): Promise<Termin[]> {
    return tauriInvoke<Termin[]>("list_termine_by_date", { datum });
}

export async function createTermin(data: {
    datum: string;
    uhrzeit: string;
    art: string;
    patient_id: string;
    arzt_id: string;
    notizen?: string;
    beschwerden?: string;
}): Promise<Termin> {
    return tauriInvoke<Termin>("create_termin", { data });
}

export async function updateTermin(id: string, data: Record<string, unknown>): Promise<Termin> {
    return tauriInvoke<Termin>("update_termin", { id, data });
}

export async function deleteTermin(id: string): Promise<void> {
    return tauriInvoke("delete_termin", { id });
}
