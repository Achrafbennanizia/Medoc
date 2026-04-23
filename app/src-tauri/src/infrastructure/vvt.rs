// Verzeichnis von Verarbeitungstätigkeiten (DSGVO Art. 30 — VVT).
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
        "SQLite-Datenbank lokal (WAL-Modus); DB-Datei aktuell ohne SQLCipher — NFA-SEC-08 (Verschlüsselung at-rest) offen; ergänzend OS-Vollverschlüsselung des Geräts (BitLocker/FileVault) empfohlen",
        "Geplant: SQLCipher/AES-256 für Verschlüsselung der Datenbankdatei (NFA-SEC-08)",
        "Argon2id Passwort-Hashing",
        "TLS 1.3 für alle Netzwerkverbindungen",
        "Tamper-proof Audit-Log (HMAC-SHA256-Hash-Kette)",
        "Rollenbasierte Zugriffskontrolle (4 Rollen)",
        "Automatische Sitzungssperre nach 15 Min. Inaktivität",
        "Zeroize sensibler Daten im Arbeitsspeicher",
    ];
    let common_org = vec![
        "Dokumentierte Berechtigungskonzepte",
        "Schulung des Personals zur DSGVO",
        "Datenschutz-Folgenabschätzung (DSFA) bei Hochrisiko-Verarbeitung",
        "Verfahren zur Wahrnehmung der Betroffenenrechte",
    ];

    VVT {
        generated_at: chrono::Utc::now().to_rfc3339(),
        controller: "Praxisinhaber:in (Verantwortliche:r i.S.v. Art. 4 Nr. 7 DSGVO)",
        system: "MeDoc",
        system_version: env!("CARGO_PKG_VERSION"),
        activities: vec![
            ProcessingActivity {
                name: "Patientenstammdaten & Behandlungsdokumentation".into(),
                purpose:
                    "Erbringung zahnmedizinischer Leistungen, Dokumentationspflicht nach § 630f BGB"
                        .into(),
                legal_basis: "Art. 9 Abs. 2 lit. h DSGVO i.V.m. § 22 Abs. 1 Nr. 1 lit. b BDSG"
                    .into(),
                data_categories: vec![
                    "Identifikationsdaten (Name, Geburtsdatum, Adresse)",
                    "Versicherungsdaten",
                    "Gesundheitsdaten (Anamnese, Befunde, Behandlungen)",
                    "Bilddaten (Röntgen, Fotos)",
                ],
                data_subjects: vec!["Patient:innen"],
                recipients: vec![
                    "Behandelnde Ärzt:innen",
                    "Auf Anforderung: KZV",
                    "Bei Überweisung: Fachärzt:innen",
                ],
                retention: "10 Jahre nach Abschluss der Behandlung (§ 630f Abs. 3 BGB)",
                technical_measures: common_tech.clone(),
                organisational_measures: common_org.clone(),
            },
            ProcessingActivity {
                name: "Terminverwaltung".into(),
                purpose: "Planung und Erinnerung an Behandlungstermine".into(),
                legal_basis: "Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung/-erfüllung)".into(),
                data_categories: vec!["Identifikationsdaten", "Terminhistorie", "Kontaktdaten"],
                data_subjects: vec!["Patient:innen"],
                recipients: vec!["Praxispersonal"],
                retention: "Mit Patientenakte: 10 Jahre",
                technical_measures: common_tech.clone(),
                organisational_measures: common_org.clone(),
            },
            ProcessingActivity {
                name: "Abrechnung & Buchhaltung".into(),
                purpose: "Erstellung von Rechnungen, BEMA/GOZ-Abrechnung, Zahlungsverfolgung"
                    .into(),
                legal_basis: "Art. 6 Abs. 1 lit. b/c DSGVO (Vertrag, gesetzliche Pflicht)".into(),
                data_categories: vec![
                    "Identifikationsdaten",
                    "Versicherungsdaten",
                    "Leistungspositionen",
                    "Zahlungsdaten",
                ],
                data_subjects: vec!["Patient:innen", "Steuerberater:in (lesend)"],
                recipients: vec!["Steuerberatung", "Krankenkassen / KZV", "Finanzamt"],
                retention: "10 Jahre (§ 147 AO)",
                technical_measures: common_tech.clone(),
                organisational_measures: common_org.clone(),
            },
            ProcessingActivity {
                name: "Personalverwaltung".into(),
                purpose: "Verwaltung der Mitarbeiter:innen und ihrer Rollen".into(),
                legal_basis: "Art. 6 Abs. 1 lit. b DSGVO, § 26 BDSG".into(),
                data_categories: vec![
                    "Identifikationsdaten",
                    "Rollendaten",
                    "Authentifizierungsdaten (Passwort-Hashes)",
                ],
                data_subjects: vec!["Mitarbeiter:innen"],
                recipients: vec!["Praxisleitung"],
                retention: "Bis 3 Jahre nach Ende des Arbeitsverhältnisses",
                technical_measures: common_tech.clone(),
                organisational_measures: common_org.clone(),
            },
            ProcessingActivity {
                name: "Audit-Log & Sicherheitslog".into(),
                purpose:
                    "Nachvollziehbarkeit von Datenzugriffen, Erkennung von Sicherheitsvorfällen"
                        .into(),
                legal_basis: "Art. 32 DSGVO (Sicherheit der Verarbeitung), Art. 33 (Meldepflicht)"
                    .into(),
                data_categories: vec![
                    "User-IDs",
                    "Zeitstempel",
                    "Aktionen",
                    "IP-Adresse (Sicherheitslog)",
                ],
                data_subjects: vec!["Mitarbeiter:innen"],
                recipients: vec![
                    "Datenschutzbeauftragte:r",
                    "Aufsichtsbehörde (auf Anforderung)",
                ],
                retention: "Audit-Log: 10 Jahre. Sicherheitslog: 90 Tage. Anwendungslog: 30 Tage.",
                technical_measures: common_tech,
                organisational_measures: common_org,
            },
        ],
    }
}
