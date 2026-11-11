//! Day close (Kassenabschluss) and cash book.
//!
//! All amounts are computed by [`medoc_core::application::documents::cash_book`]
//! from the cash journal. The client sends only the counted cash, the
//! denomination count, the card terminal total and a note.
use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::day_close_protocol::{CreateDayCloseProtocol, DayCloseProtocol};
use crate::error::AppError;
use crate::infrastructure::database::day_close_protocol_repo;
use medoc_core::application::documents::cash_book::{
    self, CashMovement, CashMovementArgs, CloseDayArgs, DayCloseDraft, DayCloseResult,
};
use medoc_core::application::documents::finance_schema;
use medoc_core::application::documents::issue::IssuedPdf;
use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_day_close_protocols(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<DayCloseProtocol>, AppError> {
    rbac::require(&session_state, "finance.read")?;
    finance_schema::ensure(&pool).await?;
    day_close_protocol_repo::list(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_day_close_protocol(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<DayCloseProtocol, AppError> {
    rbac::require(&session_state, "finance.read")?;
    finance_schema::ensure(&pool).await?;
    day_close_protocol_repo::get(&pool, &id).await
}

/// Legacy entry point. The figures sent by older clients are ignored; the
/// closing is computed on the server and the Kassenbericht is issued.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_day_close_protocol(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateDayCloseProtocol,
) -> Result<DayCloseProtocol, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let out = cash_book::close_day(
        &pool,
        &session,
        CloseDayArgs {
            as_of_date: data.as_of_date.clone(),
            counted_cents: data.counted_eur.map(|e| (e * 100.0).round() as i64),
            note: data.note.clone(),
            ..Default::default()
        },
    )
    .await?;
    day_close_protocol_repo::get(&pool, &out.protocol_id).await
}

/// A recorded closing is final (GoBD). Use `correct_day_close`.
#[tauri::command]
#[tracing::instrument(level = "info", skip(_pool, session_state))]
pub async fn delete_day_close_protocol(
    _pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    rbac::require(&session_state, "finance.day_close.write")?;
    let _ = id;
    Err(AppError::validation_code("error.day_close.immutable"))
}

/// Server-computed draft of the closing for a date (or the recorded one).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn prepare_day_close(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    as_of_date: String,
) -> Result<DayCloseDraft, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    cash_book::prepare(&pool, &session, &as_of_date).await
}

/// Record the closing and issue the numbered Kassenbericht (TB-…).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn close_day(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: CloseDayArgs,
) -> Result<DayCloseResult, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    cash_book::close_day(&pool, &session, args).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrectDayCloseArgs {
    pub protocol_id: String,
    #[serde(flatten)]
    pub values: CloseDayArgs,
}

/// Correction protocol for the latest closing (the original stays readable).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn correct_day_close(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: CorrectDayCloseArgs,
) -> Result<DayCloseResult, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    cash_book::correct_day_close(&pool, &session, &args.protocol_id, args.values).await
}

/// Kassenbericht of a recorded closing, printed again ("KOPIE").
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn day_close_report_copy(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    protocol_id: String,
) -> Result<IssuedPdf, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    cash_book::report_copy(&pool, &session, &protocol_id).await
}

/// Einlage, Entnahme, Bankeinzahlung, Barausgabe, Wechselgeld.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn record_cash_movement(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: CashMovementArgs,
) -> Result<CashMovement, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    cash_book::record_cash_movement(&pool, &session, args).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn reverse_cash_movement(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    reason: String,
) -> Result<CashMovement, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    cash_book::reverse_cash_movement(&pool, &session, &id, &reason).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_cash_movements(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    from: String,
    to: String,
) -> Result<Vec<CashMovement>, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    cash_book::list_cash_movements(&pool, &session, &from, &to).await
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_day_close_protocol_commands {
    () => {
        $crate::commands::day_close_protocol_commands::list_day_close_protocols,
        $crate::commands::day_close_protocol_commands::get_day_close_protocol,
        $crate::commands::day_close_protocol_commands::create_day_close_protocol,
        $crate::commands::day_close_protocol_commands::delete_day_close_protocol,
        $crate::commands::day_close_protocol_commands::prepare_day_close,
        $crate::commands::day_close_protocol_commands::close_day,
        $crate::commands::day_close_protocol_commands::correct_day_close,
        $crate::commands::day_close_protocol_commands::day_close_report_copy,
        $crate::commands::day_close_protocol_commands::record_cash_movement,
        $crate::commands::day_close_protocol_commands::reverse_cash_movement,
        $crate::commands::day_close_protocol_commands::list_cash_movements,
    };
}
