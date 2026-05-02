import { tauriInvoke } from "@/services/tauri.service";
import { CreateRezeptSchema, UpdateRezeptSchema, parseOrThrow } from "@/lib/schemas";

export interface Rezept {
    id: string;
    patient_id: string;
    arzt_id: string;
    medikament: string;
    wirkstoff: string | null;
    dosierung: string;
    dauer: string;
    hinweise: string | null;
    ausgestellt_am: string;
    status: string;
    created_at: string;
}

export interface CreateRezept {
    patient_id: string;
    arzt_id: string;
    medikament: string;
    wirkstoff?: string | null;
    dosierung: string;
    dauer: string;
    hinweise?: string | null;
}

export const listRezepte = (patientId: string) =>
    tauriInvoke<Rezept[]>("list_rezepte", { patient_id: patientId });

export const createRezept = (data: CreateRezept) => {
    const safe = parseOrThrow(CreateRezeptSchema, data);
    return tauriInvoke<Rezept>("create_rezept", { data: safe });
};

export const deleteRezept = (id: string) =>
    tauriInvoke<void>("delete_rezept", { id });

export interface UpdateRezept {
    id: string;
    medikament: string;
    wirkstoff?: string | null;
    dosierung: string;
    dauer: string;
    hinweise?: string | null;
}

export const updateRezept = (data: UpdateRezept) => {
    const safe = parseOrThrow(UpdateRezeptSchema, data);
    return tauriInvoke<Rezept>("update_rezept", { data: safe });
};
