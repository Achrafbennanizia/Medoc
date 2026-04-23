use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "UPPERCASE")]
pub enum Rolle {
    Arzt,
    Rezeption,
    Steuerberater,
    Pharmaberater,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "UPPERCASE")]
pub enum TerminArt {
    Erstbesuch,
    Untersuchung,
    Behandlung,
    Kontrolle,
    Beratung,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "UPPERCASE")]
pub enum TerminStatus {
    Geplant,
    Bestaetigt,
    Durchgefuehrt,
    NichtErschienen,
    Abgesagt,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "UPPERCASE")]
pub enum Geschlecht {
    Maennlich,
    Weiblich,
    Divers,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "UPPERCASE")]
pub enum AktenStatus {
    Entwurf,
    InBearbeitung,
    Validiert,
    Readonly,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "UPPERCASE")]
pub enum PatientStatus {
    Neu,
    Aktiv,
    Validiert,
    Readonly,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "UPPERCASE")]
pub enum ZahlungsArt {
    Bar,
    Karte,
    Ueberweisung,
    Rechnung,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "UPPERCASE")]
pub enum ZahlungsStatus {
    Ausstehend,
    Bezahlt,
    Teilbezahlt,
    Storniert,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(rename_all = "UPPERCASE")]
pub enum AuditAction {
    Create,
    Update,
    Delete,
    Login,
    Logout,
}
