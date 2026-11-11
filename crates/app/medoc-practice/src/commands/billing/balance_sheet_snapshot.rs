//! Tauri commands for balance-sheet (BalanceSheet) wizard snapshots (FA-FIN-09/10).
use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::balance_sheet_snapshot::{
    BalanceSheetSnapshot, CreateBalanceSheetSnapshot,
};
use crate::error::AppError;
use crate::infrastructure::database::balance_sheet_snapshot_repo;
use medoc_core::application::documents::finance_schema;
use medoc_core::application::documents::issue::IssuedPdf;
use medoc_core::application::documents::period_report::{
    self, PeriodArgs, PeriodReport, PeriodReportResult,
};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_balance_sheet_snapshots(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<BalanceSheetSnapshot>, AppError> {
    // Period results are finance data, not reception data.
    rbac::require(&session_state, "finance.read")?;
    balance_sheet_snapshot_repo::list(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_balance_sheet_snapshot(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<BalanceSheetSnapshot, AppError> {
    rbac::require(&session_state, "finance.read")?;
    balance_sheet_snapshot_repo::get(&pool, &id).await
}

/// Legacy wizard entry point: totals sent by the client are ignored. The
/// period in `data.period` must be `YYYY-MM-DD – YYYY-MM-DD` (or `..`).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_balance_sheet_snapshot(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateBalanceSheetSnapshot,
) -> Result<BalanceSheetSnapshot, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let (from, to) = data
        .period
        .split_once('–')
        .or_else(|| data.period.split_once(".."))
        .map(|(a, b)| (a.trim().to_string(), b.trim().to_string()))
        .ok_or_else(|| AppError::validation_code("error.period_report.bad_period"))?;
    let out = period_report::create(
        &pool,
        &session,
        PeriodArgs {
            from,
            to,
            kind: data.kind.clone(),
            label: Some(data.label.clone()),
            preview: false,
        },
    )
    .await?;
    let id = out
        .snapshot_id
        .ok_or_else(|| AppError::Internal("snapshot not stored".into()))?;
    balance_sheet_snapshot_repo::get(&pool, &id).await
}

/// Saved period reports are final (numbered BE document).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn delete_balance_sheet_snapshot(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    rbac::require(&session_state, "finance.write")?;
    finance_schema::ensure(&pool).await?;
    let _ = id;
    Err(AppError::validation_code("error.documents.immutable"))
}

/// Figures for a period, computed from the cash journal (no side effects).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn compute_period_report(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    from: String,
    to: String,
    kind: Option<String>,
) -> Result<PeriodReport, AppError> {
    rbac::require(&session_state, "finance.read")?;
    period_report::compute(&pool, &from, &to, kind.as_deref().unwrap_or("CUSTOM")).await
}

/// Preview (watermarked) or save the numbered period report (BE-…).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn create_period_report(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: PeriodArgs,
) -> Result<PeriodReportResult, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    period_report::create(&pool, &session, args).await
}

/// PDF copy of a saved period report (BE-…).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn reprint_period_report(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    snapshot_id: String,
) -> Result<IssuedPdf, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    period_report::reprint_snapshot(&pool, &session, &snapshot_id).await
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_balance_sheet_snapshot_commands {
    () => {
        $crate::commands::balance_sheet_snapshot_commands::list_balance_sheet_snapshots,
        $crate::commands::balance_sheet_snapshot_commands::get_balance_sheet_snapshot,
        $crate::commands::balance_sheet_snapshot_commands::create_balance_sheet_snapshot,
        $crate::commands::balance_sheet_snapshot_commands::delete_balance_sheet_snapshot,
        $crate::commands::balance_sheet_snapshot_commands::compute_period_report,
        $crate::commands::balance_sheet_snapshot_commands::create_period_report,
        $crate::commands::balance_sheet_snapshot_commands::reprint_period_report,
    };
}
