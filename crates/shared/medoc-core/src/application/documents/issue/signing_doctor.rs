//! Signing doctor's block on prescriptions and certificates (editions-plan §5.1, T5.7).

use serde_json::Value;
use sqlx::SqlitePool;

use super::super::practice_profile::PracticeProfile;
use super::DocKind;
use crate::application::auth_service::Session;
use crate::application::rbac::Role;
use crate::error::AppError;
use crate::infrastructure::pdf::ReportPdfInput;

/// Per-doctor data printed in a signature block (§5.1): `{ "<staff id>": { "title", "professionalId" } }`.
pub const DOCTOR_SIGNATURES_KV_KEY: &str = "documents.doctor_signatures.v1";

fn multi_doctor() -> bool {
    crate::edition::CORE_CAPS.multi_doctor
}

async fn staff_name(pool: &SqlitePool, staff_id: &str) -> Result<Option<(String, String)>, AppError> {
    let row: Option<(String, String)> = sqlx::query_as("SELECT id, name FROM staff WHERE id = ?1")
        .bind(staff_id)
        .fetch_optional(pool)
        .await?;
    Ok(row.filter(|(_, n)| !n.trim().is_empty()))
}

async fn kv_fields(pool: &SqlitePool, staff_id: &str) -> (Option<String>, Option<String>) {
    let entry = crate::infrastructure::database::repos::admin::app_kv::get(
        pool,
        DOCTOR_SIGNATURES_KV_KEY,
    )
    .await
    .ok()
    .flatten()
    .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
    .and_then(|v| v.get(staff_id).cloned());
    let field = |k: &str| {
        entry
            .as_ref()
            .and_then(|e| e.get(k))
            .and_then(|v| v.as_str())
            .map(str::to_string)
    };
    (field("title"), field("professionalId"))
}

fn signature_lines(
    profile: &PracticeProfile,
    name: &str,
    title: Option<&str>,
    professional_id: Option<&str>,
) -> Option<Vec<String>> {
    let practice_clinician = profile.clinician_name.as_deref().unwrap_or("").trim();
    if name.trim().eq_ignore_ascii_case(practice_clinician) {
        return None;
    }
    Some(profile.signature_lines_for(
        name,
        title,
        professional_id,
    ))
}

async fn lines_for_staff_id(
    pool: &SqlitePool,
    staff_id: &str,
    profile: &PracticeProfile,
) -> Result<Option<Vec<String>>, AppError> {
    if !multi_doctor() {
        return Ok(None);
    }
    let Some((_, name)) = staff_name(pool, staff_id).await? else {
        return Ok(None);
    };
    let (title, professional_id) = kv_fields(pool, staff_id).await;
    Ok(signature_lines(
        profile,
        &name,
        title.as_deref(),
        professional_id.as_deref(),
    ))
}

/// Signature block of the document's signing doctor (`signed_by_staff_id`, set in Group), when that
/// doctor is not the practice's own clinician. `None` keeps the practice block, which is what Solo
/// and Duo always get: they never stamp a signing doctor.
pub(super) async fn signing_doctor_lines(
    pool: &SqlitePool,
    kind: DocKind,
    source_id: &str,
    profile: &PracticeProfile,
) -> Result<Option<Vec<String>>, AppError> {
    if !multi_doctor() {
        return Ok(None);
    }
    let first = source_id.split(',').next().unwrap_or("").trim();
    if first.is_empty() {
        return Ok(None);
    }
    let staff_id: Option<String> = match kind {
        DocKind::Prescription => sqlx::query_scalar(
            "SELECT signed_by_staff_id FROM prescription WHERE id = ?1",
        )
        .bind(first)
        .fetch_optional(pool)
        .await?,
        DocKind::Certificate => sqlx::query_scalar(
            "SELECT signed_by_staff_id FROM certificate WHERE id = ?1",
        )
        .bind(first)
        .fetch_optional(pool)
        .await?,
        DocKind::Report | DocKind::ChartExtract => sqlx::query_scalar(
            "SELECT signed_by_staff_id FROM issued_document WHERE id = ?1",
        )
        .bind(first)
        .fetch_optional(pool)
        .await?,
        _ => return Ok(None),
    };
    let Some(staff_id) = staff_id.filter(|s| !s.trim().is_empty()) else {
        return Ok(None);
    };
    lines_for_staff_id(pool, &staff_id, profile).await
}

pub(super) async fn signing_doctor_lines_for_staff_id(
    pool: &SqlitePool,
    staff_id: &str,
    profile: &PracticeProfile,
) -> Result<Option<Vec<String>>, AppError> {
    lines_for_staff_id(pool, staff_id, profile).await
}

pub(super) async fn treating_staff_id_for_patient(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<Option<String>, AppError> {
    Ok(sqlx::query_scalar::<_, Option<String>>(
        "SELECT treating_staff_id FROM patient WHERE id = ?1",
    )
    .bind(patient_id)
    .fetch_optional(pool)
    .await?
    .flatten()
    .filter(|s| !s.trim().is_empty()))
}

/// §5.1: who signs when a document is issued (physician issuer, else the patient's treating doctor).
pub(super) async fn issuer_signing_staff_id(
    pool: &SqlitePool,
    session: &Session,
    patient_id: Option<&str>,
) -> Result<Option<String>, AppError> {
    if !multi_doctor() {
        return Ok(None);
    }
    if Role::parse(&session.role) == Some(Role::Physician) {
        return Ok(Some(session.user_id.clone()));
    }
    if let Some(pid) = patient_id {
        return treating_staff_id_for_patient(pool, pid).await;
    }
    Ok(None)
}

pub(crate) async fn apply_report_signing(
    pool: &SqlitePool,
    session: &Session,
    patient_id: Option<&str>,
    profile: &PracticeProfile,
    input: &mut ReportPdfInput,
) -> Result<Option<String>, AppError> {
    let signer = issuer_signing_staff_id(pool, session, patient_id).await?;
    if let Some(ref sid) = signer {
        if let Some(lines) = signing_doctor_lines_for_staff_id(pool, sid, profile).await? {
            input.signing_doctor_lines = lines;
        }
    }
    Ok(signer)
}

/// Fills invoice clinician name / professional id from the patient's treating doctor (Cabinet+).
pub(super) async fn fill_invoice_treating_clinician(
    pool: &SqlitePool,
    patient_id: &str,
    profile: &PracticeProfile,
    clinician_name: &mut Option<String>,
    clinician_zanr: &mut Option<String>,
) -> Result<Option<String>, AppError> {
    if !multi_doctor() {
        return Ok(None);
    }
    let Some(tid) = treating_staff_id_for_patient(pool, patient_id).await? else {
        return Ok(None);
    };
    let Some((_, name)) = staff_name(pool, &tid).await? else {
        return Ok(None);
    };
    let practice_clinician = profile.clinician_name.as_deref().unwrap_or("").trim();
    if name.trim().eq_ignore_ascii_case(practice_clinician) {
        return Ok(Some(tid));
    }
    let (_, professional_id) = kv_fields(pool, &tid).await;
    *clinician_name = Some(name);
    *clinician_zanr = professional_id.filter(|s| !s.trim().is_empty());
    Ok(Some(tid))
}

pub(crate) async fn stamp_issued_document_signed_by(
    pool: &SqlitePool,
    document_id: &str,
    staff_id: Option<&str>,
) -> Result<(), AppError> {
    if !multi_doctor() {
        return Ok(());
    }
    let Some(sid) = staff_id.filter(|s| !s.trim().is_empty()) else {
        return Ok(());
    };
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%fZ").to_string();
    // The insert was queued before this stamp, so queue the row again or the signer never
    // reaches the other devices (H2 guard, `recorded_write_guard`).
    let stamped = sqlx::query(
        "UPDATE issued_document SET signed_by_staff_id = ?1, updated_at = ?2 WHERE id = ?3 AND signed_by_staff_id IS NULL",
    )
    .bind(sid)
    .bind(&now)
    .bind(document_id)
    .execute(pool)
    .await?
    .rows_affected();
    if stamped > 0 {
        crate::infrastructure::database::sync_outbox::record_or_noop(
            pool,
            "issued_document",
            document_id,
            "UPDATE",
            "",
        )
        .await?;
    }
    // Finance-list mirror: stamp signer + updated_at and re-queue so replicas get it too.
    let inv = sqlx::query(
        "UPDATE invoice_document SET signed_by_staff_id = COALESCE(signed_by_staff_id, ?1), updated_at = ?2 WHERE id = ?3",
    )
    .bind(sid)
    .bind(&now)
    .bind(document_id)
    .execute(pool)
    .await
    .map(|r| r.rows_affected())
    .unwrap_or(0);
    if inv > 0 {
        crate::infrastructure::database::sync_outbox::record_or_noop(
            pool,
            "invoice_document",
            document_id,
            "UPDATE",
            "",
        )
        .await
        .ok();
    }
    Ok(())
}