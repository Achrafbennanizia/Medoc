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
    pub kategorie: String,
    pub betreff: String,
    pub nachricht: String,
    pub referenz: Option<String>,
    pub status: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateFeedback {
    pub kategorie: String,
    pub betreff: String,
    pub nachricht: String,
    pub referenz: Option<String>,
}

fn validate_kategorie(k: &str) -> Result<(), AppError> {
    match k {
        "feedback" | "vigilance" | "technical" => Ok(()),
        _ => Err(AppError::Validation(format!("Unbekannte Kategorie: {k}"))),
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
    validate_kategorie(&data.kategorie)?;
    let betreff = data.betreff.trim();
    let nachricht = data.nachricht.trim();
    if betreff.len() < 3 {
        return Err(AppError::Validation("Betreff zu kurz (min. 3 Zeichen)".into()));
    }
    if nachricht.len() < 10 {
        return Err(AppError::Validation("Nachricht zu kurz (min. 10 Zeichen)".into()));
    }
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO feedback (id, user_id, kategorie, betreff, nachricht, referenz)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    )
    .bind(&id)
    .bind(&session.user_id)
    .bind(&data.kategorie)
    .bind(betreff)
    .bind(nachricht)
    .bind(data.referenz.as_deref().map(str::trim).filter(|s| !s.is_empty()))
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
    let rows = sqlx::query_as::<_, FeedbackEntry>(
        "SELECT * FROM feedback ORDER BY created_at DESC",
    )
    .fetch_all(&*pool)
    .await?;
    Ok(rows)
}
