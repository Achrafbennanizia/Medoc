//! Day-end closing (cash / reconciliation) — logged runs.
use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::day_close_protocol::{
    CreateDayCloseProtocol, DayCloseProtocol,
};
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, day_close_protocol_repo};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_day_close_protocols(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<DayCloseProtocol>, AppError> {
    rbac::require(&session_state, "finance.read")?;
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
    day_close_protocol_repo::get(&pool, &id).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_day_close_protocol(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateDayCloseProtocol,
) -> Result<DayCloseProtocol, AppError> {
    let session = rbac::require(&session_state, "finance.day_close.write")?;
    let row = day_close_protocol_repo::create(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "DayCloseProtocol",
        Some(&row.id),
        Some(&format!("as_of_date={}", row.as_of_date)),
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn delete_day_close_protocol(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "finance.day_close.write")?;
    day_close_protocol_repo::delete_row(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "DayCloseProtocol",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_day_close_protocol_commands {
    () => {
        $crate::commands::day_close_protocol_commands::list_day_close_protocols,
        $crate::commands::day_close_protocol_commands::get_day_close_protocol,
        $crate::commands::day_close_protocol_commands::create_day_close_protocol,
        $crate::commands::day_close_protocol_commands::delete_day_close_protocol,
    };
}
