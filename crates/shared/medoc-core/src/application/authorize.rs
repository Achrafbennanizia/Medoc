//! One authorization check for a desktop session or a LAN JWT.
//!
//! Loads the staff row, rejects an idle or unavailable account, applies
//! per-person overrides, and writes a READ audit row for medical reads.

use std::time::Duration;

use chrono::{DateTime, NaiveDateTime, Utc};
use sqlx::SqlitePool;

use crate::application::auth_service::Session;
use crate::application::rbac::{effective_allowed, Role};
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, device_session_repo, staff_permission_repo, staff_repo};

/// Same idle window as the desktop session clock.
pub const IDLE_TIMEOUT: Duration = Duration::from_secs(30 * 60);

/// Who is calling. `idle_for` is the desktop session clock. A LAN JWT leaves
/// it empty; the token expiry is checked before this function runs. When
/// `device_session_id` is set, the stored `last_seen_at` is the clock.
pub struct Caller {
    pub user_id: String,
    pub idle_for: Option<Duration>,
    pub device_session_id: Option<String>,
}

pub async fn authorize(
    pool: &SqlitePool,
    caller: &Caller,
    action: &str,
    audit_entity_id: Option<&str>,
) -> Result<Session, AppError> {
    if caller
        .idle_for
        .is_some_and(|idle| idle > IDLE_TIMEOUT)
    {
        return Err(AppError::Unauthorized);
    }
    if let Some(session_id) = caller.device_session_id.as_deref() {
        let row = device_session_repo::find_active_for_user_by_id(
            pool,
            &caller.user_id,
            session_id,
            Some(session_id),
        )
        .await?;
        let Some(row) = row else {
            return Err(AppError::Unauthorized);
        };
        if seen_is_idle(&row.last_seen_at, Utc::now()) {
            return Err(AppError::Unauthorized);
        }
    }

    let staff = staff_repo::find_by_id(pool, &caller.user_id)
        .await?
        .ok_or(AppError::Unauthorized)?;
    if !staff.available {
        return Err(AppError::Unauthorized);
    }
    let role = Role::parse(&staff.role).ok_or(AppError::Forbidden)?;
    let overrides = staff_permission_repo::list_for_staff(pool, &staff.id).await?;
    if !effective_allowed(action, role, &overrides) {
        return Err(AppError::Forbidden);
    }
    if is_medical_read(action) {
        audit_repo::create(
            pool,
            &staff.id,
            "READ",
            "patient",
            audit_entity_id.filter(|id| !id.trim().is_empty()),
            Some(action),
        )
        .await?;
    }
    Ok(Session {
        user_id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        permission_overrides: overrides,
        device_session_id: caller.device_session_id.clone(),
        token_version: staff.token_version,
    })
}

fn is_medical_read(action: &str) -> bool {
    matches!(
        action,
        "patient.read" | "patient.read_medical" | "patient.read_documents" | "appointment.read"
    )
}

fn seen_is_idle(last_seen: &str, now: DateTime<Utc>) -> bool {
    let parsed = NaiveDateTime::parse_from_str(last_seen.trim(), "%Y-%m-%d %H:%M:%S")
        .ok()
        .map(|naive| naive.and_utc())
        .or_else(|| {
            DateTime::parse_from_rfc3339(last_seen.trim())
                .ok()
                .map(|stamp| stamp.with_timezone(&Utc))
        });
    match parsed {
        Some(seen) => now.signed_duration_since(seen).num_seconds() > IDLE_TIMEOUT.as_secs() as i64,
        None => false,
    }
}
