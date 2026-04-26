// Break-glass commands.

use serde::Serialize;
use sqlx::SqlitePool;
use std::time::Instant;
use tauri::State;

use crate::application::break_glass::{BreakGlassGrant, BreakGlassState};
use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::log_security;

pub struct BreakGlassStateExt(pub BreakGlassState);

#[derive(Debug, Serialize)]
pub struct BreakGlassEntry {
    pub user_id: String,
    pub reason: String,
    pub patient_id: Option<String>,
    pub elapsed_secs: u64,
}

#[tauri::command]
#[tracing::instrument(level = "warn", skip(pool, session_state, bg, reason))]
pub async fn break_glass_activate(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    bg: State<'_, BreakGlassStateExt>,
    reason: String,
    patient_id: Option<String>,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.read_medical")?;
    if reason.trim().len() < 10 {
        return Err(AppError::Validation(
            "Begründung muss mindestens 10 Zeichen lang sein".into(),
        ));
    }
    log_security!(error,
        event = "BREAK_GLASS_ACTIVATED",
        user_id = %session.user_id,
        patient_id = ?patient_id,
        reason = %reason,
    );
    audit_repo::create(
        &pool,
        &session.user_id,
        "BREAK_GLASS",
        "Patient",
        patient_id.as_deref(),
        Some(&reason),
    )
    .await
    .ok();
    bg.0.grant(BreakGlassGrant {
        user_id: session.user_id,
        reason,
        patient_id,
        granted_at: Instant::now(),
    });
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, bg))]
pub fn break_glass_active(
    session_state: State<'_, SessionState>,
    bg: State<'_, BreakGlassStateExt>,
) -> Result<Vec<BreakGlassEntry>, AppError> {
    rbac::require(&session_state, "patient.read_medical")?;
    Ok(bg
        .0
        .list()
        .into_iter()
        .map(|g| BreakGlassEntry {
            user_id: g.user_id,
            reason: g.reason,
            patient_id: g.patient_id,
            elapsed_secs: g.granted_at.elapsed().as_secs(),
        })
        .collect())
}
