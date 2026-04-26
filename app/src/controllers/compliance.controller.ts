import { tauriInvoke } from "@/services/tauri.service";

/** ──────── DSGVO Art. 30 — Verzeichnis von Verarbeitungstätigkeiten ──────── */
export interface ProcessingActivity {
    name: string;
    purpose: string;
    legal_basis: string;
    data_categories: string[];
    data_subjects: string[];
    recipients: string[];
    retention: string;
    technical_measures: string[];
    organisational_measures: string[];
}
export interface VVT {
    generated_at: string;
    controller: string;
    system: string;
    system_version: string;
    activities: ProcessingActivity[];
}

/** ──────── DSGVO Art. 35 — Datenschutz-Folgenabschätzung ──────── */
export type RiskLevel = "very low" | "low" | "medium" | "high";
export interface RiskScenario {
    threat: string;
    likelihood: RiskLevel | string;
    impact: RiskLevel | string;
    mitigations: string[];
    residual_risk: RiskLevel | string;
}
export interface DSFA {
    generated_at: string;
    system: string;
    system_version: string;
    processing_overview: string;
    necessity_proportionality: string;
    scenarios: RiskScenario[];
}

/** ──────── Log-Retention (NFA-LOG-05) ──────── */
export interface LogRetentionReport {
    scanned: number;
    deleted: string[];
    kept: number;
    errors: string[];
}

export function generateVvt(): Promise<VVT> {
    return tauriInvoke<VVT>("generate_vvt");
}

export function generateDsfa(): Promise<DSFA> {
    return tauriInvoke<DSFA>("generate_dsfa");
}

export function enforceLogRetention(): Promise<LogRetentionReport> {
    return tauriInvoke<LogRetentionReport>("enforce_log_retention");
}
