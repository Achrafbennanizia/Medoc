//! Create/update Treatment & Examination with FA-LEIST-06/07 and FA-AUFG-02 side effects.

use crate::application::rbac::Role;
use crate::domain::entities::treatment::{
    Treatment, CreateTreatment, CreateExamination, Examination, UpdateTreatment,
    UpdateExamination,
};
use crate::error::AppError;
use crate::infrastructure::database::{chart_repo, audit_repo, practice_task_repo, payment_repo};
use sqlx::SqlitePool;

pub async fn patient_id_for_clinical_line(
    pool: &SqlitePool,
    treatment_id: Option<&str>,
    examination_id: Option<&str>,
) -> Result<Option<String>, AppError> {
    if let Some(bid) = treatment_id {
        return sqlx::query_scalar(
            "SELECT a.patient_id FROM treatment b
             INNER JOIN patient_chart a ON b.chart_id = a.id WHERE b.id = ?1",
        )
        .bind(bid)
        .fetch_optional(pool)
        .await
        .map_err(Into::into);
    }
    if let Some(uid) = examination_id {
        return sqlx::query_scalar(
            "SELECT a.patient_id FROM examination u
             INNER JOIN patient_chart a ON u.chart_id = a.id WHERE u.id = ?1",
        )
        .bind(uid)
        .fetch_optional(pool)
        .await
        .map_err(Into::into);
    }
    Ok(None)
}

async fn after_examination_saved(pool: &SqlitePool, user_id: &str, role: &str, u: &Examination) {
    if crate::domain::services::pricing::treatment_has_billable_service_item(
        u.service_name.as_deref(),
        u.total_cost,
    ) {
        if let Err(e) =
            payment_repo::ensure_open_booking_for_billable_examination(pool, &u.id, user_id).await
        {
            tracing::warn!(
                error = ?e,
                examination_id = %u.id,
                "FA-LEIST-06/07 open booking (Examination) skipped",
            );
        }
        if Role::parse(role) == Some(Role::Physician) {
            if let Ok(Some(pid)) = patient_id_for_clinical_line(pool, None, Some(&u.id)).await {
                if let Err(e) = practice_task_repo::ensure_billing_task_for_clinical_line(
                    pool,
                    &pid,
                    user_id,
                    u.service_name.as_deref(),
                    u.total_cost,
                    None,
                    Some(&u.id),
                )
                .await
                {
                    tracing::warn!(
                        error = ?e,
                        examination_id = %u.id,
                        "FA-AUFG-02 auto BILLING (Examination) skipped",
                    );
                }
            }
        }
    } else if let Err(e) = payment_repo::ensure_placeholder_for_examination(pool, &u.id).await {
        tracing::warn!(
            error = ?e,
            examination_id = %u.id,
            "open-payment placeholder (Examination) skipped",
        );
    }
}

async fn after_treatment_saved(pool: &SqlitePool, user_id: &str, role: &str, b: &Treatment) {
    if crate::domain::services::pricing::treatment_has_billable_service_item(
        b.service_name.as_deref(),
        b.total_cost,
    ) {
        if let Err(e) =
            payment_repo::ensure_open_booking_for_billable_treatment(pool, &b.id, user_id).await
        {
            tracing::warn!(
                error = ?e,
                treatment_id = %b.id,
                "FA-LEIST-06 open booking (Treatment) skipped",
            );
        }
        if Role::parse(role) == Some(Role::Physician) {
            if let Ok(Some(pid)) = patient_id_for_clinical_line(pool, Some(&b.id), None).await {
                if let Err(e) = practice_task_repo::ensure_billing_task_for_clinical_line(
                    pool,
                    &pid,
                    user_id,
                    b.service_name.as_deref(),
                    b.total_cost,
                    Some(&b.id),
                    None,
                )
                .await
                {
                    tracing::warn!(
                        error = ?e,
                        treatment_id = %b.id,
                        "FA-AUFG-02 auto BILLING (Treatment) skipped",
                    );
                }
            }
        }
    }
}

pub async fn create_examination(
    pool: &SqlitePool,
    user_id: &str,
    role: &str,
    data: &CreateExamination,
) -> Result<Examination, AppError> {
    let u = chart_repo::create_examination(pool, data).await?;
    after_examination_saved(pool, user_id, role, &u).await;
    audit_repo::create(pool, user_id, "CREATE", "Examination", Some(&u.id), None)
        .await
        .ok();
    Ok(u)
}

pub async fn create_treatment(
    pool: &SqlitePool,
    user_id: &str,
    role: &str,
    data: &CreateTreatment,
) -> Result<Treatment, AppError> {
    let b = chart_repo::create_treatment(pool, data).await?;
    after_treatment_saved(pool, user_id, role, &b).await;
    audit_repo::create(pool, user_id, "CREATE", "Treatment", Some(&b.id), None)
        .await
        .ok();
    Ok(b)
}

pub async fn update_treatment(
    pool: &SqlitePool,
    user_id: &str,
    role: &str,
    data: &UpdateTreatment,
) -> Result<Treatment, AppError> {
    let b = chart_repo::update_treatment(pool, data).await?;
    after_treatment_saved(pool, user_id, role, &b).await;
    audit_repo::create(pool, user_id, "UPDATE", "Treatment", Some(&b.id), None)
        .await
        .ok();
    Ok(b)
}

pub async fn update_examination(
    pool: &SqlitePool,
    user_id: &str,
    role: &str,
    data: &UpdateExamination,
) -> Result<Examination, AppError> {
    let u = chart_repo::update_examination(pool, data).await?;
    if crate::domain::services::pricing::treatment_has_billable_service_item(
        u.service_name.as_deref(),
        u.total_cost,
    ) {
        if let Err(e) =
            payment_repo::ensure_open_booking_for_billable_examination(pool, &u.id, user_id).await
        {
            tracing::warn!(
                error = ?e,
                examination_id = %u.id,
                "FA-LEIST-06 open booking (Examination update) skipped",
            );
        }
        if Role::parse(role) == Some(Role::Physician) {
            if let Ok(Some(pid)) = patient_id_for_clinical_line(pool, None, Some(&u.id)).await {
                let _ = practice_task_repo::ensure_billing_task_for_clinical_line(
                    pool,
                    &pid,
                    user_id,
                    u.service_name.as_deref(),
                    u.total_cost,
                    None,
                    Some(&u.id),
                )
                .await;
            }
        }
    }
    audit_repo::create(pool, user_id, "UPDATE", "Examination", Some(&u.id), None)
        .await
        .ok();
    Ok(u)
}

pub async fn delete_treatment(pool: &SqlitePool, user_id: &str, id: &str) -> Result<(), AppError> {
    chart_repo::delete_treatment(pool, id).await?;
    audit_repo::create(pool, user_id, "DELETE", "Treatment", Some(id), None)
        .await
        .ok();
    Ok(())
}

pub async fn delete_examination(
    pool: &SqlitePool,
    user_id: &str,
    id: &str,
) -> Result<(), AppError> {
    chart_repo::delete_examination(pool, id).await?;
    audit_repo::create(pool, user_id, "DELETE", "Examination", Some(id), None)
        .await
        .ok();
    Ok(())
}
