//! Open bookings for billable treatments and examinations (placeholders until paid).

use super::*;

pub(super) fn open_booking_description(
    service_name: Option<&str>,
    _total_cost: Option<f64>,
) -> String {
    service_name
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("")
        .to_string()
}

pub(super) async fn refresh_zero_open_booking_from_clinical(
    pool: &SqlitePool,
    payment_id: &str,
    amount_expected: Option<f64>,
    description: &str,
) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;
    sqlx::query(
        "UPDATE payment SET
            amount_expected = ?1,
            description = ?2,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?3
           AND amount <= ?4
           AND TRIM(UPPER(COALESCE(status, ''))) IN ('OUTSTANDING', 'PARTIALLY_PAID')",
    )
    .bind(amount_expected)
    .bind(description)
    .bind(payment_id)
    .bind(pricing::PAYMENT_BOOKING_TOLERANCE_EUR)
    .execute(&mut *tx)
    .await?;
    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx, "payment", payment_id, "UPDATE",
    )
    .await?;
    tx.commit().await?;
    Ok(())
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
    let amount_expected = b
        .total_cost
        .filter(|g| g.is_finite() && *g > pricing::PAYMENT_BOOKING_TOLERANCE_EUR);
    let description = open_booking_description(b.service_name.as_deref(), b.total_cost);

    let existing: Option<(String, f64)> = sqlx::query_as(
        "SELECT id, amount FROM payment
         WHERE patient_id = ?1 AND treatment_id = ?2
           AND (status IS NULL OR TRIM(UPPER(status)) != 'CANCELLED')
         ORDER BY datetime(created_at) ASC
         LIMIT 1",
    )
    .bind(&patient_id)
    .bind(treatment_id)
    .fetch_optional(pool)
    .await?;
    if let Some((id, amt)) = existing {
        if amt <= pricing::PAYMENT_BOOKING_TOLERANCE_EUR {
            refresh_zero_open_booking_from_clinical(pool, &id, amount_expected, &description)
                .await?;
        }
        return Ok(());
    }

    create(
        pool,
        &CreatePayment {
            patient_id,
            amount: 0.0,
            payment_method: PaymentMethod::Invoice,
            service_item_id: None,
            description: Some(description),
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
    let amount_expected = u
        .total_cost
        .filter(|g| g.is_finite() && *g > pricing::PAYMENT_BOOKING_TOLERANCE_EUR);
    let description = open_booking_description(u.service_name.as_deref(), u.total_cost);

    let existing: Option<(String, f64)> = sqlx::query_as(
        "SELECT id, amount FROM payment
         WHERE patient_id = ?1 AND examination_id = ?2
           AND (status IS NULL OR TRIM(UPPER(status)) != 'CANCELLED')
         ORDER BY datetime(created_at) ASC
         LIMIT 1",
    )
    .bind(&patient_id)
    .bind(examination_id)
    .fetch_optional(pool)
    .await?;
    if let Some((id, amt)) = existing {
        if amt <= pricing::PAYMENT_BOOKING_TOLERANCE_EUR {
            refresh_zero_open_booking_from_clinical(pool, &id, amount_expected, &description)
                .await?;
        }
        return Ok(());
    }

    create(
        pool,
        &CreatePayment {
            patient_id,
            amount: 0.0,
            payment_method: PaymentMethod::Invoice,
            service_item_id: None,
            description: Some(description),
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
            description: None,
            treatment_id: None,
            examination_id: Some(examination_id.to_string()),
            amount_expected: None,
        },
    )
    .await?;
    Ok(())
}
