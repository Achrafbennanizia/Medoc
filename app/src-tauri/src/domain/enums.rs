use serde::{Deserialize, Serialize};

// NOTE on case-handling: the SQLite columns historically store enum values in
// SCREAMING_UPPERCASE (`KONTROLLE`, `MAENNLICH`, …), the frontend also sends
// uppercase strings, but the Rust variants use PascalCase. Both sqlx and serde
// therefore need an explicit `rename_all = "UPPERCASE"` attribute, otherwise
// Tauri commands fail to deserialize incoming `art`/`geschlecht`/`status`
// fields and writes silently 4xx in production.

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "UPPERCASE")]
#[serde(rename_all = "UPPERCASE")]
pub enum Rolle {
    Arzt,
    Rezeption,
    Steuerberater,
    Pharmaberater,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "UPPERCASE")]
#[serde(rename_all = "UPPERCASE")]
pub enum TerminArt {
    Erstbesuch,
    Untersuchung,
    Behandlung,
    Kontrolle,
    Beratung,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "UPPERCASE")]
#[serde(rename_all = "UPPERCASE")]
pub enum TerminStatus {
    Geplant,
    Bestaetigt,
    Durchgefuehrt,
    NichtErschienen,
    Abgesagt,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "UPPERCASE")]
#[serde(rename_all = "UPPERCASE")]
pub enum Geschlecht {
    Maennlich,
    Weiblich,
    Divers,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "UPPERCASE")]
#[serde(rename_all = "UPPERCASE")]
pub enum AktenStatus {
    Entwurf,
    InBearbeitung,
    Validiert,
    Readonly,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "UPPERCASE")]
#[serde(rename_all = "UPPERCASE")]
pub enum PatientStatus {
    Neu,
    Aktiv,
    Validiert,
    Readonly,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "UPPERCASE")]
#[serde(rename_all = "UPPERCASE")]
pub enum ZahlungsArt {
    Bar,
    Karte,
    Ueberweisung,
    Rechnung,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "UPPERCASE")]
#[serde(rename_all = "UPPERCASE")]
pub enum ZahlungsStatus {
    Ausstehend,
    Bezahlt,
    Teilbezahlt,
    Storniert,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "UPPERCASE")]
#[serde(rename_all = "UPPERCASE")]
pub enum AuditAction {
    Create,
    Update,
    Delete,
    Login,
    Logout,
}
