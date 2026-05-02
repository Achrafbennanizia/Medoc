//! Issued invoice PDF snapshots (GoBD-oriented storage; replaces browser history).

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, rechnung_document_repo};

#[derive(Debug, Serialize)]
pub struct RechnungDocumentListRowDto {
    pub id: String,
    pub patient_id: String,
    pub document_number: String,
    pub payload_json: String,
    pub total_cents: i64,
    pub created_at: String,
    pub created_by: String,
}

#[derive(Debug, Deserialize)]
pub struct AppendRechnungDocumentInput {
    pub id: String,
    pub patient_id: String,
    pub document_number: String,
    pub payload_json: String,
    pub total_cents: i64,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_rechnung_documents(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    limit: Option<i64>,
) -> Result<Vec<RechnungDocumentListRowDto>, AppError> {
    let _session = rbac::require(&session_state, "finanzen.read")?;
    let lim = limit.unwrap_or(200);
    let rows = rechnung_document_repo::list_recent(&pool, lim).await?;
    Ok(rows
        .into_iter()
        .map(|r| RechnungDocumentListRowDto {
            id: r.id,
            patient_id: r.patient_id,
            document_number: r.document_number,
            payload_json: r.payload_json,
            total_cents: r.total_cents,
            created_at: r.created_at,
            created_by: r.created_by,
        })
        .collect())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, input))]
pub async fn append_rechnung_document(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    input: AppendRechnungDocumentInput,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "finanzen.write")?;
    if input.id.trim().is_empty() || input.patient_id.trim().is_empty() {
        return Err(AppError::Validation("id und patient_id erforderlich".into()));
    }
    let doc_id = input.id.clone();
    let created_at = chrono::Utc::now().to_rfc3339();
    let excerpt = format!(
        "nr={} patient_id={} cents={}",
        input.document_number, input.patient_id, input.total_cents
    );
    let row = rechnung_document_repo::RechnungDocumentRow {
        id: input.id,
        patient_id: input.patient_id,
        document_number: input.document_number,
        payload_json: input.payload_json,
        total_cents: input.total_cents,
        created_at,
        created_by: session.user_id.clone(),
    };
    rechnung_document_repo::insert_with_audit_trail(&pool, &row, &excerpt).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "RechnungDocument",
        Some(&doc_id),
        Some(&excerpt),
    )
    .await?;
    Ok(())
}
