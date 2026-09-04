//! Browser / desktop device sessions per staff member (team view in settings).
use crate::error::AppError;
use serde::Serialize;
use sqlx::{Row, SqlitePool};

#[derive(Debug, Clone, Serialize)]
pub struct DeviceSessionRow {
    pub id: String,
    pub user_id: String,
    pub device_label: String,
    pub user_agent: Option<String>,
    #[serde(default)]
    pub peer_ip: Option<String>,
    pub created_at: String,
    pub last_seen_at: String,
    pub is_current: bool,
    #[serde(default)]
    pub is_trusted: bool,
    pub trusted_at: Option<String>,
    #[serde(default)]
    pub is_suspected: bool,
    #[serde(default)]
    pub suspected_reasons: Vec<String>,
}

impl crate::domain::services::device_session_risk::DeviceSessionRiskMut for DeviceSessionRow {
    fn set_risk(
        &mut self,
        assessment: crate::domain::services::device_session_risk::DeviceSessionRiskAssessment,
    ) {
        self.is_suspected = assessment.is_suspected;
        self.suspected_reasons = assessment.suspected_reasons;
    }
}

impl DeviceSessionRow {
    pub fn as_risk_input(
        &self,
    ) -> crate::domain::services::device_session_risk::DeviceSessionRiskInput {
        crate::domain::services::device_session_risk::DeviceSessionRiskInput {
            id: self.id.clone(),
            user_id: self.user_id.clone(),
            device_label: self.device_label.clone(),
            user_agent: self.user_agent.clone(),
            created_at: self.created_at.clone(),
            last_seen_at: self.last_seen_at.clone(),
            is_current: self.is_current,
            is_trusted: self.is_trusted,
        }
    }
}

fn row_from_sql(
    r: &sqlx::sqlite::SqliteRow,
    current_id: Option<&str>,
) -> Result<DeviceSessionRow, AppError> {
    let id: String = r.try_get("id").map_err(AppError::Database)?;
    let uid: String = r.try_get("user_id").map_err(AppError::Database)?;
    let device_label: String = r.try_get("device_label").map_err(AppError::Database)?;
    let user_agent: Option<String> = r.try_get("user_agent").ok();
    let peer_ip: Option<String> = r.try_get("peer_ip").ok();
    let created_at: String = r.try_get("created_at").map_err(AppError::Database)?;
    let last_seen_at: String = r.try_get("last_seen_at").map_err(AppError::Database)?;
    let trusted_at: Option<String> = r.try_get("trusted_at").ok();
    let is_trusted = trusted_at.as_ref().is_some_and(|s| !s.trim().is_empty());
    Ok(DeviceSessionRow {
        is_current: current_id.map(|c| c == id.as_str()).unwrap_or(false),
        id,
        user_id: uid,
        device_label,
        user_agent,
        peer_ip,
        created_at,
        last_seen_at,
        is_trusted,
        trusted_at,
        is_suspected: false,
        suspected_reasons: Vec::new(),
    })
}

#[derive(Debug, Clone, Serialize)]
pub struct DeviceSessionInvestigation {
    pub session: DeviceSessionRow,
    pub active_session_count: usize,
    pub same_device_label_count: usize,
    pub recent_logins: Vec<DeviceSessionAuditEntry>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeviceSessionAuditEntry {
    pub id: String,
    pub action: String,
    pub created_at: String,
    pub details: Option<String>,
}

pub async fn insert(
    pool: &SqlitePool,
    id: &str,
    user_id: &str,
    device_label: &str,
    user_agent: Option<&str>,
    peer_ip: Option<&str>,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO device_session (id, user_id, device_label, user_agent, peer_ip, created_at, last_seen_at, ended_at)
         VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'), datetime('now'), NULL)",
    )
    .bind(id)
    .bind(user_id)
    .bind(device_label)
    .bind(user_agent)
    .bind(peer_ip)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

/// Active session for this user from the same normalized peer (reconnect).
pub async fn find_active_by_peer(
    pool: &SqlitePool,
    user_id: &str,
    peer_ip: &str,
) -> Result<Option<String>, AppError> {
    let rows = sqlx::query(
        "SELECT id, peer_ip FROM device_session
         WHERE user_id = ?1 AND ended_at IS NULL
         ORDER BY last_seen_at DESC",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    let want = crate::domain::services::device_session_peer::normalize_peer_ip(peer_ip);
    for r in rows {
        let id: String = r.try_get("id").map_err(AppError::Database)?;
        let stored: Option<String> = r.try_get("peer_ip").ok();
        let key = crate::domain::services::device_session_peer::normalize_peer_ip(
            stored.as_deref().unwrap_or(""),
        );
        if key == want {
            return Ok(Some(id));
        }
    }
    Ok(None)
}

pub async fn touch_reconnect(
    pool: &SqlitePool,
    id: &str,
    device_label: &str,
    user_agent: Option<&str>,
    peer_ip: Option<&str>,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE device_session
         SET last_seen_at = datetime('now'),
             device_label = ?2,
             user_agent = ?3,
             peer_ip = ?4
         WHERE id = ?1 AND ended_at IS NULL",
    )
    .bind(id)
    .bind(device_label)
    .bind(user_agent)
    .bind(peer_ip)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

/// End extra active rows for the same peer so the list stays one device.
pub async fn end_other_same_peer(
    pool: &SqlitePool,
    user_id: &str,
    keep_id: &str,
    peer_ip: &str,
) -> Result<u64, AppError> {
    let rows = sqlx::query(
        "SELECT id, peer_ip FROM device_session
         WHERE user_id = ?1 AND ended_at IS NULL AND id != ?2",
    )
    .bind(user_id)
    .bind(keep_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    let want = crate::domain::services::device_session_peer::normalize_peer_ip(peer_ip);
    let mut n = 0u64;
    for r in rows {
        let id: String = r.try_get("id").map_err(AppError::Database)?;
        let stored: Option<String> = r.try_get("peer_ip").ok();
        let key = crate::domain::services::device_session_peer::normalize_peer_ip(
            stored.as_deref().unwrap_or(""),
        );
        if key == want {
            end(pool, &id).await?;
            n += 1;
        }
    }
    Ok(n)
}

pub async fn touch(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE device_session SET last_seen_at = datetime('now') WHERE id = ?1 AND ended_at IS NULL",
    )
    .bind(id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

pub async fn end(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE device_session SET ended_at = datetime('now') WHERE id = ?1 AND ended_at IS NULL",
    )
    .bind(id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

/// Aktive Sitzungen (ended_at IS NULL) neueste zuerst.
pub async fn list_active_for_user(
    pool: &SqlitePool,
    user_id: &str,
    current_id: Option<&str>,
) -> Result<Vec<DeviceSessionRow>, AppError> {
    let rows = sqlx::query(
        "SELECT id, user_id, device_label, user_agent, peer_ip, created_at, last_seen_at, trusted_at
         FROM device_session
         WHERE user_id = ?1 AND ended_at IS NULL
         ORDER BY last_seen_at DESC",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    let mut out = Vec::with_capacity(rows.len());
    for r in rows {
        out.push(row_from_sql(&r, current_id)?);
    }
    out = crate::domain::services::device_session_peer::collapse_by_peer_ip(
        out,
        |s| {
            crate::domain::services::device_session_peer::normalize_peer_ip(
                s.peer_ip.as_deref().unwrap_or(""),
            )
        },
        |s| s.is_current,
    );
    crate::domain::services::device_session_risk::enrich_sessions(&mut out, |r| r.as_risk_input());
    Ok(out)
}

/// Active session owned by `user_id`, or None if missing / ended / foreign.
pub async fn find_active_for_user_by_id(
    pool: &SqlitePool,
    user_id: &str,
    session_id: &str,
    current_id: Option<&str>,
) -> Result<Option<DeviceSessionRow>, AppError> {
    let row = sqlx::query(
        "SELECT id, user_id, device_label, user_agent, peer_ip, created_at, last_seen_at, trusted_at
         FROM device_session
         WHERE id = ?1 AND user_id = ?2 AND ended_at IS NULL",
    )
    .bind(session_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;

    let Some(r) = row else {
        return Ok(None);
    };

    let mut session = row_from_sql(&r, current_id)?;

    let siblings = list_active_for_user(pool, user_id, current_id).await?;
    let inputs: Vec<_> = siblings.iter().map(|s| s.as_risk_input()).collect();
    let assessment = crate::domain::services::device_session_risk::assess_session(
        &session.as_risk_input(),
        &inputs,
        chrono::Utc::now().naive_utc(),
    );
    session.is_suspected = assessment.is_suspected;
    session.suspected_reasons = assessment.suspected_reasons;

    Ok(Some(session))
}

/// Mark or clear user trust for an active session they own.
pub async fn set_trusted(
    pool: &SqlitePool,
    user_id: &str,
    session_id: &str,
    trusted: bool,
) -> Result<bool, AppError> {
    let r = if trusted {
        sqlx::query(
            "UPDATE device_session SET trusted_at = datetime('now')
             WHERE id = ?1 AND user_id = ?2 AND ended_at IS NULL",
        )
        .bind(session_id)
        .bind(user_id)
        .execute(pool)
        .await
    } else {
        sqlx::query(
            "UPDATE device_session SET trusted_at = NULL
             WHERE id = ?1 AND user_id = ?2 AND ended_at IS NULL",
        )
        .bind(session_id)
        .bind(user_id)
        .execute(pool)
        .await
    }
    .map_err(AppError::Database)?;
    Ok(r.rows_affected() > 0)
}

pub async fn end_other_than(
    pool: &SqlitePool,
    user_id: &str,
    keep_id: &str,
) -> Result<u64, AppError> {
    let r = sqlx::query(
        "UPDATE device_session SET ended_at = datetime('now')
         WHERE user_id = ?1 AND ended_at IS NULL AND id != ?2",
    )
    .bind(user_id)
    .bind(keep_id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(r.rows_affected())
}
