// Datenschutz-Folgenabschätzung (DSGVO Art. 35 — DSFA).
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
pub struct DSFA {
    pub generated_at: String,
    pub system: &'static str,
    pub system_version: &'static str,
    pub processing_overview: &'static str,
    pub necessity_proportionality: &'static str,
    pub scenarios: Vec<RiskScenario>,
}

pub fn generate() -> DSFA {
    DSFA {
        generated_at: chrono::Utc::now().to_rfc3339(),
        system: "MeDoc",
        system_version: env!("CARGO_PKG_VERSION"),
        processing_overview:
            "Verarbeitung von Patientenstammdaten und besonderen Kategorien personenbezogener \
             Daten gemäß Art. 9 Abs. 1 DSGVO (Gesundheitsdaten) im Rahmen einer zahnärztlichen \
             Praxis. Lokale Verarbeitung; keine automatisierte Übermittlung an Drittländer.",
        necessity_proportionality:
            "Verarbeitung ist zur Erfüllung der gesetzlichen Dokumentationspflicht nach \
             § 630f BGB sowie zur Behandlung erforderlich. Datenminimierung wird durch \
             rollenbasierte Zugriffskontrolle (4 Rollen) und feldspezifische Sichtbarkeit \
             gewährleistet.",
        scenarios: vec![
            RiskScenario {
                threat: "Unbefugter Zugriff durch Mitarbeiter:in mit zu weit gefassten Rechten",
                likelihood: "medium",
                impact: "high",
                mitigations: vec![
                    "Rollenbasierte Zugriffskontrolle (RBAC, NFA-SEC-03)",
                    "Audit-Log mit HMAC-Hash-Kette (NFA-LOG-04)",
                    "Sitzungs-Timeout 15 Min. (NFA-SEC-09)",
                ],
                residual_risk: "low",
            },
            RiskScenario {
                threat: "Diebstahl/Verlust des Endgeräts mit Patientendaten",
                likelihood: "low",
                impact: "high",
                mitigations: vec![
                    "Geplante DB-Verschlüsselung at-rest (SQLCipher/AES-256, NFA-SEC-08 — Backlog)",
                    "Argon2id Passwort-Hashing",
                    "Pflichtempfehlung: Festplattenvollverschlüsselung (FileVault/BitLocker)",
                ],
                residual_risk: "medium",
            },
            RiskScenario {
                threat: "Brute-Force-Angriff auf Login",
                likelihood: "medium",
                impact: "medium",
                mitigations: vec![
                    "Sperre nach 5 Fehlversuchen / 10 Min. (NFA-LOG-02)",
                    "Argon2id rechenintensiv",
                    "Sicherheitslog-Alarmierung",
                ],
                residual_risk: "low",
            },
            RiskScenario {
                threat: "Manipulation des Behandlungsdokumentationsprotokolls",
                likelihood: "low",
                impact: "high",
                mitigations: vec![
                    "Tamper-evident Hash-Kette aller Audit-Einträge",
                    "verify_audit_chain Befehl",
                    "Backup-Verifikation nach Erstellung",
                ],
                residual_risk: "very low",
            },
            RiskScenario {
                threat: "Datenverlust durch Hardwareausfall",
                likelihood: "medium",
                impact: "high",
                mitigations: vec![
                    "Ein-Klick Backup mit VACUUM INTO + Validierung",
                    "Empfehlung: tägliche Backups auf externes Medium",
                ],
                residual_risk: "low",
            },
        ],
    }
}
