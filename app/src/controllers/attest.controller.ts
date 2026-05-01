import { tauriInvoke } from "@/services/tauri.service";

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
}

export interface CreateAttest {
    patient_id: string;
    arzt_id: string;
    typ: string;
    inhalt: string;
    gueltig_von: string;
    gueltig_bis: string;
}

export const listAtteste = (patientId: string) =>
    tauriInvoke<Attest[]>("list_atteste", { patient_id: patientId });

export const createAttest = (data: CreateAttest) =>
    tauriInvoke<Attest>("create_attest", { data });

export const deleteAttest = (id: string) =>
    tauriInvoke<void>("delete_attest", { id });
