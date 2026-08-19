//! Internal feedback / vigilance / technical-incident channel.
//!
//! Persists user-submitted reports so the support team can triage them. Used
//! by the in-app `Feedback` page; the previous version dropped the input on
//! the floor with only a toast.
use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct FeedbackEntry {
    pub id: String,
    pub user_id: String,
    pub category: String,
    pub subject: String,
    pub message: String,
    pub reference: Option<String>,
    pub status: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateFeedback {
    pub category: String,
    pub subject: String,
    pub message: String,
    pub reference: Option<String>,
}

fn validate_category(k: &str) -> Result<(), AppError> {
    match k {
        "feedback" | "vigilance" | "technical" => Ok(()),
        _ => Err(AppError::Validation(format!("Unknown category: {k}"))),
    }
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn submit_feedback(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateFeedback,
) -> Result<FeedbackEntry, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    validate_category(&data.category)?;
    let subject = data.subject.trim();
    let message = data.message.trim();
    if subject.len() < 3 {
        return Err(AppError::Validation(
            "Subject too short (min. 3 characters)".into(),
        ));
    }
    if message.len() < 10 {
        return Err(AppError::Validation(
            "Message too short (min. 10 characters)".into(),
        ));
    }
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO feedback (id, user_id, category, subject, message, reference)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    )
    .bind(&id)
    .bind(&session.user_id)
    .bind(&data.category)
    .bind(subject)
    .bind(message)
    .bind(
        data.reference
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty()),
    )
    .execute(&*pool)
    .await?;
    sqlx::query_as::<_, FeedbackEntry>("SELECT * FROM feedback WHERE id = ?1")
        .bind(&id)
        .fetch_one(&*pool)
        .await
        .map_err(AppError::from)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_feedback(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<FeedbackEntry>, AppError> {
    rbac::require(&session_state, "audit.read")?;
    let rows =
        sqlx::query_as::<_, FeedbackEntry>("SELECT * FROM feedback ORDER BY created_at DESC")
            .fetch_all(&*pool)
            .await?;
    Ok(rows)
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_feedback_commands {
    () => {
        $crate::commands::feedback_commands::submit_feedback,
        $crate::commands::feedback_commands::list_feedback,
    };
}
