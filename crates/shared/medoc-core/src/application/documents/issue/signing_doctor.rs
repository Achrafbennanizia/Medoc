//! Signing doctor's block on prescriptions and certificates (editions-plan §5.1, T5.7).

use serde_json::Value;
use sqlx::SqlitePool;

use super::super::practice_profile::PracticeProfile;
use super::DocKind;
use crate::error::AppError;

/// Per-doctor data printed in a signature block (§5.1): `{ "<staff id>": { "title", "professionalId" } }`.
pub const DOCTOR_SIGNATURES_KV_KEY: &str = "documents.doctor_signatures.v1";

/// Signature block of the document's signing doctor (`signed_by_staff_id`, set in Group), when that
/// doctor is not the practice's own clinician. `None` keeps the practice block, which is what Solo
/// and Duo always get: they never stamp a signing doctor.
pub(super) async fn signing_doctor_lines(
    pool: &SqlitePool,
    kind: DocKind,
    source_id: &str,
    profile: &PracticeProfile,
) -> Result<Option<Vec<String>>, AppError> {
    let table = match kind {
        DocKind::Prescription => "prescription",
        DocKind::Certificate => "certificate",
        _ => return Ok(None),
    };
    let first = source_id.split(',').next().unwrap_or("").trim();
    let signer: Option<(String, String)> = sqlx::query_as(&format!(
        "SELECT s.id, s.name FROM {table} d JOIN staff s ON s.id = d.signed_by_staff_id WHERE d.id = ?1"
    ))
    .bind(first)
    .fetch_optional(pool)
    .await?;
    let Some((staff_id, name)) = signer.filter(|(_, n)| !n.trim().is_empty()) else {
        return Ok(None);
    };
    let practice_clinician = profile.clinician_name.as_deref().unwrap_or("").trim();
    if name.trim().eq_ignore_ascii_case(practice_clinician) {
        return Ok(None);
    }
    let entry = crate::infrastructure::database::repos::admin::app_kv::get(pool, DOCTOR_SIGNATURES_KV_KEY)
        .await?
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
        .and_then(|v| v.get(&staff_id).cloned());
    let field = |k: &str| {
        entry
            .as_ref()
            .and_then(|e| e.get(k))
            .and_then(|v| v.as_str())
            .map(str::to_string)
    };
    Ok(Some(profile.signature_lines_for(
        &name,
        field("title").as_deref(),
        field("professionalId").as_deref(),
    )))
}
