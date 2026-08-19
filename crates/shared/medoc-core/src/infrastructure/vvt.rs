// Record of processing activities (GDPR Art. 30 — VVT / ROPA).
//
// Generates the legally required record of processing activities for the
// dental practice operating MeDoc. The output is a structured document
// suitable for both internal documentation and submission to a supervisory
// authority.

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ProcessingActivity {
    pub name: String,
    pub purpose: String,
    pub legal_basis: String,
    pub data_categories: Vec<&'static str>,
    pub data_subjects: Vec<&'static str>,
    pub recipients: Vec<&'static str>,
    pub retention: &'static str,
    pub technical_measures: Vec<&'static str>,
    pub organisational_measures: Vec<&'static str>,
}

#[derive(Debug, Serialize)]
pub struct VVT {
    pub generated_at: String,
    pub controller: &'static str,
    pub system: &'static str,
    pub system_version: &'static str,
    pub activities: Vec<ProcessingActivity>,
}

pub fn generate() -> VVT {
    let common_tech = vec![
        "Local SQLite database (WAL mode) with SQLCipher (AES-256) — key in the OS keychain; optional `db-key.wrap` (NFA-SEC-08)",
        "Additional full-disk encryption recommended (BitLocker / FileVault)",
        "Argon2id password hashing",
        "TLS 1.3 for all network connections",
        "Tamper-evident audit log (HMAC-SHA256 hash chain)",
        "Role-based access control (four roles)",
        "Automatic session lock after 15 minutes of inactivity",
        "Zeroize of sensitive data in memory",
    ];
    let common_org = vec![
        "Documented authorisation concept",
        "Staff training on GDPR",
        "Data protection impact assessment (DPIA) for high-risk processing",
        "Procedure for exercising data-subject rights",
    ];

    VVT {
        generated_at: chrono::Utc::now().to_rfc3339(),
        controller: "Practice owner (controller under GDPR Art. 4(7))",
        system: "MeDoc",
        system_version: env!("CARGO_PKG_VERSION"),
        activities: vec![
            ProcessingActivity {
                name: "Patient master data and treatment documentation".into(),
                purpose:
                    "Provision of dental services; documentation duty under § 630f BGB"
                        .into(),
                legal_basis: "GDPR Art. 9(2)(h) in conjunction with § 22(1) no. 1(b) BDSG"
                    .into(),
                data_categories: vec![
                    "Identification data (name, date of birth, address)",
                    "Insurance data",
                    "Health data (anamnesis, findings, treatments)",
                    "Image data (X-ray, photos)",
                ],
                data_subjects: vec!["Patients"],
                recipients: vec![
                    "Treating clinicians",
                    "On request: regional dental association (KZV)",
                    "On referral: specialists",
                ],
                retention: "10 years after completion of treatment (§ 630f(3) BGB)",
                technical_measures: common_tech.clone(),
                organisational_measures: common_org.clone(),
            },
            ProcessingActivity {
                name: "Appointment management".into(),
                purpose: "Planning and reminders for treatment appointments".into(),
                legal_basis: "GDPR Art. 6(1)(b) (steps prior to / performance of a contract)".into(),
                data_categories: vec!["Identification data", "Appointment history", "Contact data"],
                data_subjects: vec!["Patients"],
                recipients: vec!["Practice staff"],
                retention: "With the patient chart: 10 years",
                technical_measures: common_tech.clone(),
                organisational_measures: common_org.clone(),
            },
            ProcessingActivity {
                name: "Billing and accounting".into(),
                purpose: "Invoices, BEMA/GOZ billing, payment tracking"
                    .into(),
                legal_basis: "GDPR Art. 6(1)(b)/(c) (contract; legal obligation)".into(),
                data_categories: vec![
                    "Identification data",
                    "Insurance data",
                    "Service items",
                    "Payment data",
                ],
                data_subjects: vec!["Patients", "Tax advisor (read-only)"],
                recipients: vec!["Tax advisor", "Health insurers / KZV", "Tax office"],
                retention: "10 years (§ 147 AO)",
                technical_measures: common_tech.clone(),
                organisational_measures: common_org.clone(),
            },
            ProcessingActivity {
                name: "Staff administration".into(),
                purpose: "Administration of staff and their roles".into(),
                legal_basis: "GDPR Art. 6(1)(b), § 26 BDSG".into(),
                data_categories: vec![
                    "Identification data",
                    "Role data",
                    "Authentication data (password hashes)",
                ],
                data_subjects: vec!["Staff"],
                recipients: vec!["Practice management"],
                retention: "Up to 3 years after the end of employment",
                technical_measures: common_tech.clone(),
                organisational_measures: common_org.clone(),
            },
            ProcessingActivity {
                name: "Audit log and security log".into(),
                purpose:
                    "Traceability of data access; detection of security incidents"
                        .into(),
                legal_basis: "GDPR Art. 32 (security of processing), Art. 33 (notification)"
                    .into(),
                data_categories: vec![
                    "User IDs",
                    "Timestamps",
                    "Actions",
                    "IP address (security log)",
                ],
                data_subjects: vec!["Staff"],
                recipients: vec![
                    "Data protection officer",
                    "Supervisory authority (on request)",
                ],
                retention: "Audit log: 10 years. Security log: 90 days. Application log: 30 days.",
                technical_measures: common_tech,
                organisational_measures: common_org,
            },
        ],
    }
}
