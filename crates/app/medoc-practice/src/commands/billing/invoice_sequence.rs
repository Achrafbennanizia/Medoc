//! Sequential document numbers (RE-/BR-/QU-) in SQLite — shared source for
//! PDF invoices and daily reports (GoBD-oriented daily sequence, not random).

use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::log_system;
use medoc_core::infrastructure::database::number_sequence::NumberStyle;

fn normalize_ymd(ymd: &str) -> Result<String, AppError> {
    let head = ymd
        .trim()
        .get(..10)
        .ok_or_else(|| AppError::Validation("Date must be in yyyy-MM-dd format".into()))?;
    chrono::NaiveDate::parse_from_str(head, "%Y-%m-%d")
        .map_err(|_| AppError::Validation("Date must be in yyyy-MM-dd format".into()))?;
    Ok(head.to_string())
}

/// Allocate the next RE / BR / QU number for calendar day `ymd` (yyyy-MM-dd),
/// format `RE-YYYYMMDD-NNNNNN` (unchanged for the frontend and PDFs).
/// F76: the number comes from the cluster sequence — local `number_sequence`
/// on the main device, `/api/v1/sync/number` on a replica — instead of the
/// synced `app_kv` counter that let two devices issue the same number.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn allocate_invoice_document_number(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    kind: String,
    ymd: String,
) -> Result<String, AppError> {
    rbac::require(&session_state, "finance.write")?;

    let day_key = normalize_ymd(&ymd)?;
    let k = kind.trim().to_uppercase();
    if k != "RE" && k != "BR" && k != "QU" {
        return Err(AppError::Validation(
            "kind must be \"RE\", \"BR\", or \"QU\"".into(),
        ));
    }
    let num = medoc_sync::numbering::allocate_document_number(
        pool.inner(),
        &k,
        &day_key,
        NumberStyle::Daily,
    )
    .await?;
    log_system!(
        info,
        event = "INVOICE_NUMBER_ALLOC",
        kind = %k,
        day = %day_key,
        number = %num
    );
    Ok(num)
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_invoice_sequence_commands {
    () => {
        $crate::commands::invoice_sequence_commands::allocate_invoice_document_number,
    };
}
