import { tauriInvoke } from "@/services/tauri.service";
import { CreateAttestSchema, parseOrThrow } from "@/lib/schemas";

export interface Attest {
    id: string;
    patient_id: string;
    arzt_id: string;
    typ: string;
    inhalt: string;
    gueltig_von: string;
    gueltig_bis: string;
    ausgestellt_am: string;
    created_at: string;
    icd10_code?: string | null;
    erst_oder_folge?: string | null;
    arbeitgeber?: string | null;
    ausstellender_arzt_id?: string | null;
}

export interface CreateAttest {
    patient_id: string;
    arzt_id: string;
    typ: string;
    inhalt: string;
    gueltig_von: string;
    gueltig_bis: string;
    icd10_code?: string | null;
    erst_oder_folge?: "ERST" | "FOLGE" | null;
    arbeitgeber?: string | null;
    ausstellender_arzt_id?: string | null;
}

export const listAtteste = (patientId: string) =>
    tauriInvoke<Attest[]>("list_atteste", { patient_id: patientId });

export const createAttest = (data: CreateAttest) => {
    const safe = parseOrThrow(CreateAttestSchema, data);
    return tauriInvoke<Attest>("create_attest", { data: safe });
};

export const deleteAttest = (id: string) =>
    tauriInvoke<void>("delete_attest", { id });
