import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { Patient } from "@/models/types";
import {
    CreatePatientSchema,
    UpdatePatientSchema,
    parseOrThrow,
} from "@/lib/schemas";
import type { ListParams, ListResponse } from "@/lib/list-params";

export async function listPatients(): Promise<Patient[]> {
    return practiceSystem.invoke<Patient[]>("list_patients");
}

export async function listPatientsPaged(params?: ListParams): Promise<ListResponse<Patient>> {
    return practiceSystem.invoke<ListResponse<Patient>>("list_patients_paged", { params });
}

export async function exportPatientsCsv(params?: ListParams): Promise<string> {
    return practiceSystem.invoke<string>("export_patients_csv", { params });
}

export type PatientFilterCounts = {
    ALL: number;
    IN_TREATMENT: number;
    NEW_PATIENT: number;
    INVOICE_OPEN: number;
    CHART_OPEN: number;
    CLOSED: number;
};

/** F57: tab counts over all patients (the list loads page by page). */
export async function countPatientsByFilter(showArchived: boolean): Promise<PatientFilterCounts> {
    return practiceSystem.invoke<PatientFilterCounts>("count_patients_by_filter", { showArchived });
}

/** F57: every patient, page by page (export must not stop at the loaded rows). */
export async function listAllPatients(showArchived: boolean, pageSize = 500): Promise<Patient[]> {
    const out: Patient[] = [];
    for (let page = 1; page <= 1000; page += 1) {
        const resp = await listPatientsPaged({ page, pageSize, filter: { showArchived } });
        out.push(...resp.items);
        if (resp.items.length === 0 || out.length >= resp.total) break;
    }
    return out;
}

export async function listPatientsByIds(ids: string[]): Promise<Patient[]> {
    if (ids.length === 0) return [];
    return practiceSystem.invoke<Patient[]>("list_patients_by_ids", { ids });
}

export async function getPatient(id: string): Promise<Patient> {
    return practiceSystem.invoke<Patient>("get_patient", { id });
}

export async function searchPatients(
    query: string,
    opts?: { includeInsuranceNumber?: boolean },
): Promise<Patient[]> {
    return practiceSystem.invoke<Patient[]>("search_patients", {
        query,
        include_insurance_number: opts?.includeInsuranceNumber !== false,
    });
}

export async function createPatient(data: {
    name: string;
    date_of_birth: string;
    sex: string;
    insurance_number: string;
    phone?: string;
    email?: string;
    address?: string;
}): Promise<Patient> {
    const safe = parseOrThrow(CreatePatientSchema, data);
    return practiceSystem.invoke<Patient>("create_patient", { data: safe });
}

export async function updatePatient(id: string, data: Record<string, unknown>): Promise<Patient> {
    const safe = parseOrThrow(UpdatePatientSchema, data);
    return practiceSystem.invoke<Patient>("update_patient", { id, data: safe });
}

export async function deletePatient(id: string): Promise<void> {
    return practiceSystem.invoke("delete_patient", { id });
}

export async function restorePatient(id: string): Promise<void> {
    return practiceSystem.invoke("restore_patient", { id });
}
