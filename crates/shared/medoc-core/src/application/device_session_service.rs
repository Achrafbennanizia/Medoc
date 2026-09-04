//! Application orchestration for device sessions (list, investigate, revoke).
use crate::domain::entities::AuditLog;
use crate::domain::services::device_session_peer;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::repos::admin::device_session::{
    self, DeviceSessionAuditEntry, DeviceSessionInvestigation, DeviceSessionRow,
};
use sqlx::SqlitePool;

const INVESTIGATION_LOGIN_LIMIT: i64 = 12;

pub struct OpenDeviceSession {
    pub id: String,
    pub reused: bool,
}

/// Reuse an active session from the same IP (reconnect). Otherwise create a new row.
pub async fn open_or_reuse(
    pool: &SqlitePool,
    user_id: &str,
    device_label: &str,
    user_agent: Option<&str>,
    peer_ip: &str,
) -> Result<OpenDeviceSession, AppError> {
    let peer = device_session_peer::normalize_peer_ip(peer_ip);
    if let Some(existing) = device_session::find_active_by_peer(pool, user_id, &peer).await? {
        device_session::touch_reconnect(
            pool,
            &existing,
            device_label,
            user_agent,
            Some(peer.as_str()),
        )
        .await?;
        let _ = device_session::end_other_same_peer(pool, user_id, &existing, &peer).await?;
        return Ok(OpenDeviceSession {
            id: existing,
            reused: true,
        });
    }
    let id = uuid::Uuid::new_v4().to_string();
    device_session::insert(
        pool,
        &id,
        user_id,
        device_label,
        user_agent,
        Some(peer.as_str()),
    )
    .await?;
    Ok(OpenDeviceSession { id, reused: false })
}

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
        .ok_or_else(|| AppError::NotFound("error.entity.device_session".into()))?;

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
            "DEVICE_SESSION_RECONNECT",
            "DEVICE_SESSION_NEW",
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
        .ok_or_else(|| AppError::NotFound("error.entity.device_session".into()))?;

    if session.is_current {
        return Err(AppError::validation_code(
            "error.device_session.cannot_revoke_current",
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
            .ok_or_else(|| AppError::NotFound("error.entity.device_session".into()))?;

    if existing.is_current {
        return Err(AppError::validation_code(
            "error.device_session.current_already_trusted",
        ));
    }

    let updated = device_session::set_trusted(pool, user_id, session_id, trusted).await?;
    if !updated {
        return Err(AppError::NotFound("error.entity.device_session".into()));
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
        .ok_or_else(|| AppError::NotFound("error.entity.device_session".into()))
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
