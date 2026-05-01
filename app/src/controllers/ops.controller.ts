import { tauriInvoke } from "@/services/tauri.service";

export interface BackupInfo {
    path: string;
    size_bytes: number;
}

export interface ErasureReport {
    patient_id: string;
    anonymised_at: string;
    deleted_records: number;
}

export interface ImportReport {
    source: string;
    total_rows: number;
    imported: number;
    skipped: number;
    failed: number;
    errors: string[];
}

export const createBackup = () => tauriInvoke<BackupInfo>("create_backup");
export const listBackups = () => tauriInvoke<BackupInfo[]>("list_backups");
export const validateBackup = (path: string) =>
    tauriInvoke<boolean>("validate_backup", { path });

export const dsgvoExportPatient = (patientId: string) =>
    tauriInvoke<unknown>("dsgvo_export_patient", { patientId });
export const dsgvoErasePatient = (patientId: string) =>
    tauriInvoke<ErasureReport>("dsgvo_erase_patient", { patientId });

export const importPatientsCsv = (csvPath: string, dryRun: boolean) =>
    tauriInvoke<ImportReport>("import_patients_csv", { csvPath, dryRun });

/** Opens a native file dialog; returns `null` if the user cancels. */
export const pickPatientsCsvFile = () =>
    tauriInvoke<string | null>("pick_patients_csv_file");
