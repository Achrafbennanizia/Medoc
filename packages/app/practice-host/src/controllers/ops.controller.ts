import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";

export interface BackupInfo {
    path: string;
    size_bytes: number;
    /** null = no .sig sidecar (legacy); true/false = HMAC verification */
    signature_ok: boolean | null;
    /** RFC 3339, from the file name. */
    created_at?: string | null;
    /** `.mdbk`: compressed + encrypted; false = legacy `.db`. */
    compressed?: boolean;
    /** Why it is kept; empty = goes at the next rotation. */
    tiers?: BackupTier[];
}

export type BackupTier = "daily" | "weekly" | "half_year";

export interface BackupHistoryRow {
    at: string;
    action: string;
    by: string;
    details: string | null;
}

export interface BackupOverview {
    enabled: boolean;
    schedule: { enabled: boolean; changedBy?: string; changedAt?: string; reason?: string } | null;
    backup_dir: string;
    total_bytes: number;
    backups: BackupInfo[];
    history: BackupHistoryRow[];
}

/** Settings → Backups (dentist only, `ops.backup`). */
export const backupOverview = () => practiceSystem.invoke<BackupOverview>("backup_overview");
/** Pausing needs a reason; it is kept in the audit log. */
export const setBackupSchedule = (enabled: boolean, reason: string) =>
    practiceSystem.invoke<void>("set_backup_schedule", { enabled, reason });
/** Deletes every backup and makes a fresh one. Needs a reason (audit log). */
export const resetBackups = (reason: string) => practiceSystem.invoke<BackupInfo>("reset_backups", { reason });
/** Delete one backup in the backup folder (not the last one). The reason goes into the audit log. */
export const deleteBackup = (path: string, reason: string) => practiceSystem.invoke<void>("delete_backup", { path, reason });

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
/** `verifySignatures: false` skips the per-file HMAC (fast; `signature_ok` comes back `null` = not checked). */
export const listBackups = (opts?: { verifySignatures?: boolean }) =>
    practiceSystem.invoke<BackupInfo[]>("list_backups", { verifySignatures: opts?.verifySignatures ?? true });
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
