//! Who a new record belongs to (Group, docs/architecture/editions-plan.md §4.1, §4.5, §5.1).
//!
//! The owner columns exist in every edition (T3.6); Group fills them on create because its
//! sharing rules, per-doctor filters and signature blocks key on them. Solo and Duo have one
//! dentist and leave them empty (the `if` is a constant, so nothing runs there).
//!
//! Signing doctor (§5.1, Q3): an admin dentist who issues a document signs it; when someone else
//! prepares it, the doctor chosen at request time signs; without a choice, the patient's treating
//! doctor. Existing values are never overwritten (`COALESCE`).

use sqlx::SqlitePool;

use medoc_core::application::auth_service::Session;

use crate::application::rbac::Role;
use crate::error::AppError;

fn enabled() -> bool {
    medoc_core::edition::CORE_CAPS.multi_doctor
}

fn is_doctor(session: &Session) -> bool {
    Role::parse(&session.role) == Some(Role::Physician)
}

async fn is_physician(pool: &SqlitePool, staff_id: Option<&str>) -> bool {
    let Some(id) = staff_id.filter(|s| !s.trim().is_empty()) else {
        return false;
    };
    sqlx::query_scalar::<_, String>("SELECT role FROM staff WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .is_some_and(|r| Role::parse(&r) == Some(Role::Physician))
}

async fn treating_doctor(pool: &SqlitePool, patient_id: &str) -> Option<String> {
    sqlx::query_scalar::<_, Option<String>>("SELECT treating_staff_id FROM patient WHERE id = ?1")
        .bind(patient_id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .flatten()
        .filter(|s| !s.is_empty())
}

/// §5.1: the doctor printed in the signature block.
pub async fn signing_doctor(
    pool: &SqlitePool,
    session: &Session,
    patient_id: &str,
    chosen: Option<&str>,
) -> Option<String> {
    if is_doctor(session) {
        return Some(session.user_id.clone());
    }
    match chosen.filter(|c| !c.trim().is_empty()) {
        Some(c) => Some(c.to_string()),
        None => treating_doctor(pool, patient_id).await,
    }
}

async fn local_device(pool: &SqlitePool) -> Option<String> {
    #[cfg(feature = "cap-net")]
    {
        let label = medoc_sync::repo::load_deployment(pool)
            .await
            .map(|d| d.device_label)
            .unwrap_or_default();
        medoc_sync::repo::ensure_local_device(pool, &label)
            .await
            .ok()
    }
    #[cfg(not(feature = "cap-net"))]
    {
        let _ = pool;
        None
    }
}

/// Fill the owner columns of a row this session just created, then queue the row again so the
/// columns reach the other devices. `doctor` is the doctor the form named (if any).
pub async fn stamp_created(
    pool: &SqlitePool,
    session: &Session,
    table: &'static str,
    id: &str,
    doctor: Option<&str>,
) -> Result<(), AppError> {
    if !enabled() {
        return Ok(());
    }
    let me = session.user_id.as_str();
    let doctor = doctor.filter(|d| !d.trim().is_empty());
    let device = local_device(pool).await;
    let id_s = Some(id.to_string());
    let me_s = Some(me.to_string());
    // Each statement binds ?1.. in order; the row id is always last.
    let (sql, binds): (&str, Vec<Option<String>>) = match table {
        "examination" | "treatment" => {
            // Responsible doctor: the doctor who writes it, else the form's choice, else the
            // patient's treating doctor.
            let chart_patient: Option<String> = sqlx::query_scalar(&format!(
                "SELECT c.patient_id FROM {table} t JOIN patient_chart c ON c.id = t.chart_id WHERE t.id = ?1"
            ))
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;
            let responsible = match (is_doctor(session), doctor, chart_patient) {
                (true, _, _) => me_s.clone(),
                (false, Some(d), _) => Some(d.to_string()),
                (false, None, Some(p)) => treating_doctor(pool, &p).await,
                _ => None,
            };
            (
                if table == "examination" {
                    "UPDATE examination SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), responsible_staff_id = COALESCE(responsible_staff_id, ?1),
                        created_by = COALESCE(created_by, ?2), device_id = COALESCE(device_id, ?3) WHERE id = ?4"
                } else {
                    "UPDATE treatment SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), responsible_staff_id = COALESCE(responsible_staff_id, ?1),
                        created_by = COALESCE(created_by, ?2), device_id = COALESCE(device_id, ?3) WHERE id = ?4"
                },
                vec![responsible, me_s, device, id_s],
            )
        }
        "payment" => {
            // For which doctor: the form's choice, else the doctor of the treatment it pays.
            let of_treatment: Option<String> = sqlx::query_scalar(
                "SELECT t.responsible_staff_id FROM payment p JOIN treatment t ON t.id = p.treatment_id WHERE p.id = ?1",
            )
            .bind(id)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten()
            .flatten();
            (
                "UPDATE payment SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), for_staff_id = COALESCE(for_staff_id, ?1), created_by = COALESCE(created_by, ?2),
                    collected_by = COALESCE(collected_by, ?2), device_id = COALESCE(device_id, ?3) WHERE id = ?4",
                vec![doctor.map(str::to_string).or(of_treatment), me_s, device, id_s],
            )
        }
        "prescription" | "certificate" => {
            let patient: Option<String> =
                sqlx::query_scalar(&format!("SELECT patient_id FROM {table} WHERE id = ?1"))
                    .bind(id)
                    .fetch_optional(pool)
                    .await
                    .map_err(AppError::Database)?;
            let signer = match patient {
                Some(p) => signing_doctor(pool, session, &p, doctor).await,
                None => None,
            };
            (
                if table == "prescription" {
                    "UPDATE prescription SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), signed_by_staff_id = COALESCE(signed_by_staff_id, ?1),
                        requested_by_staff_id = COALESCE(requested_by_staff_id, ?2) WHERE id = ?3"
                } else {
                    "UPDATE certificate SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), signed_by_staff_id = COALESCE(signed_by_staff_id, ?1),
                        requested_by_staff_id = COALESCE(requested_by_staff_id, ?2) WHERE id = ?3"
                },
                vec![signer, me_s, id_s],
            )
        }
        "appointment" => (
            // A patient's first booked doctor becomes their treating doctor (§5.1 default).
            "UPDATE patient SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), treating_staff_id = ?1
             WHERE id = (SELECT patient_id FROM appointment WHERE id = ?2)
               AND (treating_staff_id IS NULL OR treating_staff_id = '') AND ?1 IS NOT NULL",
            vec![doctor.map(str::to_string), id_s],
        ),
        "practice_task" => {
            // Owner: the dentist who created it, else the assignee when a dentist, else the
            // doctor the form named. Never a non-dentist (an assistant is not an owner).
            let assignee: Option<String> =
                sqlx::query_scalar("SELECT assignee_user_id FROM practice_task WHERE id = ?1")
                    .bind(id)
                    .fetch_optional(pool)
                    .await
                    .ok()
                    .flatten()
                    .flatten();
            let owner = if is_doctor(session) {
                me_s.clone()
            } else if is_physician(pool, assignee.as_deref()).await {
                assignee
            } else if is_physician(pool, doctor).await {
                doctor.map(str::to_string)
            } else {
                None
            };
            (
                "UPDATE practice_task SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), doctor_id = COALESCE(doctor_id, ?1) WHERE id = ?2 AND ?1 IS NOT NULL",
                vec![owner, id_s],
            )
        }
        "purchase_order" => (
            // Ordered for: the form's choice (CreatePurchaseOrder), else the dentist who placed it.
            // paid_by / approved_by come from the form when set; this stamp only fills ordered_for.
            "UPDATE purchase_order SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
                ordered_for_staff_id = COALESCE(ordered_for_staff_id, ?1)
             WHERE id = ?2 AND ?1 IS NOT NULL",
            vec![
                doctor.map(str::to_string).or_else(|| is_doctor(session).then(|| me.to_string())),
                id_s,
            ],
        ),
        _ => return Ok(()),
    };
    let mut q = sqlx::query(sql);
    for b in &binds {
        q = q.bind(b);
    }
    let done = q.execute(pool).await.map_err(AppError::Database)?;
    if done.rows_affected() > 0 {
        let (synced_table, synced_id) = if table == "appointment" {
            let patient: Option<String> =
                sqlx::query_scalar("SELECT patient_id FROM appointment WHERE id = ?1")
                    .bind(id)
                    .fetch_optional(pool)
                    .await
                    .map_err(AppError::Database)?;
            ("patient", patient.unwrap_or_default())
        } else {
            (table, id.to_string())
        };
        medoc_core::infrastructure::database::sync_outbox::record_or_noop(
            pool,
            synced_table,
            &synced_id,
            "UPDATE",
            "",
        )
        .await?;
    }
    Ok(())
}
