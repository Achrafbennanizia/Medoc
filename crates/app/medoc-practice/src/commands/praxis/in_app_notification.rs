use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::in_app_notification_repo;

const LIST_LIMIT: i64 = 100;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_in_app_notifications(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<in_app_notification_repo::InAppNotification>, AppError> {
    let session = rbac::require(&session_state, "termin.read")?;
    in_app_notification_repo::list_for_user(&pool, &session.user_id, LIST_LIMIT).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn count_unread_in_app_notifications(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<i64, AppError> {
    let session = rbac::require(&session_state, "termin.read")?;
    in_app_notification_repo::count_unread(&pool, &session.user_id).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn mark_in_app_notification_read(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "termin.read")?;
    let n = in_app_notification_repo::mark_read(&pool, &id, &session.user_id).await?;
    if n == 0 {
        return Err(AppError::NotFound("Benachrichtigung".into()));
    }
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn mark_all_in_app_notifications_read(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "termin.read")?;
    in_app_notification_repo::mark_all_read(&pool, &session.user_id).await?;
    Ok(())
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_in_app_notification_commands {
    () => {
        $crate::commands::in_app_notification_commands::list_in_app_notifications,
        $crate::commands::in_app_notification_commands::count_unread_in_app_notifications,
        $crate::commands::in_app_notification_commands::mark_in_app_notification_read,
        $crate::commands::in_app_notification_commands::mark_all_in_app_notifications_read,
    };
}
