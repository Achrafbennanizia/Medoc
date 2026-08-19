import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

export type SickLeaveCertificateRecord = {
    id: string;
    staffId: string;
    note?: string | null;
    documentRef: string;
    dateFrom: string;
    dateTo?: string | null;
    startMin?: number | null;
    endMin?: number | null;
    status: string;
    createdBy: string;
    createdAt: string;
    endedAt?: string | null;
    endedBy?: string | null;
};

export type SickLeaveCertificateSaveRequest = {
    staffId?: string | null;
    note?: string | null;
    documentRef: string;
    dateFrom: string;
    dateTo?: string | null;
    startMin?: number | null;
    endMin?: number | null;
};

export async function sickLeaveCertificateSave(
    request: SickLeaveCertificateSaveRequest,
): Promise<SickLeaveCertificateRecord> {
    return practiceSystem.invoke<SickLeaveCertificateRecord>("sick_leave_certificate_save", {
        request,
    });
}

export async function listKrankenbescheinigungen(): Promise<SickLeaveCertificateRecord[]> {
    return practiceSystem.invoke<SickLeaveCertificateRecord[]>("list_sick_leave_certificates");
}

export async function endSickLeaveCertificate(id: string): Promise<SickLeaveCertificateRecord> {
    return practiceSystem.invoke<SickLeaveCertificateRecord>("end_sick_leave_certificate", { id });
}
