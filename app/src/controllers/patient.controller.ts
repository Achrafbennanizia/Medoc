import { tauriInvoke } from "../services/tauri.service";
import type { Patient } from "../models/types";

export async function listPatienten(): Promise<Patient[]> {
    return tauriInvoke<Patient[]>("list_patienten");
}

export async function getPatient(id: string): Promise<Patient> {
    return tauriInvoke<Patient>("get_patient", { id });
}

export async function searchPatienten(query: string): Promise<Patient[]> {
    return tauriInvoke<Patient[]>("search_patienten", { query });
}

export async function createPatient(data: {
    name: string;
    geburtsdatum: string;
    geschlecht: string;
    versicherungsnummer: string;
    telefon?: string;
    email?: string;
    adresse?: string;
}): Promise<Patient> {
    return tauriInvoke<Patient>("create_patient", { data });
}

export async function updatePatient(id: string, data: Record<string, unknown>): Promise<Patient> {
    return tauriInvoke<Patient>("update_patient", { id, data });
}

export async function deletePatient(id: string): Promise<void> {
    return tauriInvoke("delete_patient", { id });
}
