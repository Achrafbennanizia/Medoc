//! User-defined document print templates (receipt, prescription, …).

use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::admin::auth::SessionState;
use crate::domain::entities::DocumentTemplateUser;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::repos::practice::document_template as document_template_repo;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_document_templates_for_kind(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    kind: String,
) -> Result<Vec<DocumentTemplateUser>, AppError> {
    let session = rbac::require(&session_state, "dashboard.read")?;
    let rows = document_template_repo::list_for_kind(&pool, &kind).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "DocumentTemplateUser",
        Some(&kind),
        Some("list_for_kind"),
    )
    .await
    .ok();
    Ok(rows)
}
