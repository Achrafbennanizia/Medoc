//! Reprint of a stored period report and the balance overview (split from `period_report.rs`).

use super::*;

/// Reprint the numbered period report stored for a snapshot ("KOPIE").
/// Looks up the issued document by snapshot id, then by `documentId` inside
/// the snapshot payload (older rows).
pub async fn reprint_snapshot(
    pool: &SqlitePool,
    session: &Session,
    snapshot_id: &str,
) -> Result<IssuedPdf, AppError> {
    require_permission(session, "reports.read")?;
    let id = snapshot_id.trim();
    if id.is_empty() {
        return Err(AppError::validation_code("error.period_report.no_pdf"));
    }
    let mut doc_id: Option<String> = sqlx::query_scalar(
        "SELECT id FROM issued_document
          WHERE source_table = 'balance_sheet_snapshot' AND source_id = ?1
            AND kind = 'REPORT' AND status = 'ISSUED'
          ORDER BY issued_at DESC LIMIT 1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    if doc_id.is_none() {
        let payload: Option<String> =
            sqlx::query_scalar("SELECT payload FROM balance_sheet_snapshot WHERE id = ?1")
                .bind(id)
                .fetch_optional(pool)
                .await?;
        if let Some(payload) = payload {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&payload) {
                doc_id = v
                    .get("documentId")
                    .or_else(|| v.get("document_id"))
                    .and_then(|x| x.as_str())
                    .map(str::to_string);
            }
        }
    }
    let doc_id = doc_id.ok_or_else(|| AppError::validation_code("error.period_report.no_pdf"))?;
    let doc = repo::find_by_id(pool, &doc_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Document".into()))?;
    super::super::issue::reprint(pool, session, &doc).await
}

/// Corrected overview for the finance dashboard. The old query summed the
/// *paid* part of open bookings as "outstanding" and ignored partial
/// payments in income.
pub async fn balance_overview(pool: &SqlitePool) -> Result<BalanceSheet, AppError> {
    finance_schema::ensure(pool).await?;
    let income: i64 =
        sqlx::query_scalar("SELECT COALESCE(SUM(amount_cents),0) FROM payment_receipt")
            .fetch_one(pool)
            .await?;
    let outstanding: f64 = sqlx::query_scalar(
        "SELECT CAST(COALESCE(SUM(MAX(COALESCE(amount_expected,0) - COALESCE(amount,0), 0)), 0) AS REAL)
           FROM payment WHERE UPPER(COALESCE(status,'')) IN ('OUTSTANDING','PARTIALLY_PAID')",
    )
    .fetch_one(pool)
    .await?;
    let cancelled: f64 = sqlx::query_scalar(
        "SELECT CAST(COALESCE(SUM(amount), 0) AS REAL) FROM payment WHERE UPPER(COALESCE(status,'')) = 'CANCELLED'",
    )
    .fetch_one(pool)
    .await?;
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM payment")
        .fetch_one(pool)
        .await?;
    Ok(BalanceSheet {
        income: income as f64 / 100.0,
        outstanding: round_money_2(outstanding),
        cancelled,
        payment_count: count,
    })
}
