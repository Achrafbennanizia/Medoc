//! Application orchestration for Gerätesitzungen (list, investigate, revoke).
use crate::domain::entities::AuditLog;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::repos::admin::device_session::{
    self, DeviceSessionAuditEntry, DeviceSessionInvestigation, DeviceSessionRow,
};
use sqlx::SqlitePool;

const INVESTIGATION_LOGIN_LIMIT: i64 = 12;

pub async fn list_enriched_for_user(
    pool: &SqlitePool,
    user_id: &str,
    current_id: Option<&str>,
) -> Result<Vec<DeviceSessionRow>, AppError> {
    device_session::list_active_for_user(pool, user_id, current_id).await
}

pub async fn investigate_session(
    pool: &SqlitePool,
    user_id: &str,
    session_id: &str,
    current_id: Option<&str>,
) -> Result<DeviceSessionInvestigation, AppError> {
    let session = device_session::find_active_for_user_by_id(pool, user_id, session_id, current_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Gerätesitzung nicht gefunden".into()))?;

    let all = device_session::list_active_for_user(pool, user_id, current_id).await?;
    let label = session.device_label.trim();
    let same_device_label_count = if label.is_empty() {
        0
    } else {
        all.iter()
            .filter(|s| s.device_label.trim() == label)
            .count()
    };

    let audits = audit_repo::find_recent_for_user_actions(
        pool,
        user_id,
        &[
            "LOGIN",
            "LOGOUT",
            "DEVICE_SESSION_REVOKE",
            "DEVICE_SESSION_INVESTIGATE",
            "DEVICE_SESSION_TRUST",
            "DEVICE_SESSION_UNTRUST",
        ],
        INVESTIGATION_LOGIN_LIMIT,
    )
    .await?;

    Ok(DeviceSessionInvestigation {
        active_session_count: all.len(),
        same_device_label_count,
        recent_logins: map_audit_entries(&audits),
        session,
    })
}

pub async fn revoke_session(
    pool: &SqlitePool,
    user_id: &str,
    session_id: &str,
    current_id: Option<&str>,
) -> Result<(), AppError> {
    let session = device_session::find_active_for_user_by_id(pool, user_id, session_id, current_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Gerätesitzung nicht gefunden".into()))?;

    if session.is_current {
        return Err(AppError::Validation(
            "Die aktuelle Sitzung kann hier nicht beendet werden — bitte abmelden.".into(),
        ));
    }

    device_session::end(pool, session_id).await?;

    audit_repo::create(
        pool,
        user_id,
        "DEVICE_SESSION_REVOKE",
        "DeviceSession",
        Some(session_id),
        Some(&format!(
            "label={}; suspected={}",
            session.device_label, session.is_suspected
        )),
    )
    .await?;

    Ok(())
}

pub async fn set_session_trusted(
    pool: &SqlitePool,
    user_id: &str,
    session_id: &str,
    current_id: Option<&str>,
    trusted: bool,
) -> Result<DeviceSessionRow, AppError> {
    let existing =
        device_session::find_active_for_user_by_id(pool, user_id, session_id, current_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Gerätesitzung nicht gefunden".into()))?;

    if existing.is_current {
        return Err(AppError::Validation(
            "Die aktuelle Sitzung ist bereits vertrauenswürdig.".into(),
        ));
    }

    let updated = device_session::set_trusted(pool, user_id, session_id, trusted).await?;
    if !updated {
        return Err(AppError::NotFound("Gerätesitzung nicht gefunden".into()));
    }

    audit_repo::create(
        pool,
        user_id,
        if trusted {
            "DEVICE_SESSION_TRUST"
        } else {
            "DEVICE_SESSION_UNTRUST"
        },
        "DeviceSession",
        Some(session_id),
        Some(&format!("label={}", existing.device_label)),
    )
    .await?;

    device_session::find_active_for_user_by_id(pool, user_id, session_id, current_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Gerätesitzung nicht gefunden".into()))
}

fn map_audit_entries(rows: &[AuditLog]) -> Vec<DeviceSessionAuditEntry> {
    rows.iter()
        .map(|r| DeviceSessionAuditEntry {
            id: r.id.clone(),
            action: r.action.clone(),
            created_at: r.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
            details: r.details.clone(),
        })
        .collect()
}
