use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::admin::auth::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::repos::practice::in_app_notification as in_app_notification_repo;

const LIST_LIMIT: i64 = 100;

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInAppNotificationArgs {
    pub kind: String,
    pub title: String,
    pub body: String,
    pub payload_json: Option<String>,
    /// Extra staff recipients (e.g. appointment physicians). Always includes the caller.
    pub also_notify_user_ids: Option<Vec<String>>,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_in_app_notifications(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<in_app_notification_repo::InAppNotification>, AppError> {
    let session = rbac::require(&session_state, "appointment.read")?;
    in_app_notification_repo::list_for_user(&pool, &session.user_id, LIST_LIMIT).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn count_unread_in_app_notifications(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<i64, AppError> {
    let session = rbac::require(&session_state, "appointment.read")?;
    in_app_notification_repo::count_unread(&pool, &session.user_id).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn mark_in_app_notification_read(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "appointment.read")?;
    let n = in_app_notification_repo::mark_read(&pool, &id, &session.user_id).await?;
    if n == 0 {
        return Err(AppError::NotFound("Notification".into()));
    }
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn mark_all_in_app_notifications_read(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "appointment.read")?;
    in_app_notification_repo::mark_all_read(&pool, &session.user_id).await?;
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn create_in_app_notification(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: CreateInAppNotificationArgs,
) -> Result<u32, AppError> {
    let session = rbac::require(&session_state, "administration.practice_planning.write")?;
    let kind = args.kind.trim();
    let title = args.title.trim();
    let body = args.body.trim();
    if kind.is_empty() || title.is_empty() {
        return Err(AppError::Validation(
            "Notification kind and title are required.".into(),
        ));
    }
    let mut recipients = vec![session.user_id.clone()];
    if let Some(extra) = args.also_notify_user_ids {
        for id in extra {
            let t = id.trim();
            if !t.is_empty() && !recipients.iter().any(|r| r == t) {
                recipients.push(t.to_string());
            }
        }
    }
    let payload = args
        .payload_json
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let mut created = 0u32;
    for user_id in recipients {
        // Skip unknown staff so a stale physician id cannot fail the whole batch.
        if in_app_notification_repo::insert(&pool, &user_id, kind, title, body, payload)
            .await
            .is_ok()
        {
            created += 1;
        }
    }
    if created == 0 {
        return Err(AppError::Validation(
            "No staff recipients available for this notification.".into(),
        ));
    }
    Ok(created)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn dismiss_unread_in_app_notifications_by_kind(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    kinds: Vec<String>,
) -> Result<u64, AppError> {
    let session = rbac::require(&session_state, "administration.practice_planning.write")?;
    let cleaned: Vec<String> = kinds
        .into_iter()
        .map(|k| k.trim().to_string())
        .filter(|k| !k.is_empty())
        .collect();
    if cleaned.is_empty() {
        return Ok(0);
    }
    in_app_notification_repo::mark_unread_kinds_read(&pool, &session.user_id, &cleaned).await
}
