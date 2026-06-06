import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
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
    pzn?: string | null;
    darreichungsform?: string | null;
    packungsgroesse?: string | null;
    menge?: number | null;
    aut_idem?: boolean | null;
    rezept_typ?: string | null;
    icd10_code?: string | null;
    verordnender_arzt_id?: string | null;
}

export interface CreateRezept {
    patient_id: string;
    arzt_id: string;
    medikament: string;
    wirkstoff?: string | null;
    dosierung: string;
    dauer: string;
    hinweise?: string | null;
    pzn?: string | null;
    darreichungsform?: string | null;
    packungsgroesse?: string | null;
    menge?: number | null;
    aut_idem?: boolean | null;
    rezept_typ?: "PRIVAT" | "KASSE" | "BTM" | null;
    icd10_code?: string | null;
    verordnender_arzt_id?: string | null;
}

export const listRezepte = (patientId: string) =>
    practiceSystem.invoke<Rezept[]>("list_rezepte", { patient_id: patientId });

export const createRezept = (data: CreateRezept) => {
    const safe = parseOrThrow(CreateRezeptSchema, data);
    return practiceSystem.invoke<Rezept>("create_rezept", { data: safe });
};

export const deleteRezept = (id: string) =>
    practiceSystem.invoke<void>("delete_rezept", { id });

export interface UpdateRezept {
    id: string;
    medikament: string;
    wirkstoff?: string | null;
    dosierung: string;
    dauer: string;
    hinweise?: string | null;
    pzn?: string | null;
    darreichungsform?: string | null;
    packungsgroesse?: string | null;
    menge?: number | null;
    aut_idem?: boolean | null;
    rezept_typ?: "PRIVAT" | "KASSE" | "BTM" | null;
    icd10_code?: string | null;
    verordnender_arzt_id?: string | null;
}

export const updateRezept = (data: UpdateRezept) => {
    const safe = parseOrThrow(UpdateRezeptSchema, data);
    return practiceSystem.invoke<Rezept>("update_rezept", { data: safe });
};
