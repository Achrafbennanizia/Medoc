import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import { CreatePrescriptionSchema, UpdatePrescriptionSchema, parseOrThrow } from "@/lib/schemas";

export interface Prescription {
    id: string;
    patient_id: string;
    physician_id: string;
    medication: string;
    active_ingredient: string | null;
    dosage: string;
    duration: string;
    instructions: string | null;
    issued_at: string;
    status: string;
    created_at: string;
    pzn?: string | null;
    dosage_form?: string | null;
    pack_size?: string | null;
    quantity?: number | null;
    aut_idem?: boolean | null;
    prescription_type?: string | null;
    icd10_code?: string | null;
    prescribing_physician_id?: string | null;
}

export interface CreatePrescription {
    patient_id: string;
    physician_id: string;
    medication: string;
    active_ingredient?: string | null;
    dosage: string;
    duration: string;
    instructions?: string | null;
    pzn?: string | null;
    dosage_form?: string | null;
    pack_size?: string | null;
    quantity?: number | null;
    aut_idem?: boolean | null;
    prescription_type?: "PRIVAT" | "KASSE" | "BTM" | null;
    icd10_code?: string | null;
    prescribing_physician_id?: string | null;
}

export const listPrescriptions = (patientId: string) =>
    practiceSystem.invoke<Prescription[]>("list_prescriptions", { patient_id: patientId });

export const createPrescription = (data: CreatePrescription) => {
    const safe = parseOrThrow(CreatePrescriptionSchema, data);
    return practiceSystem.invoke<Prescription>("create_prescription", { data: safe });
};

export const deletePrescription = (id: string) =>
    practiceSystem.invoke<void>("delete_prescription", { id });

export interface UpdatePrescription {
    id: string;
    medication: string;
    active_ingredient?: string | null;
    dosage: string;
    duration: string;
    instructions?: string | null;
    pzn?: string | null;
    dosage_form?: string | null;
    pack_size?: string | null;
    quantity?: number | null;
    aut_idem?: boolean | null;
    prescription_type?: "PRIVAT" | "KASSE" | "BTM" | null;
    icd10_code?: string | null;
    prescribing_physician_id?: string | null;
}

export const updatePrescription = (data: UpdatePrescription) => {
    const safe = parseOrThrow(UpdatePrescriptionSchema, data);
    return practiceSystem.invoke<Prescription>("update_prescription", { data: safe });
};
