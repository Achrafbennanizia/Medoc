import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

/** ──────── GDPR Art. 30 — record of processing activities ──────── */
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

/** ──────── GDPR Art. 35 — data protection impact assessment ──────── */
export type RiskLevel = "very low" | "low" | "medium" | "high";
export interface RiskScenario {
    threat: string;
    likelihood: RiskLevel | string;
    impact: RiskLevel | string;
    mitigations: string[];
    residual_risk: RiskLevel | string;
}
export interface Dpia {
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
    return practiceSystem.invoke<VVT>("generate_vvt");
}

export function generateDpia(): Promise<Dpia> {
    return practiceSystem.invoke<Dpia>("generate_dpia");
}

export function enforceLogRetention(): Promise<LogRetentionReport> {
    return practiceSystem.invoke<LogRetentionReport>("enforce_log_retention");
}
