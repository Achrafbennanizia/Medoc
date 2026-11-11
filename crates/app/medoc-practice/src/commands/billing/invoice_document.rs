//! Issued invoice PDF snapshots (GoBD-oriented storage; replaces browser history).

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, invoice_document_repo};
use medoc_core::application::documents::issue::IssuedPdf;
use medoc_core::application::documents::receivables::{
    self, InvoiceListFilter, InvoiceStatusRow, ReminderArgs, ReminderRow,
};

#[derive(Debug, Serialize)]
pub struct InvoiceDocumentListRowDto {
    pub id: String,
    pub patient_id: String,
    pub document_number: String,
    pub payload_json: String,
    pub total_cents: i64,
    pub created_at: String,
    pub created_by: String,
}

#[derive(Debug, Deserialize)]
pub struct AppendInvoiceDocumentInput {
    pub id: String,
    pub patient_id: String,
    pub document_number: String,
    pub payload_json: String,
    pub total_cents: i64,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_invoice_documents(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    limit: Option<i64>,
) -> Result<Vec<InvoiceDocumentListRowDto>, AppError> {
    let _session = rbac::require(&session_state, "finance.read")?;
    let lim = limit.unwrap_or(200);
    let rows = invoice_document_repo::list_recent(&pool, lim).await?;
    Ok(rows
        .into_iter()
        .map(|r| InvoiceDocumentListRowDto {
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
pub async fn append_invoice_document(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    input: AppendInvoiceDocumentInput,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "finance.write")?;
    // Only for importing the pre-registry browser history. Such rows are
    // marked as legacy and can never take a number the registry issued.
    let taken: Option<String> = sqlx::query_scalar(
        "SELECT id FROM issued_document WHERE document_number = ?1 LIMIT 1",
    )
    .bind(input.document_number.trim())
    .fetch_optional(&*pool)
    .await?;
    if taken.is_some() || input.document_number.trim().starts_with("RE-") {
        return Err(AppError::validation_code("error.invoice.legacy_import_only"));
    }
    if input.id.trim().is_empty() || input.patient_id.trim().is_empty() {
        return Err(AppError::Validation(
            "id and patient_id are required".into(),
        ));
    }
    let doc_id = input.id.clone();
    let created_at = chrono::Utc::now().to_rfc3339();
    let excerpt = format!(
        "LEGACY_IMPORT nr={} patient_id={} cents={}",
        input.document_number, input.patient_id, input.total_cents
    );
    let row = invoice_document_repo::InvoiceDocumentRow {
        id: input.id,
        patient_id: input.patient_id,
        document_number: input.document_number,
        payload_json: input.payload_json,
        total_cents: input.total_cents,
        created_at,
        created_by: session.user_id.clone(),
    };
    invoice_document_repo::insert_with_audit_trail(&pool, &row, &excerpt).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "InvoiceDocument",
        Some(&doc_id),
        Some(&excerpt),
    )
    .await?;
    Ok(())
}

/// Issued invoices and cancellations with payment state (Offene Posten).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_invoice_status(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    filter: Option<InvoiceListFilter>,
) -> Result<Vec<InvoiceStatusRow>, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    receivables::list_invoices(&pool, &session, filter.unwrap_or_default()).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_invoice_status(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    document_id: String,
) -> Result<InvoiceStatusRow, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    receivables::invoice_status(&pool, &session, &document_id).await
}

/// Zahlungserinnerung / Mahnung for an overdue invoice (`preview` = draft).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn issue_payment_reminder(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: ReminderArgs,
) -> Result<IssuedPdf, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    receivables::issue_reminder(&pool, &session, args).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_payment_reminders(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    invoice_document_id: String,
) -> Result<Vec<ReminderRow>, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    receivables::list_reminders(&pool, &session, &invoice_document_id).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn payment_reminder_copy(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    reminder_id: String,
) -> Result<IssuedPdf, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    receivables::reminder_copy(&pool, &session, &reminder_id).await
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_invoice_document_commands {
    () => {
        $crate::commands::invoice_document_commands::list_invoice_documents,
        $crate::commands::invoice_document_commands::append_invoice_document,
        $crate::commands::invoice_document_commands::list_invoice_status,
        $crate::commands::invoice_document_commands::get_invoice_status,
        $crate::commands::invoice_document_commands::issue_payment_reminder,
        $crate::commands::invoice_document_commands::list_payment_reminders,
        $crate::commands::invoice_document_commands::payment_reminder_copy,
    };
}
