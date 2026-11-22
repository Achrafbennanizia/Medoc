//! Audit-chain integrity status and admin acknowledgement (TASK 2.5).

use serde::Serialize;
use sqlx::SqlitePool;
use std::sync::Arc;
use tauri::State;

use crate::application::audit_chain_guard::AuditChainGuard;
use crate::application::rbac;
use crate::commands::admin::auth::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::log_security;

pub struct AuditChainGuardExt(pub Arc<AuditChainGuard>);

fn guard_ref(ext: &AuditChainGuardExt) -> &AuditChainGuard {
    ext.0.as_ref()
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditChainStatusDto {
    pub broken_at: Option<String>,
    pub acknowledged: bool,
    pub blocks_ops: bool,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, guard))]
pub fn get_audit_chain_status(
    session_state: State<'_, SessionState>,
    guard: State<'_, AuditChainGuardExt>,
) -> Result<AuditChainStatusDto, AppError> {
    rbac::require_authenticated(&session_state)?;
    let g = guard_ref(&guard);
    Ok(AuditChainStatusDto {
        broken_at: g.broken_at(),
        acknowledged: g.acknowledged(),
        blocks_ops: g.blocks_ops(),
    })
}

#[tauri::command]
#[tracing::instrument(level = "warn", skip(pool, session_state, guard))]
pub async fn acknowledge_audit_chain_break(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    guard: State<'_, AuditChainGuardExt>,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "ops.audit_chain_ack")?;
    let g = guard_ref(&guard);
    let Some(broken) = g.broken_at() else {
        return Err(AppError::Validation(
            "Audit chain is intact — no acknowledgement needed".into(),
        ));
    };
    // F100: persist, and leave a trace in the audit log itself.
    crate::application::audit_chain_guard::save_ack(&pool, &broken, &session.user_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "AUDIT_CHAIN_ACK",
        "AuditLog",
        Some(&broken),
        None,
    )
    .await?;
    g.acknowledge();
    log_security!(error,
        event = "AUDIT_CHAIN_BREAK_ACKNOWLEDGED",
        user_id = %session.user_id,
        broken_at = ?g.broken_at(),
    );
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditChainRepairResult {
    pub deleted_rows: u64,
    pub chain_ok: bool,
    pub broken_at: Option<String>,
}

#[tauri::command]
#[tracing::instrument(level = "warn", skip(pool, session_state, guard))]
pub async fn repair_audit_chain(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    guard: State<'_, AuditChainGuardExt>,
) -> Result<AuditChainRepairResult, AppError> {
    rbac::require(&session_state, "ops.system")?;
    let deleted = audit_repo::repair_broken_audit_chain(&pool).await?;
    let broken_at = audit_repo::verify_chain(&pool).await?;
    let g = guard_ref(&guard);
    if broken_at.is_none() {
        g.set_ok();
    } else if let Some(id) = broken_at.as_ref() {
        g.set_broken(id.clone());
    }
    Ok(AuditChainRepairResult {
        deleted_rows: deleted,
        chain_ok: broken_at.is_none(),
        broken_at,
    })
}
