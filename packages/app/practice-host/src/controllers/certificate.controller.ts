import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import { CreateCertificateSchema, parseOrThrow } from "@/lib/schemas";

export interface Certificate {
    id: string;
    patient_id: string;
    physician_id: string;
    kind: string;
    body_text: string;
    valid_from: string;
    valid_until: string;
    issued_at: string;
    created_at: string;
    icd10_code?: string | null;
    first_or_follow_up?: string | null;
    employer?: string | null;
    issuing_physician_id?: string | null;
}

export interface CreateCertificate {
    patient_id: string;
    physician_id: string;
    kind: string;
    body_text: string;
    valid_from: string;
    valid_until: string;
    icd10_code?: string | null;
    first_or_follow_up?: "FIRST" | "FOLLOW_UP" | null;
    employer?: string | null;
    issuing_physician_id?: string | null;
}

export const listCertificates = (patientId: string) =>
    practiceSystem.invoke<Certificate[]>("list_certificates", { patient_id: patientId });

export const createCertificate = (data: CreateCertificate) => {
    const safe = parseOrThrow(CreateCertificateSchema, data);
    return practiceSystem.invoke<Certificate>("create_certificate", { data: safe });
};

export const deleteCertificate = (id: string) =>
    practiceSystem.invoke<void>("delete_certificate", { id });
