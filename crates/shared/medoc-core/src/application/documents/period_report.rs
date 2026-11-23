//! Period report (Einnahmen-Überschuss-Übersicht) replacing the old balance
//! wizard, whose totals came from rows the user ticked by hand and from demo
//! data.
//!
//! A dental practice determines its profit by cash accounting (§ 4 Abs. 3
//! EStG, Zufluss-/Abflussprinzip § 11 EStG), so:
//! * income = money received in the period (cash journal, by business day),
//! * invoiced amounts and open receivables are shown for information only,
//! * expenses = cash expenses from the cash book, delivered purchase orders
//!   and running contracts (pro rata, marked as estimate).
//!
//! Every saved report is numbered (BE-YYYY-nnnnnn), hashed and immutable.

use std::collections::BTreeMap;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::{Local, NaiveDate};
use serde::{Deserialize, Serialize};
use sqlx::{SqliteConnection, SqlitePool};

use super::cash_book::fmt_eur;
use super::finance_schema;
use super::issue::{after_insert, now_iso, require_permission, year_now, DocKind, IssuedPdf};
use super::practice_profile::{practice_logo, resolve_document_locale, PracticeProfile};
use super::receivables::open_receivables_cents;
use crate::application::auth_service::Session;
use crate::domain::entities::payment::BalanceSheet;
use crate::domain::services::pricing::{euros_to_cents, round_money_2};
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::repos::billing::issued_document::{
    self as repo, sha256_hex, IssuedDocument,
};
use crate::infrastructure::pdf::{
    render_report_pdf, ReportPdfInput, ReportPdfSection, ReportPdfSummaryRow,
};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PeriodArgs {
    pub from: String,
    pub to: String,
    /// MONTH | QUARTER | YEAR | CUSTOM
    pub kind: String,
    pub label: Option<String>,
    pub preview: bool,
    /// Document language requested by the client (UI language unless pinned); None → Settings language.
    #[serde(default)]
    pub locale: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Amount {
    pub label: String,
    pub cents: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpenseLine {
    /// CASH | PURCHASE | CONTRACT
    pub source: String,
    pub date: String,
    pub label: String,
    pub cents: i64,
    /// Contracts are pro-rata estimates, not payments.
    pub estimate: bool,
    /// Cash-book voucher number, when the movement has one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub voucher: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeriodReport {
    pub from: String,
    pub to: String,
    pub kind: String,
    pub income_cents: i64,
    pub income_by_method: Vec<Amount>,
    pub income_by_month: Vec<Amount>,
    pub invoiced_cents: i64,
    pub invoice_count: i64,
    pub cancellation_cents: i64,
    pub cancellation_count: i64,
    pub open_receivables_cents: i64,
    pub open_receivables_count: i64,
    pub expenses_cents: i64,
    pub expenses_estimate_cents: i64,
    pub expenses: Vec<ExpenseLine>,
    pub result_cents: i64,
    /// Days in the period that have cash entries but no closing.
    pub unclosed_days: Vec<String>,
}

fn parse(s: &str) -> Result<NaiveDate, AppError> {
    NaiveDate::parse_from_str(s.trim(), "%Y-%m-%d")
        .map_err(|_| AppError::validation_code("error.period_report.bad_period"))
}

fn method_label(m: &str, locale: &str) -> String {
    use crate::infrastructure::pdf::i18n::tr;
    match m {
        "CASH" | "Bar" => tr(locale, "period.cash"),
        "CARD" | "Karte" => tr(locale, "period.card"),
        "BANK_TRANSFER" | "Überweisung" => tr(locale, "period.bank_transfer"),
        "INVOICE" | "Rechnung" => tr(locale, "period.invoice"),
        other => other,
    }
    .to_string()
}

/// Pro-rata cost of a recurring contract inside [from, to].
fn contract_share_cents(
    amount_eur: f64,
    interval: &str,
    c_from: Option<NaiveDate>,
    c_until: Option<NaiveDate>,
    from: NaiveDate,
    to: NaiveDate,
) -> i64 {
    let start = c_from.map(|d| d.max(from)).unwrap_or(from);
    let end = c_until.map(|d| d.min(to)).unwrap_or(to);
    if end < start {
        return 0;
    }
    let days = (end - start).num_days() + 1;
    let per_day = match interval {
        "DAY" => amount_eur,
        "WEEK" => amount_eur / 7.0,
        "MONTH" => amount_eur * 12.0 / 365.0,
        "YEAR" => amount_eur / 365.0,
        _ => 0.0,
    };
    euros_to_cents(per_day * days as f64)
}

pub async fn compute(
    pool: &SqlitePool,
    from: &str,
    to: &str,
    kind: &str,
) -> Result<PeriodReport, AppError> {
    finance_schema::ensure(pool).await?;
    finance_schema::reconcile(pool).await?;
    let f = parse(from)?;
    let t = parse(to)?;
    if t < f || (t - f).num_days() > 366 * 2 {
        return Err(AppError::validation_code("error.period_report.bad_period"));
    }
    let (from, to) = (
        f.format("%Y-%m-%d").to_string(),
        t.format("%Y-%m-%d").to_string(),
    );

    // ---- Income (Zufluss) ------------------------------------------------
    let by_method: Vec<(String, i64)> = sqlx::query_as(
        "SELECT method, COALESCE(SUM(amount_cents),0) FROM payment_receipt
          WHERE local_day BETWEEN ?1 AND ?2 GROUP BY method ORDER BY method",
    )
    .bind(&from)
    .bind(&to)
    .fetch_all(pool)
    .await?;
    let by_month: Vec<(String, i64)> = sqlx::query_as(
        "SELECT substr(local_day,1,7), COALESCE(SUM(amount_cents),0) FROM payment_receipt
          WHERE local_day BETWEEN ?1 AND ?2 GROUP BY 1 ORDER BY 1",
    )
    .bind(&from)
    .bind(&to)
    .fetch_all(pool)
    .await?;
    let income: i64 = by_method.iter().map(|(_, c)| c).sum();

    // ---- Invoices (Soll, information only) --------------------------------
    let docs: Vec<(String, String)> = sqlx::query_as(
        "SELECT kind, payload_json FROM issued_document
          WHERE kind IN ('INVOICE','CANCELLATION')
            AND date(substr(issued_at,1,19), 'localtime') BETWEEN ?1 AND ?2",
    )
    .bind(&from)
    .bind(&to)
    .fetch_all(pool)
    .await?;
    let (mut invoiced, mut inv_n, mut canc, mut canc_n) = (0i64, 0i64, 0i64, 0i64);
    for (k, payload) in docs {
        let inv: crate::infrastructure::pdf::Invoice =
            serde_json::from_str(&payload).unwrap_or_default();
        if k == "INVOICE" {
            invoiced += inv.total_cents();
            inv_n += 1;
        } else {
            canc += inv.total_cents();
            canc_n += 1;
        }
    }
    let (open, open_n) = open_receivables_cents(pool, &to).await?;

    // ---- Expenses (Abfluss) ------------------------------------------------
    let mut expenses: Vec<ExpenseLine> = Vec::new();
    let cash: Vec<(String, i64, i64, String, Option<String>)> = sqlx::query_as(
        "SELECT local_day, amount_cents, direction, reason, receipt_ref FROM cash_movement
          WHERE local_day BETWEEN ?1 AND ?2
            AND (kind = 'EXPENSE' OR (kind = 'REVERSAL' AND reverses_id IN
                 (SELECT id FROM cash_movement WHERE kind = 'EXPENSE')))
          ORDER BY local_day",
    )
    .bind(&from)
    .bind(&to)
    .fetch_all(pool)
    .await?;
    for (day, cents, dir, reason, voucher) in cash {
        expenses.push(ExpenseLine {
            source: "CASH".into(),
            date: day,
            label: reason,
            cents: -cents * dir,
            estimate: false,
            voucher,
        });
    }
    let purchases: Vec<(String, String, String, f64)> = sqlx::query_as(
        "SELECT COALESCE(delivered_on, substr(updated_at,1,10)), supplier, item, CAST(total_amount AS REAL)
           FROM purchase_order
          WHERE status = 'DELIVERED' AND total_amount IS NOT NULL AND total_amount > 0
            AND COALESCE(delivered_on, substr(updated_at,1,10)) BETWEEN ?1 AND ?2
          ORDER BY 1",
    )
    .bind(&from)
    .bind(&to)
    .fetch_all(pool)
    .await?;
    for (day, supplier, item, total) in purchases {
        expenses.push(ExpenseLine {
            source: "PURCHASE".into(),
            date: day,
            label: format!("{supplier}: {item}"),
            cents: euros_to_cents(total),
            estimate: false,
            voucher: None,
        });
    }
    // A deactivated contract costs nothing after its deactivation day (earlier of end date and deactivation).
    let contracts: Vec<(String, String, f64, String, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT designation, partner, CAST(amount AS REAL), interval, period_from,
                CASE
                    WHEN COALESCE(active, 1) = 0 AND deactivated_at IS NOT NULL
                         AND (period_until IS NULL OR deactivated_at < period_until) THEN deactivated_at
                    ELSE period_until
                END
           FROM contract",
    )
    .fetch_all(pool)
    .await?;
    for (name, partner, amount, interval, c_from, c_until) in contracts {
        let pf = c_from
            .as_deref()
            .and_then(|s| NaiveDate::parse_from_str(s.get(..10)?, "%Y-%m-%d").ok());
        let pu = c_until
            .as_deref()
            .and_then(|s| NaiveDate::parse_from_str(s.get(..10)?, "%Y-%m-%d").ok());
        let cents = contract_share_cents(amount, &interval, pf, pu, f, t);
        if cents > 0 {
            expenses.push(ExpenseLine {
                source: "CONTRACT".into(),
                date: from.clone(),
                label: format!("{name} ({partner})"),
                cents,
                estimate: true,
                voucher: None,
            });
        }
    }
    let exp_total: i64 = expenses.iter().map(|e| e.cents).sum();
    let exp_est: i64 = expenses
        .iter()
        .filter(|e| e.estimate)
        .map(|e| e.cents)
        .sum();

    let unclosed_days: Vec<String> = sqlx::query_scalar(
        "SELECT DISTINCT local_day FROM payment_receipt
          WHERE local_day BETWEEN ?1 AND ?2 AND day_close_id IS NULL AND method = 'CASH'
          ORDER BY 1",
    )
    .bind(&from)
    .bind(&to)
    .fetch_all(pool)
    .await?;

    Ok(PeriodReport {
        from,
        to,
        kind: kind.to_string(),
        income_cents: income,
        income_by_method: by_method
            .into_iter()
            .map(|(m, c)| Amount { label: m, cents: c })
            .collect(),
        income_by_month: by_month
            .into_iter()
            .map(|(m, c)| Amount { label: m, cents: c })
            .collect(),
        invoiced_cents: invoiced,
        invoice_count: inv_n,
        cancellation_cents: canc,
        cancellation_count: canc_n,
        open_receivables_cents: open,
        open_receivables_count: open_n,
        expenses_cents: exp_total,
        expenses_estimate_cents: exp_est,
        expenses,
        result_cents: income - exp_total,
        unclosed_days,
    })
}

fn kind_label(kind: &str, locale: &str) -> &'static str {
    use crate::infrastructure::pdf::i18n::tr;
    match kind {
        "MONTH" => tr(locale, "period.month"),
        "QUARTER" => tr(locale, "period.quarter"),
        "YEAR" => tr(locale, "period.year"),
        _ => tr(locale, "period.period"),
    }
}

fn report_input(
    profile: &PracticeProfile,
    locale: &'static str,
    r: &PeriodReport,
    label: &str,
) -> ReportPdfInput {
    let t = |key: &str| crate::infrastructure::pdf::i18n::tr(locale, key).to_string();
    let row = |l: String, c: i64| ReportPdfSummaryRow {
        label: l,
        value: fmt_eur(c),
    };
    let mut summary = vec![
        ReportPdfSummaryRow {
            label: t("period.period"),
            value: format!(
                "{} – {} ({})",
                super::format_dmy(&r.from),
                super::format_dmy(&r.to),
                kind_label(&r.kind, locale)
            ),
        },
        row(t("period.practice_income_receipts"), r.income_cents),
        row(t("period.practice_expenses"), r.expenses_cents),
        row(t("period.surplus_deficit"), r.result_cents),
        row(
            format!("{} ({})", t("period.invoices_issued"), r.invoice_count),
            r.invoiced_cents,
        ),
        row(
            format!(
                "{} ({})",
                t("period.cancellation_invoices"),
                r.cancellation_count
            ),
            r.cancellation_cents,
        ),
        row(
            format!(
                "{} {} ({})",
                t("period.open_receivables_as_of"),
                super::format_dmy(&r.to),
                r.open_receivables_count
            ),
            r.open_receivables_cents,
        ),
    ];
    if r.expenses_estimate_cents > 0 {
        summary.push(row(
            t("period.of_which_contract_costs_pro_rata_estimate"),
            r.expenses_estimate_cents,
        ));
    }
    if !r.unclosed_days.is_empty() {
        summary.push(ReportPdfSummaryRow {
            label: t("period.days_with_cash_and_no_day_close"),
            value: r
                .unclosed_days
                .iter()
                .map(|d| super::format_dmy(d))
                .collect::<Vec<_>>()
                .join(", "),
        });
    }
    let mut sections = vec![
        ReportPdfSection {
            title: t("period.income_by_payment_method"),
            headers: vec![t("period.method"), t("period.amount")],
            rows: r
                .income_by_method
                .iter()
                .map(|a| vec![method_label(&a.label, locale), fmt_eur(a.cents)])
                .collect(),
            column_weights: None,
        },
        ReportPdfSection {
            title: t("period.income_by_month"),
            headers: vec![t("period.month_column"), t("period.amount")],
            rows: r
                .income_by_month
                .iter()
                .map(|a| vec![a.label.clone(), fmt_eur(a.cents)])
                .collect(),
            column_weights: None,
        },
    ];
    let mut grouped: BTreeMap<&str, Vec<&ExpenseLine>> = BTreeMap::new();
    for e in &r.expenses {
        grouped.entry(e.source.as_str()).or_default().push(e);
    }
    for (src, lines) in grouped {
        let title = match src {
            "CASH" => t("period.cash_book_expenses"),
            "PURCHASE" => t("period.material_purchases_delivered_orders"),
            _ => t("period.ongoing_contracts_pro_rata_estimate"),
        };
        sections.push(ReportPdfSection {
            title,
            headers: vec![
                t("period.date"),
                t("period.description"),
                t("period.amount"),
            ],
            rows: lines
                .iter()
                .map(|e| {
                    let description = match e
                        .voucher
                        .as_deref()
                        .map(str::trim)
                        .filter(|v| !v.is_empty())
                    {
                        Some(v) => format!("{} ({} {v})", e.label, t("period.voucher")),
                        None => e.label.clone(),
                    };
                    vec![super::format_dmy(&e.date), description, fmt_eur(e.cents)]
                })
                .collect(),
            column_weights: Some(vec![2, 6, 2]),
        });
    }
    sections.push(ReportPdfSection {
        title: t("period.note"),
        headers: vec!["".into()],
        rows: vec![
            vec![t("period.preliminary_notice")],
            vec![t("period.info_only_notice")],
        ],
        column_weights: None,
    });
    ReportPdfInput {
        doc_title: if label.trim().is_empty() {
            format!(
                "{} {} – {}",
                t("period.income_surplus_overview"),
                super::format_dmy(&r.from),
                super::format_dmy(&r.to)
            )
        } else {
            label.trim().to_string()
        },
        generated_at: Local::now().format("%d.%m.%Y %H:%M").to_string(),
        practice_name: profile.name.trim().to_string(),
        practice_address: profile.document_address_lines(),
        summary,
        sections,
        report_kind: Some("finance".into()),
        locale: Some(locale.into()),
        footer_lines: profile.footer_lines(locale),
        ..Default::default()
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeriodReportResult {
    pub snapshot_id: Option<String>,
    pub report: PeriodReport,
    pub pdf: IssuedPdf,
}

/// Preview (`preview: true`) or save + number the period report.
pub async fn create(
    pool: &SqlitePool,
    session: &Session,
    args: PeriodArgs,
) -> Result<PeriodReportResult, AppError> {
    require_permission(
        session,
        if args.preview {
            "reports.read"
        } else {
            "reports.create"
        },
    )?;
    let kind = match args.kind.trim().to_uppercase().as_str() {
        k @ ("MONTH" | "QUARTER" | "YEAR" | "CUSTOM") => k.to_string(),
        _ => "CUSTOM".to_string(),
    };
    if !args.preview && parse(&args.to)? >= Local::now().date_naive() {
        // A saved report covers a finished period.
        return Err(AppError::validation_code(
            "error.period_report.period_not_finished",
        ));
    }
    let report = compute(pool, &args.from, &args.to, &kind).await?;
    let profile = PracticeProfile::load(pool).await?;
    profile.require_complete()?;
    let locale = resolve_document_locale(pool, args.locale.as_deref()).await;
    let label = args.label.clone().unwrap_or_default();
    let mut input = report_input(&profile, locale, &report, &label);
    input.logo = practice_logo(pool).await;

    if args.preview {
        input.watermark = Some(
            crate::infrastructure::pdf::i18n::t(
                locale,
                crate::infrastructure::pdf::i18n::Phrase::Draft,
            )
            .into(),
        );
        let bytes = render_report_pdf(&input)?;
        return Ok(PeriodReportResult {
            snapshot_id: None,
            report,
            pdf: IssuedPdf {
                document_id: None,
                document_number: None,
                sha256: sha256_hex(&bytes),
                pdf_base64: STANDARD.encode(&bytes),
                reprint: false,
            },
        });
    }

    repo::ensure_numbering_authority(pool).await?;
    let snapshot_id = uuid::Uuid::new_v4().to_string();
    let issued_at = now_iso();
    let mut guard = pool.acquire().await?;
    sqlx::query("BEGIN IMMEDIATE").execute(&mut *guard).await?;
    let result: Result<(IssuedDocument, Vec<u8>), AppError> = async {
        let conn: &mut SqliteConnection = &mut guard;
        let number = repo::next_number(conn, DocKind::Report.prefix_for(profile.jurisdiction()), year_now()).await?;
        input.document_number = Some(number.clone());
        let doc_id = crate::infrastructure::pdf::new_document_uid();
        let bytes = crate::infrastructure::pdf::with_document_uid(&doc_id, || render_report_pdf(&input))?;
        let doc = IssuedDocument {
            id: doc_id.clone(),
            kind: DocKind::Report.as_db().into(),
            document_number: number.clone(),
            source_table: Some("balance_sheet_snapshot".into()),
            source_id: Some(snapshot_id.clone()),
            copy_variant: "ORIGINAL".into(),
            patient_id: None,
            sha256: sha256_hex(&bytes),
            payload_json: serde_json::to_string(&input).map_err(|e| AppError::Internal(e.to_string()))?,
            status: "ISSUED".into(),
            cancels_id: None,
            issued_by: session.user_id.clone(),
            issued_at: issued_at.clone(),
            updated_at: issued_at.clone(),
        };
        repo::insert(conn, &doc).await?;
        let payload = serde_json::json!({
            "version": 2,
            "documentId": doc.id,
            "documentNumber": number,
            "report": report,
        });
        sqlx::query(
            "INSERT INTO balance_sheet_snapshot
                (id, created_by, period, kind, label, income_cents, expenses_cents, balance_cents, payload)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        )
        .bind(&snapshot_id)
        .bind(&session.user_id)
        .bind(format!("{} – {}", report.from, report.to))
        .bind(&kind)
        .bind(if label.trim().is_empty() { input.doc_title.clone() } else { label.trim().to_string() })
        .bind(report.income_cents)
        .bind(report.expenses_cents)
        .bind(report.result_cents)
        .bind(payload.to_string())
        .execute(&mut *conn)
        .await?;
        Ok((doc, bytes))
    }
    .await;
    let (doc, bytes) = match result {
        Ok(v) => {
            sqlx::query("COMMIT").execute(&mut *guard).await?;
            v
        }
        Err(e) => {
            let _ = sqlx::query("ROLLBACK").execute(&mut *guard).await;
            return Err(e);
        }
    };
    drop(guard);
    after_insert(pool, session, &doc, "ISSUE_DOCUMENT").await;
    // The saved figures themselves, not only the PDF record.
    if let Err(e) = crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "balance_sheet_snapshot",
        &snapshot_id,
        "INSERT",
        "",
    )
    .await
    {
        tracing::warn!(event = "BALANCE_SNAPSHOT_OUTBOX_FAILED", error = %e);
    }
    let _ = audit_repo::create(
        pool,
        &session.user_id,
        "CREATE",
        "BalanceSheetSnapshot",
        Some(&snapshot_id),
        Some(&format!(
            "period={}..{} income={} expenses={} nr={}",
            report.from, report.to, report.income_cents, report.expenses_cents, doc.document_number
        )),
    )
    .await;
    Ok(PeriodReportResult {
        snapshot_id: Some(snapshot_id),
        report,
        pdf: IssuedPdf {
            document_id: Some(doc.id),
            document_number: Some(doc.document_number),
            sha256: doc.sha256,
            pdf_base64: STANDARD.encode(&bytes),
            reprint: false,
        },
    })
}

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
    super::issue::reprint(pool, session, &doc).await
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn contract_pro_rata() {
        let d = |s: &str| NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap();
        // 1200 €/year over a 365-day year.
        let q = contract_share_cents(1200.0, "YEAR", None, None, d("2026-01-01"), d("2026-12-31"));
        assert_eq!(q, 120000);
        // Monthly 100 € for one quarter (90 days) ≈ 295,89 €.
        let m = contract_share_cents(100.0, "MONTH", None, None, d("2026-01-01"), d("2026-03-31"));
        assert_eq!(m, 29589);
        // Contract ended before the period.
        assert_eq!(
            contract_share_cents(
                50.0,
                "MONTH",
                None,
                Some(d("2025-12-31")),
                d("2026-01-01"),
                d("2026-03-31")
            ),
            0
        );
    }

    fn sample_report() -> PeriodReport {
        PeriodReport {
            from: "2026-01-01".into(),
            to: "2026-01-31".into(),
            kind: "MONTH".into(),
            income_cents: 15000,
            income_by_method: vec![
                Amount {
                    label: "CASH".into(),
                    cents: 10000,
                },
                Amount {
                    label: "BANK_TRANSFER".into(),
                    cents: 5000,
                },
            ],
            income_by_month: vec![Amount {
                label: "2026-01".into(),
                cents: 15000,
            }],
            invoiced_cents: 0,
            invoice_count: 0,
            cancellation_cents: 0,
            cancellation_count: 0,
            open_receivables_cents: 0,
            open_receivables_count: 0,
            expenses_cents: 1200,
            expenses_estimate_cents: 0,
            expenses: vec![ExpenseLine {
                source: "CASH".into(),
                date: "2026-01-15".into(),
                label: "Gloves".into(),
                cents: 1200,
                estimate: false,
                voucher: Some("12".into()),
            }],
            result_cents: 13800,
            unclosed_days: Vec::new(),
        }
    }

    /// WinAnsi octal escapes (`\351` → é) so French and German labels are searchable.
    fn decode_pdf(pdf: &[u8]) -> String {
        let mut out = String::with_capacity(pdf.len());
        let mut i = 0;
        while i < pdf.len() {
            let b = pdf[i];
            if b == b'\\' && i + 1 < pdf.len() {
                let n = pdf[i + 1];
                if n.is_ascii_digit()
                    && i + 3 < pdf.len()
                    && pdf[i + 2].is_ascii_digit()
                    && pdf[i + 3].is_ascii_digit()
                {
                    let v = (n - b'0') as u32 * 64
                        + (pdf[i + 2] - b'0') as u32 * 8
                        + (pdf[i + 3] - b'0') as u32;
                    out.push(char::from_u32(v).unwrap_or('?'));
                    i += 4;
                    continue;
                }
                if matches!(n, b'(' | b')' | b'\\') {
                    out.push(n as char);
                    i += 2;
                    continue;
                }
            }
            out.push(char::from(b));
            i += 1;
        }
        out
    }

    #[test]
    fn pdf_labels_follow_every_document_language() {
        let profile = PracticeProfile {
            name: "Practice".into(),
            ..PracticeProfile::default()
        };
        let report = sample_report();
        let cases = [
            ("de", "Betriebseinnahmen", "Bar", "Beleg 12", "ENTWURF"),
            ("en", "Practice income", "Cash", "Voucher 12", "DRAFT"),
            (
                "fr",
                "Recettes du cabinet",
                "Espèces",
                "Pièce 12",
                "BROUILLON",
            ),
        ];
        for (locale, income, method, voucher, draft) in cases {
            let mut input = report_input(&profile, locale, &report, "");
            input.watermark = Some(
                crate::infrastructure::pdf::i18n::t(
                    locale,
                    crate::infrastructure::pdf::i18n::Phrase::Draft,
                )
                .into(),
            );
            let pdf = render_report_pdf(&input).unwrap();
            assert!(pdf.starts_with(b"%PDF-1.4"), "{locale}");
            let text = decode_pdf(&pdf);
            assert!(text.contains(income), "{locale} missing {income}");
            assert!(text.contains(method), "{locale} missing {method}");
            assert!(text.contains(voucher), "{locale} missing {voucher}");
            assert!(text.contains(draft), "{locale} missing {draft}");
        }
        let mut ar = report_input(&profile, "ar", &report, "");
        ar.watermark = Some(
            crate::infrastructure::pdf::i18n::t(
                "ar",
                crate::infrastructure::pdf::i18n::Phrase::Draft,
            )
            .into(),
        );
        let pdf = render_report_pdf(&ar).unwrap();
        let text = decode_pdf(&pdf);
        assert!(
            text.contains("/NotoNaskhArabic") || text.contains("/F3 "),
            "arabic font"
        );
        assert!(!text.contains("Betriebseinnahmen"), "ar still German");
        assert!(!text.contains("Beleg 12"), "ar voucher");
        assert!(!text.contains("ENTWURF"), "ar draft watermark");
    }
}
