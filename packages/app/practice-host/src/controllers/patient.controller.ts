import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { Patient } from "@/models/types";
import {
    CreatePatientSchema,
    UpdatePatientSchema,
    parseOrThrow,
} from "@/lib/schemas";

export async function listPatients(): Promise<Patient[]> {
    return practiceSystem.invoke<Patient[]>("list_patients");
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
