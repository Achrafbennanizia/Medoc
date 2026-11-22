//! Every prescription is checked against the patient's recorded allergies before it is saved.
//!
//! The active substance is compared (the medication name when no substance was entered). A
//! match refuses the prescription with `error.prescription.allergy_conflict` so the doctor is
//! warned; the doctor may then confirm and issue it anyway (`allergy_override`), which the
//! caller records in the audit log.

use sqlx::SqlitePool;

use crate::domain::services::allergy_conflict::{
    allergens_from_anamnesis, find_conflict, AllergyConflict,
};
use crate::error::AppError;
use crate::infrastructure::database::repos::clinical::chart as chart_repo;

pub const ALLERGY_CONFLICT_KEY: &str = "error.prescription.allergy_conflict";

/// `Ok(None)`: no match. `Ok(Some(_))`: match the doctor confirmed. `Err`: match, not confirmed.
pub async fn check_prescription_allergies(
    pool: &SqlitePool,
    patient_id: &str,
    medication: &str,
    active_ingredient: Option<&str>,
    confirmed_by_doctor: bool,
) -> Result<Option<AllergyConflict>, AppError> {
    let substance = active_ingredient
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| medication.trim());
    let Some(form) = chart_repo::find_anamnesis_form(pool, patient_id).await? else {
        return Ok(None);
    };
    let Some(conflict) = find_conflict(substance, &allergens_from_anamnesis(&form.answers)) else {
        return Ok(None);
    };
    if confirmed_by_doctor {
        return Ok(Some(conflict));
    }
    Err(AppError::validation_code_params(
        ALLERGY_CONFLICT_KEY,
        &[
            ("substance", token_safe(&conflict.substance)),
            ("allergen", token_safe(&conflict.allergen)),
        ],
    ))
}

/// Audit detail for a confirmed match.
pub fn override_detail(conflict: &AllergyConflict) -> String {
    serde_json::json!({ "substance": conflict.substance, "allergen": conflict.allergen })
        .to_string()
}

/// `|` and `=` separate the error token's parameters.
fn token_safe(text: &str) -> String {
    text.replace(['|', '='], " ").trim().to_string()
}
