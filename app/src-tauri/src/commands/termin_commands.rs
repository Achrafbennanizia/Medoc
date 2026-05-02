use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::termin::{CreateTermin, UpdateTermin};
use crate::domain::entities::Termin;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, termin_repo};
use sqlx::SqlitePool;
use tauri::State;

/// FA-TERM-01: Status workflow.
/// GEPLANT → BESTAETIGT → DURCHGEFUEHRT (forward path)
/// GEPLANT/BESTAETIGT → ABGESAGT or NICHT_ERSCHIENEN (terminal aborts)
/// Reaching DURCHGEFUEHRT, ABGESAGT, NICHT_ERSCHIENEN is terminal: no further
/// transitions allowed.
fn validate_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    if current == next {
        return Ok(());
    }
    let allowed = match current {
        "GEPLANT" => &["BESTAETIGT", "DURCHGEFUEHRT", "ABGESAGT", "NICHT_ERSCHIENEN"][..],
        "BESTAETIGT" => &["DURCHGEFUEHRT", "ABGESAGT", "NICHT_ERSCHIENEN"][..],
        // Terminal states (legacy rows may still carry `NICHTERSCHIENEN` from older serde)
        "DURCHGEFUEHRT" | "ABGESAGT" | "NICHT_ERSCHIENEN" | "NICHTERSCHIENEN" => &[][..],
        // Unknown source state — be permissive to keep migrations forward-compatible
        _ => return Ok(()),
    };
    if allowed.iter().any(|s| s.eq_ignore_ascii_case(next)) {
        Ok(())
    } else {
        Err(AppError::Validation(format!(
            "Termin-Status-Übergang {current}→{next} ist nicht erlaubt"
        )))
    }
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_termine(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<Termin>, AppError> {
    rbac::require(&session_state, "termin.read")?;
    termin_repo::find_all(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_termin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<Termin, AppError> {
    rbac::require(&session_state, "termin.read")?;
    termin_repo::find_by_id(&pool, &id)
        .await?
        .ok_or(AppError::NotFound("Termin".into()))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_termin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateTermin,
) -> Result<Termin, AppError> {
    let session = rbac::require(&session_state, "termin.write")?;
    let t = termin_repo::create(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Termin",
        Some(&t.id),
        None,
    )
    .await
    .ok();
    Ok(t)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_termin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: UpdateTermin,
) -> Result<Termin, AppError> {
    let session = rbac::require(&session_state, "termin.write")?;
    if let Some(new_status) = &data.status {
        let current = termin_repo::find_by_id(&pool, &id)
            .await?
            .ok_or(AppError::NotFound("Termin".into()))?;
        let new_str = serde_json::to_string(new_status)
            .map(|s| s.trim_matches('"').to_uppercase())
            .unwrap_or_default();
        validate_status_transition(&current.status, &new_str)?;
    }
    let t = termin_repo::update(&pool, &id, &data).await?;
    audit_repo::create(&pool, &session.user_id, "UPDATE", "Termin", Some(&id), None)
        .await
        .ok();
    Ok(t)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn delete_termin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "termin.write")?;
    termin_repo::delete(&pool, &id).await?;
    audit_repo::create(&pool, &session.user_id, "DELETE", "Termin", Some(&id), None)
        .await
        .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_termine_by_date(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    datum: String,
) -> Result<Vec<Termin>, AppError> {
    rbac::require(&session_state, "termin.read")?;
    termin_repo::find_by_date(&pool, &datum).await
}
