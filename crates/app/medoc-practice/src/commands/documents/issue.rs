//! Official documents: every certificate, prescription, receipt, invoice and
//! daily report goes through these commands. They allocate the number, store
//! the document (hash) in `issued_document` and write the audit entry.
//!
//! Permission checks per document kind happen in
//! [`medoc_core::application::documents::issue`]; the command only resolves
//! the session.

use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::admin::auth::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::repos::billing::issued_document::{
    self as issued_document_repo, IssuedDocumentListRow,
};
use crate::infrastructure::pdf::ReportPdfInput;
use medoc_core::application::documents::issue::{
    self as svc, IssueClinicalArgs, IssueInvoiceArgs, IssuedPdf,
};

/// Certificate (incl. AU copies), prescription or receipt.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn issue_clinical_document(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: IssueClinicalArgs,
) -> Result<IssuedPdf, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    svc::issue_clinical_document(&pool, &session, args).await
}

/// GOZ invoice. `preview = true` → watermarked draft, no number.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn issue_invoice(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: IssueInvoiceArgs,
) -> Result<IssuedPdf, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    svc::issue_invoice(&pool, &session, args).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelInvoiceArgs {
    pub document_id: String,
    pub reason: String,
}

/// Stornorechnung for an issued invoice.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn cancel_issued_invoice(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: CancelInvoiceArgs,
) -> Result<IssuedPdf, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    svc::cancel_invoice(&pool, &session, &args.document_id, &args.reason).await
}

/// Print an issued document again ("KOPIE").
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn reprint_issued_document(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    document_id: String,
) -> Result<IssuedPdf, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    svc::reprint_by_id(&pool, &session, &document_id).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueReportArgs {
    pub input: ReportPdfInput,
    /// Daily report: the business date (one number per day).
    #[serde(default)]
    pub source_id: Option<String>,
    #[serde(default)]
    pub preview: bool,
}

/// Daily report and other practice reports as numbered PDFs.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn issue_report_pdf(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: IssueReportArgs,
) -> Result<IssuedPdf, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    svc::issue_report(&pool, &session, args.input, args.source_id, args.preview).await
}

/// Physicians and finance staff see drafts and cancellations. Reception sees
/// documents that have been generated and issued.
fn sees_every_document_status(session: &crate::application::auth_service::Session) -> bool {
    let Some(role) = rbac::Role::parse(&session.role) else {
        return false;
    };
    rbac::effective_allowed("finance.read", role, &session.permission_overrides)
        || rbac::effective_allowed("patient.read_medical", role, &session.permission_overrides)
}

/// Issued documents of one patient (chart view) or recent ones (finance).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_issued_documents(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: Option<String>,
    kind: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<IssuedDocumentListRow>, AppError> {
    match patient_id {
        Some(pid) => {
            let session = rbac::require(&session_state, "patient.read")?;
            let mut rows = issued_document_repo::list_for_patient(&pool, &pid).await?;
            if !sees_every_document_status(&session) {
                rows.retain(|row| row.status == "ISSUED");
            }
            Ok(rows)
        }
        None => {
            let session =
                rbac::require_one_of(&session_state, &["finance.read", "patient.read_documents"])?;
            let status = if sees_every_document_status(&session) {
                None
            } else {
                Some("ISSUED")
            };
            issued_document_repo::list_recent(
                &pool,
                kind.as_deref(),
                status,
                limit.unwrap_or(200).min(1000),
            )
            .await
        }
    }
}

/// Check whether a PDF (by SHA-256) was issued by this practice.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn verify_issued_document(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    sha256: String,
) -> Result<Option<IssuedDocumentListRow>, AppError> {
    rbac::require(&session_state, "audit.read")?;
    issued_document_repo::find_by_sha256(&pool, sha256.trim()).await
}
