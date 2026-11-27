use crate::application::rbac::{self, FINANCE_READ_OR_RECEPTION};
use crate::commands::admin::auth::SessionState;
use crate::domain::entities::payment::{BalanceSheet, CreatePayment, UpdatePayment};
use crate::domain::entities::Payment;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::repos::billing::payment as payment_repo;
use medoc_core::application::documents::{finance_schema, period_report};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_payments(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<Payment>, AppError> {
    rbac::require_one_of(&session_state, FINANCE_READ_OR_RECEPTION)?;
    payment_repo::find_all(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, params))]
pub async fn list_payments_paged(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    params: Option<crate::commands::list_params::ListParams>,
) -> Result<crate::commands::list_params::ListResponse<Payment>, AppError> {
    let session = rbac::require_one_of(&session_state, FINANCE_READ_OR_RECEPTION)?;
    let p = params.unwrap_or_default();
    let doctor = p.filter_str("doctorId").filter(|d| !d.trim().is_empty());
    let scope = super::payment_allowances::scope(&pool, &session, doctor).await?;
    let limit = p.limit();
    let offset = p.offset();
    let sort_dir = p
        .sort_dir_or(crate::commands::list_params::SortDir::Desc)
        .sql();
    let filter = payment_repo::PaymentListFilter {
        status: p.filter_str("status"),
        payment_method: p
            .filter_str("paymentMethod")
            .or_else(|| p.filter_str("method")),
        date_on: p.filter_str("dateOn"),
        date_from: p.filter_str("dateFrom"),
        date_to: p.filter_str("dateTo"),
        active_on: p.filter_str("activeOn"),
        doctor,
        hidden_doctors: &scope.hidden_doctors,
        hidden_ids: &scope.hidden_ids,
    };
    let (items, total) =
        payment_repo::find_paginated(&pool, limit, offset, sort_dir, filter).await?;
    Ok(crate::commands::list_params::ListResponse {
        items,
        total,
        page: p.page_one_based(),
        page_size: limit,
        hidden_doctors: scope.hidden_doctors,
    })
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn payment_finance_kpis(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<payment_repo::PaymentFinanceKpis, AppError> {
    rbac::require_one_of(&session_state, FINANCE_READ_OR_RECEPTION)?;
    payment_repo::finance_kpis(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn payment_monthly_breakdown(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    months: Option<u32>,
) -> Result<Vec<payment_repo::PaymentMonthBucket>, AppError> {
    rbac::require_one_of(&session_state, FINANCE_READ_OR_RECEPTION)?;
    payment_repo::monthly_breakdown(&pool, months.unwrap_or(12)).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, patient_id))]
pub async fn list_payments_for_patient(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<Vec<Payment>, AppError> {
    rbac::require_one_of(&session_state, FINANCE_READ_OR_RECEPTION)?;
    payment_repo::find_by_patient_id(&pool, &patient_id).await
}

/// For patient list: `patient_id` values with at least one open/partially paid booking.
#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state))]
pub async fn list_patient_ids_open_invoice(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<String>, AppError> {
    rbac::require_one_of(&session_state, FINANCE_READ_OR_RECEPTION)?;
    payment_repo::patient_ids_open_invoice(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_payment(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreatePayment,
) -> Result<Payment, AppError> {
    let session = rbac::require(&session_state, "finance.write")?;
    // Journal triggers must exist before money is booked.
    finance_schema::ensure(&pool).await?;
    payment_repo::ensure_released_for_payment(&pool, &session.user_id, &data).await?;
    let z = payment_repo::create(&pool, &data).await?;
    crate::commands::ownership::stamp_created(&pool, &session, "payment", &z.id, None).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Payment",
        Some(&z.id),
        None,
    )
    .await
    .ok();
    Ok(z)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id, status))]
pub async fn update_payment_status(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    status: String,
) -> Result<Payment, AppError> {
    let session = rbac::require(&session_state, "finance.write")?;
    finance_schema::ensure(&pool).await?;
    // PAID / PARTIALLY_PAID / OUTSTANDING follow from the amounts; setting
    // them by hand booked money that never came in. Only a cancellation
    // (Storno) is a manual status change, and it is journaled as reversal.
    if !status.eq_ignore_ascii_case("CANCELLED") {
        return Err(AppError::validation_code("error.payment.status_derived"));
    }
    let z = payment_repo::update_status(&pool, &id, "CANCELLED").await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE_STATUS",
        "Payment",
        Some(&id),
        Some(&status),
    )
    .await
    .ok();
    Ok(z)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_payment(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: UpdatePayment,
) -> Result<Payment, AppError> {
    let session = rbac::require(&session_state, "finance.write")?;
    finance_schema::ensure(&pool).await?;
    let z = payment_repo::update_fields(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Payment",
        Some(&z.id),
        None,
    )
    .await
    .ok();
    Ok(z)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_payment(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "finance.write")?;
    finance_schema::ensure(&pool).await?;
    let received: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount_cents),0) FROM payment_receipt WHERE payment_id = ?1",
    )
    .bind(&id)
    .fetch_one(&*pool)
    .await?;
    if received != 0 {
        // Money was received on this booking: cancel it instead (Storno).
        return Err(AppError::validation_code(
            "error.payment.delete_has_receipts",
        ));
    }
    payment_repo::delete_if_pending(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "Payment",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state))]
pub async fn get_balance_sheet(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<BalanceSheet, AppError> {
    rbac::require_one_of(&session_state, FINANCE_READ_OR_RECEPTION)?;
    period_report::balance_overview(&pool).await
}

/// Day-end closing: mark selected payments as cash-checked (or clear the flag).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, ids))]
pub async fn set_payments_cash_verified(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    ids: Vec<String>,
    cash_verified: bool,
) -> Result<u64, AppError> {
    let session = rbac::require(&session_state, "finance.write")?;
    let version = if cash_verified { 1i64 } else { 0 };
    let n = payment_repo::set_cash_verified_for_ids(&pool, &ids, version).await?;
    let detail = format!("cash_verified={} payments={}", version, ids.len());
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Payment",
        None,
        Some(&detail),
    )
    .await
    .ok();
    Ok(n)
}
