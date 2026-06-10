use serde::{Deserialize, Serialize};

/// FA-AUFG-01 — bidirektionale Praxis-Aufgaben (Evolution von `praxis_ticket`).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PraxisAufgabe {
    pub id: String,
    pub patient_id: Option<String>,
    pub typ: String,
    pub titel: String,
    pub body: Option<String>,
    /// `REZEPTION` = Posteingang Rezeption (Pool); sonst Ziel-Arzt über `assignee_user_id`.
    pub assignee_role: Option<String>,
    pub assignee_user_id: Option<String>,
    pub created_by: String,
    pub behandlung_id: Option<String>,
    pub untersuchung_id: Option<String>,
    pub leistungsname: Option<String>,
    pub gesamtkosten: Option<f64>,
    pub zahlung_id: Option<String>,
    pub erledigt_notiz: Option<String>,
    pub zurueck_begruendung: Option<String>,
    pub status: String,
    pub legacy_ticket_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PraxisAufgabeKommentar {
    pub id: String,
    pub aufgabe_id: String,
    pub author_id: String,
    pub body: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddPraxisAufgabeKommentarArgs {
    pub aufgabe_id: String,
    pub body: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePraxisAufgabe {
    #[serde(default)]
    pub patient_id: Option<String>,
    pub typ: String,
    pub titel: String,
    #[serde(default)]
    pub body: Option<String>,
    /// Ziel Rezeption (Arzt → REZ).
    #[serde(default)]
    pub assignee_role: Option<String>,
    /// Ziel-Arzt (REZ → ARZT).
    #[serde(default)]
    pub assignee_user_id: Option<String>,
    #[serde(default)]
    pub behandlung_id: Option<String>,
    #[serde(default)]
    pub untersuchung_id: Option<String>,
    #[serde(default)]
    pub leistungsname: Option<String>,
    #[serde(default)]
    pub gesamtkosten: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransitionPraxisAufgabeArgs {
    pub id: String,
    pub status: String,
    #[serde(default)]
    pub erledigt_notiz: Option<String>,
    #[serde(default)]
    pub zahlung_id: Option<String>,
    #[serde(default)]
    pub zurueck_begruendung: Option<String>,
}

/// Verwaltung: Aufgabe bearbeiten (Titel, Zuweisung, Status).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePraxisAufgabeAdmin {
    pub id: String,
    #[serde(default)]
    pub titel: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub typ: Option<String>,
    #[serde(default)]
    pub assignee_role: Option<String>,
    #[serde(default)]
    pub assignee_user_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}
