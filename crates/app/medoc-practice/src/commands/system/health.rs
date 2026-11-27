//! Health summary and remote-command approvals (T7.4, docs/architecture/editions-plan.md §11.5).
//!
//! The health summary holds facts only (no names, no patient or staff data). It goes into the
//! support file and is shown to the admin on Help → Support. Remote commands are built but off
//! (`remote_commands::ENABLED`): the list is empty and decisions are refused until the company
//! server channel exists.

use medoc_core::application::remote_commands::{self, Envelope};
use medoc_core::infrastructure::{backup, disk_space, error_reports};
use serde::Serialize;
use sqlx::SqlitePool;
use tauri::{AppHandle, State};

use crate::commands::admin::auth::SessionState;
use crate::commands::rbac_state::require;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;

async fn scalar(pool: &SqlitePool, sql: &str) -> Option<i64> {
    sqlx::query_scalar::<_, i64>(sql).fetch_one(pool).await.ok()
}

/// Facts only (§11.5): shared by the support file and Help → Support.
pub async fn summary(pool: &SqlitePool, app: &AppHandle) -> serde_json::Value {
    let info = crate::edition::info();
    let db_ok = scalar(pool, "SELECT 1").await.is_some();
    let audit_chain_ok = audit_repo::verify_chain(pool)
        .await
        .ok()
        .flatten()
        .is_none();
    let data_dir = crate::commands::app_data_dir(app).ok();
    let db_bytes = data_dir
        .as_ref()
        .and_then(|d| std::fs::metadata(d.join("medoc.db")).ok())
        .map(|m| m.len());
    let disk_free_bytes = data_dir.as_deref().and_then(disk_space::free_bytes);
    let last_backup = backup::list_metadata()
        .ok()
        .and_then(|list| list.into_iter().filter_map(|b| b.created_at).max());
    let now = chrono::Utc::now();
    let errors: Vec<serde_json::Value> =
        error_reports::counts_by_area(&error_reports::recent(), now.date_naive(), 7)
            .into_iter()
            .map(|(area, count)| serde_json::json!({ "area": area, "count": count }))
            .collect();
    serde_json::json!({
        "version": info.version,
        "edition": info.edition,
        "flavor": info.flavor,
        "os": std::env::consts::OS,
        "dbOk": db_ok,
        "auditChainOk": audit_chain_ok,
        "dbBytes": db_bytes,
        "diskFreeBytes": disk_free_bytes,
        "lastBackupAt": last_backup.map(|t| t.to_rfc3339()),
        "lastBackupAgeHours": last_backup.map(|t| (now - t).num_hours()),
        "syncPendingOutbox": scalar(pool, "SELECT COUNT(*) FROM sync_outbox WHERE delivered_at IS NULL").await,
        "syncOpenProblems": medoc_sync::problems::open_count(pool).await.ok(),
        // T7.6: a peer refused our sync protocol; work queues until the older side is updated.
        "syncUpdateNeeded": medoc_sync::protocol_compat::update_needed().is_some(),
        "errorsByArea7d": errors,
        // T4.4: sequences a hub that took over as primary will not number until an admin checks them.
        "numberingGaps": medoc_core::infrastructure::database::number_sequence::open_gaps(pool).await,
    })
}

#[tauri::command]
pub async fn health_summary(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<serde_json::Value, AppError> {
    require(&session_state, "ops.system")?;
    Ok(summary(&pool, &app).await)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteCommands {
    /// `false` until the company-server channel exists: the UI shows nothing.
    pub enabled: bool,
    pub pending: Vec<Envelope>,
}

#[tauri::command]
pub async fn remote_command_list(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<RemoteCommands, AppError> {
    require(&session_state, "ops.system")?;
    Ok(RemoteCommands {
        enabled: remote_commands::ENABLED,
        pending: if remote_commands::ENABLED {
            remote_commands::pending(&pool, chrono::Utc::now()).await
        } else {
            Vec::new()
        },
    })
}

/// Approve or refuse one request; audited. Running an approved command comes with the server channel.
#[tauri::command]
pub async fn remote_command_decide(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    nonce: String,
    approve: bool,
) -> Result<(), AppError> {
    let session = require(&session_state, "ops.system")?;
    let decided = remote_commands::decide(&pool, &nonce, approve, chrono::Utc::now()).await?;
    let details = serde_json::json!({ "nonce": nonce, "approved": approve, "command": decided.map(|e| e.command) });
    audit_repo::create(
        &pool,
        &session.user_id,
        "REMOTE_COMMAND_DECIDED",
        "support",
        None,
        Some(&details.to_string()),
    )
    .await?;
    Ok(())
}

/// T4.4: the admin checked a numbering gap (e.g. documents lost with the old primary); audited.
#[tauri::command]
pub async fn numbering_gap_acknowledge(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    sequence: String,
) -> Result<(), AppError> {
    let session = require(&session_state, "ops.system")?;
    use medoc_core::infrastructure::database::number_sequence as ns;
    let missing = ns::open_gaps(&pool).await.get(&sequence).cloned();
    if !ns::acknowledge_gap(&pool, &sequence).await? {
        return Ok(());
    }
    let details = serde_json::json!({ "sequence": sequence, "missing": missing });
    audit_repo::create(
        &pool,
        &session.user_id,
        "NUMBERING_GAP_ACKNOWLEDGED",
        "numbering",
        None,
        Some(&details.to_string()),
    )
    .await?;
    Ok(())
}
