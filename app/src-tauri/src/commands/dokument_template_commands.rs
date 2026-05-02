//! User-defined document print templates (Quittung, Rezept, …).

use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::DokumentTemplateUser;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, dokument_template_repo};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDokumentTemplateInput {
    pub kind: String,
    pub name: String,
    pub payload: String,
    #[serde(default)]
    pub is_default: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDokumentTemplateInput {
    pub id: String,
    pub name: String,
    pub payload: String,
    #[serde(default)]
    pub is_default: bool,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_dokument_templates_for_kind(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    kind: String,
) -> Result<Vec<DokumentTemplateUser>, AppError> {
    let session = rbac::require(&session_state, "dashboard.read")?;
    let rows = dokument_template_repo::list_for_kind(&pool, &kind).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "DokumentTemplateUser",
        Some(&kind),
        Some("list_for_kind"),
    )
    .await
    .ok();
    Ok(rows)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_dokument_template(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateDokumentTemplateInput,
) -> Result<DokumentTemplateUser, AppError> {
    let session = rbac::require(&session_state, "vorlagen.write")?;
    if data.kind.trim().is_empty() || data.name.trim().is_empty() {
        return Err(AppError::Validation("kind und name sind Pflicht.".into()));
    }
    let id = dokument_template_repo::new_id();
    if data.is_default {
        dokument_template_repo::clear_default_for_kind(&pool, &data.kind).await?;
    }
    dokument_template_repo::insert(
        &pool,
        &id,
        &data.kind,
        data.name.trim(),
        &data.payload,
        data.is_default,
        Some(&session.user_id),
    )
    .await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "DokumentTemplateUser",
        Some(&id),
        None,
    )
    .await
    .ok();
    dokument_template_repo::get_by_id(&pool, &id)
        .await?
        .ok_or_else(|| AppError::Internal("Vorlage nach Insert nicht lesbar.".into()))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_dokument_template(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: UpdateDokumentTemplateInput,
) -> Result<DokumentTemplateUser, AppError> {
    let session = rbac::require(&session_state, "vorlagen.write")?;
    let existing = dokument_template_repo::get_by_id(&pool, &data.id)
        .await?
        .ok_or_else(|| AppError::NotFound("Dokumentvorlage".into()))?;
    if data.is_default {
        dokument_template_repo::clear_default_for_kind(&pool, &existing.kind).await?;
    }
    let n = dokument_template_repo::update(&pool, &data.id, data.name.trim(), &data.payload, data.is_default).await?;
    if n == 0 {
        return Err(AppError::NotFound("Dokumentvorlage".into()));
    }
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "DokumentTemplateUser",
        Some(&data.id),
        None,
    )
    .await
    .ok();
    dokument_template_repo::get_by_id(&pool, &data.id)
        .await?
        .ok_or_else(|| AppError::Internal("Vorlage nach Update nicht lesbar.".into()))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn delete_dokument_template(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "vorlagen.write")?;
    let n = dokument_template_repo::delete_id(&pool, &id).await?;
    if n == 0 {
        return Err(AppError::NotFound("Dokumentvorlage".into()));
    }
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "DokumentTemplateUser",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}
