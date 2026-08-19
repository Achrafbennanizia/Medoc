//! Tauri commands for balance-sheet (BalanceSheet) wizard snapshots (FA-FIN-09/10).
use crate::application::rbac::{self, FINANCE_READ_OR_RECEPTION};
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::balance_sheet_snapshot::{BalanceSheetSnapshot, CreateBalanceSheetSnapshot};
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, balance_sheet_snapshot_repo};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_balance_sheet_snapshots(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<BalanceSheetSnapshot>, AppError> {
    rbac::require_one_of(&session_state, FINANCE_READ_OR_RECEPTION)?;
    balance_sheet_snapshot_repo::list(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_balance_sheet_snapshot(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<BalanceSheetSnapshot, AppError> {
    rbac::require_one_of(&session_state, FINANCE_READ_OR_RECEPTION)?;
    balance_sheet_snapshot_repo::get(&pool, &id).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_balance_sheet_snapshot(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateBalanceSheetSnapshot,
) -> Result<BalanceSheetSnapshot, AppError> {
    let session = rbac::require(&session_state, "finance.write")?;
    let snap = balance_sheet_snapshot_repo::create(&pool, &data, &session.user_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "BalanceSheetSnapshot",
        Some(&snap.id),
        Some(&format!(
            "period={};income={};expenses={};balance={}",
            snap.period, snap.income_cents, snap.expenses_cents, snap.balance_cents
        )),
    )
    .await
    .ok();
    Ok(snap)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn delete_balance_sheet_snapshot(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "finance.write")?;
    balance_sheet_snapshot_repo::delete(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "BalanceSheetSnapshot",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_balance_sheet_snapshot_commands {
    () => {
        $crate::commands::balance_sheet_snapshot_commands::list_balance_sheet_snapshots,
        $crate::commands::balance_sheet_snapshot_commands::get_balance_sheet_snapshot,
        $crate::commands::balance_sheet_snapshot_commands::create_balance_sheet_snapshot,
        $crate::commands::balance_sheet_snapshot_commands::delete_balance_sheet_snapshot,
    };
}
