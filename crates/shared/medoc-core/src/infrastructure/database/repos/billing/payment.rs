use crate::domain::entities::payment::{BalanceSheet, CreatePayment, UpdatePayment};
use crate::domain::entities::Payment;
use crate::domain::enums::PaymentMethod;
use crate::domain::services::pricing;
use crate::error::AppError;
use crate::infrastructure::database::chart_repo;
use sqlx::SqlitePool;

/// Allowed tolerance for due/open checks (EUR) — frontend `PAYMENT_EUR_EPS` matches this value.
const OPEN_BOOKING_TOLERANCE_EUR: f64 = 0.005;

/// Cent rounding like frontend `roundMoney2` (`payment-buchung.ts`).
#[inline]
fn round_money2(n: f64) -> f64 {
    if !n.is_finite() {
        return n;
    }
    (n * 100.0).round() / 100.0
}

fn compute_payment_status(amount: f64, erwartet: Option<f64>) -> &'static str {
    const EPS: f64 = 1e-6;
    // Positive expected remaining/due amount (> 0); values ≤ 0 are ignored.
    let exp_positive = erwartet.filter(|e| e.is_finite() && *e > EPS);

    if amount <= EPS {
        // Open placeholder booking or no payment amount posted yet.
        match exp_positive {
            Some(_) => return "OUTSTANDING",
            None => {
                if matches!(erwartet, Some(e) if e.is_finite() && (-EPS..=EPS).contains(&e)) {
                    return "PAID";
                }
                return "OUTSTANDING";
            }
        }
    }
    match exp_positive {
        Some(exp) => {
            if amount + EPS >= exp {
                "PAID"
            } else {
                "PARTIALLY_PAID"
            }
        }
        None => "PAID",
    }
}

async fn refresh_payment_status(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let row: Option<(Option<f64>, f64)> =
        sqlx::query_as("SELECT amount_expected, amount FROM payment WHERE id = ?1")
            .bind(id)
            .fetch_optional(pool)
            .await?;
    let Some((erw, b)) = row else {
        return Ok(());
    };
    let st = compute_payment_status(b, erw);
    sqlx::query("UPDATE payment SET status = ?1 WHERE id = ?2")
        .bind(st)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Payment>, AppError> {
    let rows = sqlx::query_as::<_, Payment>("SELECT * FROM payment ORDER BY created_at DESC")
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn find_by_patient_id(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<Vec<Payment>, AppError> {
    let rows = sqlx::query_as::<_, Payment>(
        "SELECT * FROM payment WHERE patient_id = ?1 ORDER BY created_at DESC",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// Patient list: flag “invoice open” without loading all bookings.
pub async fn patient_ids_open_invoice(pool: &SqlitePool) -> Result<Vec<String>, AppError> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT DISTINCT patient_id FROM payment
         WHERE TRIM(UPPER(COALESCE(status, ''))) IN ('OUTSTANDING', 'PARTIALLY_PAID')
         ORDER BY patient_id",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

pub async fn create(pool: &SqlitePool, data: &CreatePayment) -> Result<Payment, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let payment_method = serde_json::to_string(&data.payment_method)
        .map_err(|e| AppError::Internal(format!("Serialize payment type: {e}")))?
        .trim_matches('"')
        .to_uppercase();

    if data.treatment_id.is_some() && data.examination_id.is_some() {
        return Err(AppError::validation_code("error.payment.dual_link"));
    }

    let mut amount_expected = data.amount_expected;
    if let Some(ref bid) = data.treatment_id {
        let row: Option<(Option<f64>, Option<String>, Option<String>)> = sqlx::query_as(
            "SELECT b.total_cost, b.released_by_physician_id, b.released_at FROM treatment b
             JOIN patient_chart a ON b.chart_id = a.id
             WHERE b.id = ?1 AND a.patient_id = ?2",
        )
        .bind(bid)
        .bind(&data.patient_id)
        .fetch_optional(pool)
        .await?;
        let Some((_, vid, vam)) = row else {
            return Err(AppError::validation_code("error.payment.treatment_not_found"));
        };
        crate::domain::services::pricing::require_released_for_billing(
            vid.as_deref(),
            vam.as_deref(),
            "error.entity.treatment",
        )?;
    }
    if let Some(ref uid) = data.examination_id {
        let ok: Option<(String, Option<String>, Option<String>)> = sqlx::query_as(
            "SELECT u.id, u.released_by_physician_id, u.released_at FROM examination u
             JOIN patient_chart a ON u.chart_id = a.id
             WHERE u.id = ?1 AND a.patient_id = ?2",
        )
        .bind(uid)
        .bind(&data.patient_id)
        .fetch_optional(pool)
        .await?;
        let Some((_, vid, vam)) = ok else {
            return Err(AppError::validation_code("error.payment.examination_not_found"));
        };
        crate::domain::services::pricing::require_released_for_billing(
            vid.as_deref(),
            vam.as_deref(),
            "error.entity.examination",
        )?;
    }

    const EPS: f64 = 1e-6;
    let is_placeholder = data.amount <= EPS;
    if data.amount < -EPS {
        return Err(AppError::validation_code("error.payment.amount_invalid"));
    }
    if is_placeholder && data.service_item_id.is_some() {
        return Err(AppError::validation_code("error.payment.service_item_positive_required"));
    }

    // When amount is positive: optionally take price from `service_item`.
    let amount = if is_placeholder {
        0.0
    } else if data.amount <= EPS {
        return Err(AppError::validation_code("error.payment.amount_must_be_positive"));
    } else if let Some(ref lid) = data.service_item_id {
        let row: Option<(f64,)> = sqlx::query_as("SELECT price FROM service_item WHERE id = ?1")
            .bind(lid)
            .fetch_optional(pool)
            .await?;
        row.map(|r| r.0).unwrap_or(data.amount)
    } else {
        data.amount
    };

    if let Some(ref bid) = data.treatment_id {
        let row: Option<(Option<f64>,)> = sqlx::query_as(
            "SELECT b.total_cost FROM treatment b
             JOIN patient_chart a ON b.chart_id = a.id
             WHERE b.id = ?1 AND a.patient_id = ?2",
        )
        .bind(bid)
        .bind(&data.patient_id)
        .fetch_optional(pool)
        .await?;
        if let Some((g_opt,)) = row {
            if let Some(g) = g_opt.filter(|g| g.is_finite() && *g > 0.0) {
                let sum_paid: f64 = sqlx::query_scalar(
                    "SELECT COALESCE(SUM(amount), 0) FROM payment
                     WHERE treatment_id = ?1 AND patient_id = ?2
                     AND (status IS NULL OR TRIM(UPPER(status)) != 'CANCELLED')",
                )
                .bind(bid)
                .bind(&data.patient_id)
                .fetch_one(pool)
                .await
                .unwrap_or(0.0);
                // Parity with UI: `Math.max(0, roundMoney2(gesamt - paidSoFar))`
                let open = round_money2(g - sum_paid).max(0.0);
                if amount > open + OPEN_BOOKING_TOLERANCE_EUR {
                    return Err(AppError::validation_code_params(
                        "error.payment.overpayment_treatment",
                        &[
                            ("max", &format!("{open:.2}")),
                            ("paid", &format!("{sum_paid:.2}")),
                            ("target", &format!("{g:.2}")),
                        ],
                    ));
                }
                amount_expected = Some(open);
            }
        }
    }

    if let Some(ref uid) = data.examination_id {
        let row: Option<(Option<f64>,)> = sqlx::query_as(
            "SELECT u.total_cost FROM examination u
             JOIN patient_chart a ON u.chart_id = a.id
             WHERE u.id = ?1 AND a.patient_id = ?2",
        )
        .bind(uid)
        .bind(&data.patient_id)
        .fetch_optional(pool)
        .await?;
        if let Some((g_opt,)) = row {
            if let Some(g) = g_opt.filter(|g| g.is_finite() && *g > 0.0) {
                let sum_paid: f64 = sqlx::query_scalar(
                    "SELECT COALESCE(SUM(amount), 0) FROM payment
                     WHERE examination_id = ?1 AND patient_id = ?2
                     AND (status IS NULL OR TRIM(UPPER(status)) != 'CANCELLED')",
                )
                .bind(uid)
                .bind(&data.patient_id)
                .fetch_one(pool)
                .await
                .unwrap_or(0.0);
                let open = round_money2(g - sum_paid).max(0.0);
                if amount > open + OPEN_BOOKING_TOLERANCE_EUR {
                    return Err(AppError::validation_code_params(
                        "error.payment.overpayment_examination",
                        &[
                            ("max", &format!("{open:.2}")),
                            ("paid", &format!("{sum_paid:.2}")),
                            ("target", &format!("{g:.2}")),
                        ],
                    ));
                }
                amount_expected = Some(open);
            }
        }
    }

    let status = compute_payment_status(amount, amount_expected);

    sqlx::query(
        "INSERT INTO payment (id, patient_id, amount, payment_method, status, service_item_id, description, treatment_id, examination_id, amount_expected, cash_verified)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0)",
    )
    .bind(&id)
    .bind(&data.patient_id)
    .bind(amount)
    .bind(&payment_method)
    .bind(status)
    .bind(&data.service_item_id)
    .bind(&data.description)
    .bind(&data.treatment_id)
    .bind(&data.examination_id)
    .bind(amount_expected)
    .execute(pool)
    .await?;

    let inserted = sqlx::query_as::<_, Payment>("SELECT * FROM payment WHERE id = ?1")
        .bind(&id)
        .fetch_one(pool)
        .await?;
    let body = serde_json::to_string(&inserted).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "payment", &id, "INSERT", &body,
    )
    .await?;
    Ok(inserted)
}

/// FA-LEIST-06: implicit release + open booking (`OUTSTANDING`, 0 €) for billable treatment.
pub async fn ensure_open_booking_for_billable_treatment(
    pool: &SqlitePool,
    treatment_id: &str,
    physician_staff_id: &str,
) -> Result<(), AppError> {
    let b = chart_repo::find_treatment_by_id(pool, treatment_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Treatment".into()))?;
    if !pricing::treatment_has_billable_service_item(b.service_name.as_deref(), b.total_cost) {
        return Ok(());
    }
    if !pricing::is_released_for_billing(
        b.released_by_physician_id.as_deref(),
        b.released_at.as_deref(),
    ) {
        chart_repo::release_treatment_for_billing(pool, treatment_id, physician_staff_id).await?;
    }
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT a.patient_id FROM treatment b
         INNER JOIN patient_chart a ON b.chart_id = a.id
         WHERE b.id = ?1",
    )
    .bind(treatment_id)
    .fetch_optional(pool)
    .await?;
    let Some((patient_id,)) = row else {
        return Ok(());
    };
    let n: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM payment
         WHERE patient_id = ?1 AND treatment_id = ?2
           AND (status IS NULL OR TRIM(UPPER(status)) != 'CANCELLED')",
    )
    .bind(&patient_id)
    .bind(treatment_id)
    .fetch_one(pool)
    .await?;
    if n.0 > 0 {
        return Ok(());
    }
    let amount_expected = b
        .total_cost
        .filter(|g| g.is_finite() && *g > OPEN_BOOKING_TOLERANCE_EUR);
    create(
        pool,
        &CreatePayment {
            patient_id,
            amount: 0.0,
            payment_method: PaymentMethod::Invoice,
            service_item_id: None,
            description: Some(
                "Created automatically after service entry: open billing (FA-LEIST-06).".into(),
            ),
            treatment_id: Some(treatment_id.to_string()),
            examination_id: None,
            amount_expected,
        },
    )
    .await?;
    Ok(())
}

/// FA-LEIST-06/07: implicit release + open booking for billable examination.
pub async fn ensure_open_booking_for_billable_examination(
    pool: &SqlitePool,
    examination_id: &str,
    physician_staff_id: &str,
) -> Result<(), AppError> {
    let u = chart_repo::find_examination_by_id(pool, examination_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Examination".into()))?;
    if !pricing::treatment_has_billable_service_item(u.service_name.as_deref(), u.total_cost) {
        return Ok(());
    }
    if !pricing::is_released_for_billing(
        u.released_by_physician_id.as_deref(),
        u.released_at.as_deref(),
    ) {
        chart_repo::release_examination_for_billing(pool, examination_id, physician_staff_id)
            .await?;
    }
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT a.patient_id FROM examination u
         INNER JOIN patient_chart a ON u.chart_id = a.id
         WHERE u.id = ?1",
    )
    .bind(examination_id)
    .fetch_optional(pool)
    .await?;
    let Some((patient_id,)) = row else {
        return Ok(());
    };
    let n: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM payment
         WHERE patient_id = ?1 AND examination_id = ?2
           AND (status IS NULL OR TRIM(UPPER(status)) != 'CANCELLED')",
    )
    .bind(&patient_id)
    .bind(examination_id)
    .fetch_one(pool)
    .await?;
    if n.0 > 0 {
        return Ok(());
    }
    let amount_expected = u
        .total_cost
        .filter(|g| g.is_finite() && *g > OPEN_BOOKING_TOLERANCE_EUR);
    create(
        pool,
        &CreatePayment {
            patient_id,
            amount: 0.0,
            payment_method: PaymentMethod::Invoice,
            service_item_id: None,
            description: Some(
                "Created automatically after service entry: open billing (FA-LEIST-06/07).".into(),
            ),
            treatment_id: None,
            examination_id: Some(examination_id.to_string()),
            amount_expected,
        },
    )
    .await?;
    Ok(())
}

/// First open booking (0 €) if no payments exist yet for this examination.
pub async fn ensure_placeholder_for_examination(
    pool: &SqlitePool,
    examination_id: &str,
) -> Result<(), AppError> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT a.patient_id FROM examination u
         INNER JOIN patient_chart a ON u.chart_id = a.id
         WHERE u.id = ?1",
    )
    .bind(examination_id)
    .fetch_optional(pool)
    .await?;
    let Some((patient_id,)) = row else {
        return Ok(());
    };
    let n: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM payment
         WHERE patient_id = ?1 AND examination_id = ?2
           AND (status IS NULL OR TRIM(UPPER(status)) != 'CANCELLED')",
    )
    .bind(&patient_id)
    .bind(examination_id)
    .fetch_one(pool)
    .await?;
    if n.0 > 0 {
        return Ok(());
    }
    create(
        pool,
        &CreatePayment {
            patient_id,
            amount: 0.0,
            payment_method: PaymentMethod::Invoice,
            service_item_id: None,
            description: Some(
                "Created automatically on insert: open billing (examination).".into(),
            ),
            treatment_id: None,
            examination_id: Some(examination_id.to_string()),
            amount_expected: None,
        },
    )
    .await?;
    Ok(())
}

pub async fn update_fields(pool: &SqlitePool, data: &UpdatePayment) -> Result<Payment, AppError> {
    let row: Option<(String, Option<String>, Option<String>, String)> = sqlx::query_as(
        "SELECT status, treatment_id, examination_id, patient_id FROM payment WHERE id = ?1",
    )
    .bind(&data.id)
    .fetch_optional(pool)
    .await?;
    let Some((st, treatment_id, examination_id, patient_id)) = row else {
        return Err(AppError::NotFound("Payment".into()));
    };
    if st != "OUTSTANDING" && st != "PARTIALLY_PAID" {
        return Err(AppError::validation_code("error.payment.edit_locked_status"));
    }
    let payment_method = serde_json::to_string(&data.payment_method)
        .map_err(|e| AppError::Internal(format!("Serialize payment type: {e}")))?
        .trim_matches('"')
        .to_uppercase();
    if data.amount <= 0.0 {
        return Err(AppError::validation_code("error.payment.amount_must_be_positive"));
    }

    if let Some(ref bid) = treatment_id {
        let row: Option<(Option<f64>,)> = sqlx::query_as(
            "SELECT b.total_cost FROM treatment b
             JOIN patient_chart a ON b.chart_id = a.id
             WHERE b.id = ?1 AND a.patient_id = ?2",
        )
        .bind(bid)
        .bind(&patient_id)
        .fetch_optional(pool)
        .await?;
        if let Some((g_opt,)) = row {
            if let Some(g) = g_opt.filter(|g| g.is_finite() && *g > 0.0) {
                let sum_others: f64 = sqlx::query_scalar(
                    "SELECT COALESCE(SUM(amount), 0) FROM payment
                     WHERE treatment_id = ?1 AND patient_id = ?2 AND id != ?3
                     AND (status IS NULL OR TRIM(UPPER(status)) != 'CANCELLED')",
                )
                .bind(bid)
                .bind(&patient_id)
                .bind(&data.id)
                .fetch_one(pool)
                .await
                .unwrap_or(0.0);
                let max_for_row = round_money2(g - sum_others).max(0.0);
                if data.amount > max_for_row + OPEN_BOOKING_TOLERANCE_EUR {
                    return Err(AppError::validation_code_params(
                        "error.payment.overpayment_edit_treatment",
                        &[("max", &format!("{max_for_row:.2}"))],
                    ));
                }
            }
        }
    }

    if let Some(ref uid) = examination_id {
        let row: Option<(Option<f64>,)> = sqlx::query_as(
            "SELECT u.total_cost FROM examination u
             JOIN patient_chart a ON u.chart_id = a.id
             WHERE u.id = ?1 AND a.patient_id = ?2",
        )
        .bind(uid)
        .bind(&patient_id)
        .fetch_optional(pool)
        .await?;
        if let Some((g_opt,)) = row {
            if let Some(g) = g_opt.filter(|g| g.is_finite() && *g > 0.0) {
                let sum_others: f64 = sqlx::query_scalar(
                    "SELECT COALESCE(SUM(amount), 0) FROM payment
                     WHERE examination_id = ?1 AND patient_id = ?2 AND id != ?3
                     AND (status IS NULL OR TRIM(UPPER(status)) != 'CANCELLED')",
                )
                .bind(uid)
                .bind(&patient_id)
                .bind(&data.id)
                .fetch_one(pool)
                .await
                .unwrap_or(0.0);
                let max_for_row = round_money2(g - sum_others).max(0.0);
                if data.amount > max_for_row + OPEN_BOOKING_TOLERANCE_EUR {
                    return Err(AppError::validation_code_params(
                        "error.payment.overpayment_edit_examination",
                        &[("max", &format!("{max_for_row:.2}"))],
                    ));
                }
            }
        }
    }

    sqlx::query(
        "UPDATE payment SET amount = ?1, payment_method = ?2, service_item_id = ?3, description = ?4 WHERE id = ?5",
    )
    .bind(data.amount)
    .bind(&payment_method)
    .bind(&data.service_item_id)
    .bind(&data.description)
    .bind(&data.id)
    .execute(pool)
    .await?;

    refresh_payment_status(pool, &data.id).await?;

    let updated = sqlx::query_as::<_, Payment>("SELECT * FROM payment WHERE id = ?1")
        .bind(&data.id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound("Payment".into()))?;
    let body =
        serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{}\"}}", data.id));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "payment", &data.id, "UPDATE", &body,
    )
    .await?;
    Ok(updated)
}

pub async fn delete_if_pending(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let row: Option<(String,)> = sqlx::query_as("SELECT status FROM payment WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    let st = row.ok_or(AppError::NotFound("Payment".into()))?.0;
    if st != "OUTSTANDING" && st != "PARTIALLY_PAID" {
        return Err(AppError::validation_code("error.payment.delete_locked_status"));
    }
    sqlx::query("DELETE FROM payment WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "payment",
        id,
        "DELETE",
        &format!("{{\"id\":\"{id}\"}}"),
    )
    .await?;
    Ok(())
}

pub async fn update_status(pool: &SqlitePool, id: &str, status: &str) -> Result<Payment, AppError> {
    sqlx::query("UPDATE payment SET status = ?1 WHERE id = ?2")
        .bind(status)
        .bind(id)
        .execute(pool)
        .await?;

    let updated = sqlx::query_as::<_, Payment>("SELECT * FROM payment WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound("Payment".into()))?;
    let body = serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "payment", id, "UPDATE", &body,
    )
    .await?;
    Ok(updated)
}

pub async fn get_balance_sheet(pool: &SqlitePool) -> Result<BalanceSheet, AppError> {
    let income: (f64,) =
        sqlx::query_as("SELECT COALESCE(SUM(amount), 0.0) FROM payment WHERE status = 'PAID'")
            .fetch_one(pool)
            .await?;

    let outstanding: (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(amount), 0.0) FROM payment WHERE status IN ('OUTSTANDING', 'PARTIALLY_PAID')",
    )
    .fetch_one(pool)
    .await?;

    let cancelled: (f64,) =
        sqlx::query_as("SELECT COALESCE(SUM(amount), 0.0) FROM payment WHERE status = 'CANCELLED'")
            .fetch_one(pool)
            .await?;

    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM payment")
        .fetch_one(pool)
        .await?;

    Ok(BalanceSheet {
        income: income.0,
        outstanding: outstanding.0,
        cancelled: cancelled.0,
        payment_count: count.0,
    })
}

/// Day close: cash check per payment (0/1).
pub async fn set_cash_verified_for_ids(
    pool: &SqlitePool,
    ids: &[String],
    cash_verified: i64,
) -> Result<u64, AppError> {
    let mut n = 0u64;
    for id in ids {
        let r = sqlx::query("UPDATE payment SET cash_verified = ?1 WHERE id = ?2")
            .bind(cash_verified)
            .bind(id)
            .execute(pool)
            .await?;
        n = n.saturating_add(r.rows_affected());
    }
    Ok(n)
}
