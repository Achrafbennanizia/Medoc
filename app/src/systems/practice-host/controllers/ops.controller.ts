import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

export interface BackupInfo {
    path: string;
    size_bytes: number;
    /** null = no .sig sidecar (legacy); true/false = HMAC verification */
    signature_ok: boolean | null;
}

export interface ErasureReport {
    patient_id: string;
    anonymised_at: string;
    deleted_records: number;
    backups_redacted: number;
    log_files_redacted: number;
}

export interface ImportReport {
    source: string;
    total_rows: number;
    imported: number;
    skipped: number;
    failed: number;
    errors: string[];
}

export const createBackup = () => practiceSystem.invoke<BackupInfo>("create_backup");
export const listBackups = () => practiceSystem.invoke<BackupInfo[]>("list_backups");
export const validateBackup = (path: string) =>
    practiceSystem.invoke<boolean>("validate_backup", { path });

export interface RestoreBackupResult {
    requires_app_restart: boolean;
    restored_from: string;
    pre_restore_backup_created: boolean;
}

export const restoreBackup = (path: string) =>
    practiceSystem.invoke<RestoreBackupResult>("restore_backup", { path });

export const dsgvoExportPatient = (patientId: string) =>
    practiceSystem.invoke<unknown>("dsgvo_export_patient", { patient_id: patientId });
export const dsgvoErasePatient = (patientId: string) =>
    practiceSystem.invoke<ErasureReport>("dsgvo_erase_patient", { patient_id: patientId });

export const importPatientsCsv = (csvPath: string, dryRun: boolean) =>
    practiceSystem.invoke<ImportReport>("import_patients_csv", { csv_path: csvPath, dry_run: dryRun });

/** Opens a native file dialog for validating a backup file. */
export const pickBackupFile = () => practiceSystem.invoke<string | null>("pick_backup_file");

/** Opens a native file dialog; returns `null` if the user cancels. */
export const pickPatientsCsvFile = () =>
    practiceSystem.invoke<string | null>("pick_patients_csv_file");
