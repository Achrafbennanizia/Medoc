import { tauriInvoke } from "../services/tauri.service";
import type { Patient } from "../models/types";
import {
    CreatePatientSchema,
    UpdatePatientSchema,
    parseOrThrow,
} from "../lib/schemas";

export async function listPatienten(): Promise<Patient[]> {
    return tauriInvoke<Patient[]>("list_patienten");
}

export async function getPatient(id: string): Promise<Patient> {
    return tauriInvoke<Patient>("get_patient", { id });
}

export async function searchPatienten(
    query: string,
    opts?: { includeVersicherungsnummer?: boolean },
): Promise<Patient[]> {
    return tauriInvoke<Patient[]>("search_patienten", {
        query,
        include_versicherungsnummer: opts?.includeVersicherungsnummer !== false,
    });
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
    const safe = parseOrThrow(CreatePatientSchema, data);
    return tauriInvoke<Patient>("create_patient", { data: safe });
}

export async function updatePatient(id: string, data: Record<string, unknown>): Promise<Patient> {
    const safe = parseOrThrow(UpdatePatientSchema, data);
    return tauriInvoke<Patient>("update_patient", { id, data: safe });
}

export async function deletePatient(id: string): Promise<void> {
    return tauriInvoke("delete_patient", { id });
}
