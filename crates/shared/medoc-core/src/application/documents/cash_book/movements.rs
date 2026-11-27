//! Cash movements in and out of the cash box: record, reverse, list (split from `cash_book.rs`).

use super::*;

pub async fn record_cash_movement(
    pool: &SqlitePool,
    session: &Session,
    args: CashMovementArgs,
) -> Result<CashMovement, AppError> {
    require_permission(session, PERM_CASH)?;
    finance_schema::ensure(pool).await?;
    let kind = args.kind.trim().to_uppercase();
    let direction = movement_direction(&kind)?;
    if args.amount_cents <= 0 {
        return Err(AppError::validation_code("error.cash_book.bad_amount"));
    }
    let reason = args.reason.trim();
    if reason.is_empty() {
        return Err(AppError::validation_code("error.cash_book.reason_required"));
    }
    if kind == "EXPENSE"
        && args
            .receipt_ref
            .as_deref()
            .map(str::trim)
            .unwrap_or("")
            .is_empty()
    {
        // GoBD: no booking without a voucher (Belegprinzip).
        return Err(AppError::validation_code(
            "error.cash_book.voucher_required",
        ));
    }
    insert_movement(
        pool,
        session,
        &kind,
        direction,
        args.amount_cents,
        reason,
        args.receipt_ref.as_deref(),
        None,
    )
    .await
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn insert_movement(
    pool: &SqlitePool,
    session: &Session,
    kind: &str,
    direction: i64,
    amount: i64,
    reason: &str,
    receipt_ref: Option<&str>,
    reverses: Option<&str>,
) -> Result<CashMovement, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    // The line and its outbox entry commit together, so the main device's
    // day close sees cash booked on any device.
    let mut tx = pool.begin().await?;
    sqlx::query(
        "INSERT INTO cash_movement (id, kind, amount_cents, direction, reason, receipt_ref, reverses_id,
                                    occurred_at, local_day, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, strftime('%Y-%m-%d %H:%M:%S','now'),
                 date('now','localtime'), ?8)",
    )
    .bind(&id)
    .bind(kind)
    .bind(amount)
    .bind(direction)
    .bind(reason)
    .bind(receipt_ref.map(str::trim).filter(|s| !s.is_empty()))
    .bind(reverses)
    .bind(&session.user_id)
    .execute(&mut *tx)
    .await?;
    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx,
        "cash_movement",
        &id,
        "INSERT",
    )
    .await?;
    tx.commit().await?;
    let _ = audit_repo::create(
        pool,
        &session.user_id,
        "CREATE",
        "CashMovement",
        Some(&id),
        Some(&format!("kind={kind} cents={} dir={direction}", amount)),
    )
    .await;
    Ok(sqlx::query_as::<_, CashMovement>(
        "SELECT id, kind, amount_cents, direction, reason, receipt_ref, reverses_id, occurred_at,
                local_day, created_by, day_close_id FROM cash_movement WHERE id = ?1",
    )
    .bind(&id)
    .fetch_one(pool)
    .await?)
}

/// Book the opposite of a movement (it stays in the journal).
pub async fn reverse_cash_movement(
    pool: &SqlitePool,
    session: &Session,
    id: &str,
    reason: &str,
) -> Result<CashMovement, AppError> {
    require_permission(session, PERM_REVERSE)?;
    finance_schema::ensure(pool).await?;
    if reason.trim().is_empty() {
        return Err(AppError::validation_code("error.cash_book.reason_required"));
    }
    let orig = sqlx::query_as::<_, CashMovement>(
        "SELECT id, kind, amount_cents, direction, reason, receipt_ref, reverses_id, occurred_at,
                local_day, created_by, day_close_id FROM cash_movement WHERE id = ?1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("CashMovement".into()))?;
    let already: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM cash_movement WHERE reverses_id = ?1")
            .bind(id)
            .fetch_one(pool)
            .await?;
    if orig.kind == "REVERSAL" || already > 0 {
        return Err(AppError::validation_code(
            "error.cash_book.already_reversed",
        ));
    }
    insert_movement(
        pool,
        session,
        "REVERSAL",
        -orig.direction,
        orig.amount_cents,
        reason.trim(),
        orig.receipt_ref.as_deref(),
        Some(id),
    )
    .await
}

pub async fn list_cash_movements(
    pool: &SqlitePool,
    session: &Session,
    from: &str,
    to: &str,
) -> Result<Vec<CashMovement>, AppError> {
    require_permission(session, PERM_READ)?;
    finance_schema::ensure(pool).await?;
    Ok(sqlx::query_as::<_, CashMovement>(
        "SELECT id, kind, amount_cents, direction, reason, receipt_ref, reverses_id, occurred_at,
                local_day, created_by, day_close_id
           FROM cash_movement WHERE local_day BETWEEN ?1 AND ?2 ORDER BY occurred_at DESC",
    )
    .bind(from)
    .bind(to)
    .fetch_all(pool)
    .await?)
}
