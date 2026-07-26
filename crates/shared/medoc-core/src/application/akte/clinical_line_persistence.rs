//! Create/update Behandlung & Untersuchung with FA-LEIST-06/07 and FA-AUFG-02 side effects.

use crate::application::rbac::Role;
use crate::domain::entities::behandlung::{
    Behandlung, CreateBehandlung, CreateUntersuchung, Untersuchung, UpdateBehandlung,
    UpdateUntersuchung,
};
use crate::error::AppError;
use crate::infrastructure::database::{akte_repo, audit_repo, praxis_aufgabe_repo, zahlung_repo};
use crate::infrastructure::logging::workflow;
use sqlx::SqlitePool;

pub async fn patient_id_for_clinical_line(
    pool: &SqlitePool,
    behandlung_id: Option<&str>,
    untersuchung_id: Option<&str>,
) -> Result<Option<String>, AppError> {
    workflow::run_service_call_async(
        "application.akte.clinical_line_persistence",
        "patient_id_for_clinical_line",
        || async {
            if let Some(bid) = behandlung_id {
                return sqlx::query_scalar(
                    "SELECT a.patient_id FROM behandlung b
                     INNER JOIN patientenakte a ON b.akte_id = a.id WHERE b.id = ?1",
                )
                .bind(bid)
                .fetch_optional(pool)
                .await
                .map_err(Into::into);
            }
            if let Some(uid) = untersuchung_id {
                return sqlx::query_scalar(
                    "SELECT a.patient_id FROM untersuchung u
                     INNER JOIN patientenakte a ON u.akte_id = a.id WHERE u.id = ?1",
                )
                .bind(uid)
                .fetch_optional(pool)
                .await
                .map_err(Into::into);
            }
            Ok(None)
        },
    )
    .await
}

async fn after_untersuchung_saved(pool: &SqlitePool, user_id: &str, rolle: &str, u: &Untersuchung) {
    if crate::domain::services::pricing::behandlung_has_billable_leistung(
        u.leistungsname.as_deref(),
        u.gesamtkosten,
    ) {
        if let Err(e) =
            zahlung_repo::ensure_open_booking_for_billable_untersuchung(pool, &u.id, user_id).await
        {
            tracing::warn!(
                error = ?e,
                untersuchung_id = %u.id,
                "FA-LEIST-06/07 open booking (Untersuchung) skipped",
            );
        }
        if Role::parse(rolle) == Some(Role::Arzt) {
            if let Ok(Some(pid)) = patient_id_for_clinical_line(pool, None, Some(&u.id)).await {
                if let Err(e) = praxis_aufgabe_repo::ensure_abrechnung_aufgabe_for_clinical_line(
                    pool,
                    &pid,
                    user_id,
                    u.leistungsname.as_deref(),
                    u.gesamtkosten,
                    None,
                    Some(&u.id),
                )
                .await
                {
                    tracing::warn!(
                        error = ?e,
                        untersuchung_id = %u.id,
                        "FA-AUFG-02 auto ABRECHNUNG (Untersuchung) skipped",
                    );
                }
            }
        }
    } else if let Err(e) = zahlung_repo::ensure_placeholder_for_untersuchung(pool, &u.id).await {
        tracing::warn!(
            error = ?e,
            untersuchung_id = %u.id,
            "open-payment placeholder (Untersuchung) skipped",
        );
    }
}

async fn after_behandlung_saved(pool: &SqlitePool, user_id: &str, rolle: &str, b: &Behandlung) {
    if crate::domain::services::pricing::behandlung_has_billable_leistung(
        b.leistungsname.as_deref(),
        b.gesamtkosten,
    ) {
        if let Err(e) =
            zahlung_repo::ensure_open_booking_for_billable_behandlung(pool, &b.id, user_id).await
        {
            tracing::warn!(
                error = ?e,
                behandlung_id = %b.id,
                "FA-LEIST-06 open booking (Behandlung) skipped",
            );
        }
        if Role::parse(rolle) == Some(Role::Arzt) {
            if let Ok(Some(pid)) = patient_id_for_clinical_line(pool, Some(&b.id), None).await {
                if let Err(e) = praxis_aufgabe_repo::ensure_abrechnung_aufgabe_for_clinical_line(
                    pool,
                    &pid,
                    user_id,
                    b.leistungsname.as_deref(),
                    b.gesamtkosten,
                    Some(&b.id),
                    None,
                )
                .await
                {
                    tracing::warn!(
                        error = ?e,
                        behandlung_id = %b.id,
                        "FA-AUFG-02 auto ABRECHNUNG (Behandlung) skipped",
                    );
                }
            }
        }
    }
}

pub async fn create_untersuchung(
    pool: &SqlitePool,
    user_id: &str,
    rolle: &str,
    data: &CreateUntersuchung,
) -> Result<Untersuchung, AppError> {
    workflow::run_service_call_async(
        "application.akte.clinical_line_persistence",
        "create_untersuchung",
        || async {
            let u = akte_repo::create_untersuchung(pool, data).await?;
            after_untersuchung_saved(pool, user_id, rolle, &u).await;
            audit_repo::create(pool, user_id, "CREATE", "Untersuchung", Some(&u.id), None)
                .await
                .ok();
            Ok(u)
        },
    )
    .await
}

pub async fn create_behandlung(
    pool: &SqlitePool,
    user_id: &str,
    rolle: &str,
    data: &CreateBehandlung,
) -> Result<Behandlung, AppError> {
    workflow::run_service_call_async(
        "application.akte.clinical_line_persistence",
        "create_behandlung",
        || async {
            let b = akte_repo::create_behandlung(pool, data).await?;
            after_behandlung_saved(pool, user_id, rolle, &b).await;
            audit_repo::create(pool, user_id, "CREATE", "Behandlung", Some(&b.id), None)
                .await
                .ok();
            Ok(b)
        },
    )
    .await
}

pub async fn update_behandlung(
    pool: &SqlitePool,
    user_id: &str,
    rolle: &str,
    data: &UpdateBehandlung,
) -> Result<Behandlung, AppError> {
    workflow::run_service_call_async(
        "application.akte.clinical_line_persistence",
        "update_behandlung",
        || async {
            let b = akte_repo::update_behandlung(pool, data).await?;
            after_behandlung_saved(pool, user_id, rolle, &b).await;
            audit_repo::create(pool, user_id, "UPDATE", "Behandlung", Some(&b.id), None)
                .await
                .ok();
            Ok(b)
        },
    )
    .await
}

pub async fn update_untersuchung(
    pool: &SqlitePool,
    user_id: &str,
    rolle: &str,
    data: &UpdateUntersuchung,
) -> Result<Untersuchung, AppError> {
    workflow::run_service_call_async(
        "application.akte.clinical_line_persistence",
        "update_untersuchung",
        || async {
            let u = akte_repo::update_untersuchung(pool, data).await?;
            if crate::domain::services::pricing::behandlung_has_billable_leistung(
                u.leistungsname.as_deref(),
                u.gesamtkosten,
            ) {
                if let Err(e) = zahlung_repo::ensure_open_booking_for_billable_untersuchung(
                    pool, &u.id, user_id,
                )
                .await
                {
                    tracing::warn!(
                        error = ?e,
                        untersuchung_id = %u.id,
                        "FA-LEIST-06 open booking (Untersuchung update) skipped",
                    );
                }
                if Role::parse(rolle) == Some(Role::Arzt) {
                    if let Ok(Some(pid)) =
                        patient_id_for_clinical_line(pool, None, Some(&u.id)).await
                    {
                        let _ = praxis_aufgabe_repo::ensure_abrechnung_aufgabe_for_clinical_line(
                            pool,
                            &pid,
                            user_id,
                            u.leistungsname.as_deref(),
                            u.gesamtkosten,
                            None,
                            Some(&u.id),
                        )
                        .await;
                    }
                }
            }
            audit_repo::create(pool, user_id, "UPDATE", "Untersuchung", Some(&u.id), None)
                .await
                .ok();
            Ok(u)
        },
    )
    .await
}

pub async fn delete_behandlung(pool: &SqlitePool, user_id: &str, id: &str) -> Result<(), AppError> {
    workflow::run_service_call_async(
        "application.akte.clinical_line_persistence",
        "delete_behandlung",
        || async {
            akte_repo::delete_behandlung(pool, id).await?;
            audit_repo::create(pool, user_id, "DELETE", "Behandlung", Some(id), None)
                .await
                .ok();
            Ok(())
        },
    )
    .await
}

pub async fn delete_untersuchung(
    pool: &SqlitePool,
    user_id: &str,
    id: &str,
) -> Result<(), AppError> {
    workflow::run_service_call_async(
        "application.akte.clinical_line_persistence",
        "delete_untersuchung",
        || async {
            akte_repo::delete_untersuchung(pool, id).await?;
            audit_repo::create(pool, user_id, "DELETE", "Untersuchung", Some(id), None)
                .await
                .ok();
            Ok(())
        },
    )
    .await
}
