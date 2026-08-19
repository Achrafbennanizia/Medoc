// Data Protection Impact Assessment (GDPR Art. 35 — DPIA).
//
// Provides a structured, machine-readable record of the impact assessment
// for the highest-risk processing operations performed by MeDoc.

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct RiskScenario {
    pub threat: &'static str,
    pub likelihood: &'static str, // "low" | "medium" | "high"
    pub impact: &'static str,     // "low" | "medium" | "high"
    pub mitigations: Vec<&'static str>,
    pub residual_risk: &'static str,
}

#[derive(Debug, Serialize)]
pub struct Dpia {
    pub generated_at: String,
    pub system: &'static str,
    pub system_version: &'static str,
    pub processing_overview: &'static str,
    pub necessity_proportionality: &'static str,
    pub scenarios: Vec<RiskScenario>,
}

pub fn generate() -> Dpia {
    Dpia {
        generated_at: chrono::Utc::now().to_rfc3339(),
        system: "MeDoc",
        system_version: env!("CARGO_PKG_VERSION"),
        processing_overview:
            "Processing of patient master data and special categories of personal data \
             under GDPR Art. 9(1) (health data) in a dental practice. Processing is local; \
             there is no automated transfer to third countries.",
        necessity_proportionality:
            "Processing is required to meet the statutory documentation duty under \
             § 630f BGB and to provide treatment. Data minimisation is enforced through \
             role-based access control (four roles) and field-level visibility.",
        scenarios: vec![
            RiskScenario {
                threat: "Unauthorised access by a staff member with overly broad rights",
                likelihood: "medium",
                impact: "high",
                mitigations: vec![
                    "Role-based access control (RBAC, NFA-SEC-03)",
                    "Audit log with HMAC hash chain (NFA-LOG-04)",
                    "Session timeout 15 min (NFA-SEC-09)",
                ],
                residual_risk: "low",
            },
            RiskScenario {
                threat: "Theft or loss of an endpoint that holds patient data",
                likelihood: "low",
                impact: "high",
                mitigations: vec![
                    "Planned database encryption at rest (SQLCipher/AES-256, NFA-SEC-08 — backlog)",
                    "Argon2id password hashing",
                    "Recommended full-disk encryption (FileVault / BitLocker)",
                ],
                residual_risk: "medium",
            },
            RiskScenario {
                threat: "Brute-force attack on login",
                likelihood: "medium",
                impact: "medium",
                mitigations: vec![
                    "Lockout after 5 failed attempts / 10 min (NFA-LOG-02)",
                    "Computationally expensive Argon2id",
                    "Security-log alerting",
                ],
                residual_risk: "low",
            },
            RiskScenario {
                threat: "Tampering with the treatment documentation trail",
                likelihood: "low",
                impact: "high",
                mitigations: vec![
                    "Tamper-evident hash chain of all audit entries",
                    "verify_audit_chain command",
                    "Backup verification after creation",
                ],
                residual_risk: "very low",
            },
            RiskScenario {
                threat: "Data loss from hardware failure",
                likelihood: "medium",
                impact: "high",
                mitigations: vec![
                    "One-click backup with VACUUM INTO + validation",
                    "Recommendation: daily backups to external media",
                ],
                residual_risk: "low",
            },
        ],
    }
}
