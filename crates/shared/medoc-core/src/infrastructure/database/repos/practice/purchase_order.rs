//! Persistence for [`PurchaseOrder`] (purchase orders).
//!
//! Mirrors the shape of `product_repo` for consistency with the rest of the
//! Clean Architecture data layer.

use crate::domain::entities::purchase_order::{
    is_valid_status, CreatePurchaseOrder, PurchaseOrder, UpdatePurchaseOrder, STATUS_DELIVERED,
    STATUS_OPEN,
};
use crate::error::AppError;
use sqlx::SqlitePool;

const SELECT_COLUMNS: &str = "id, order_number, supplier, pharma_consultant, item, status, \
                              expected_on, delivered_on, quantity, unit, remark, total_amount, created_by, \
                              ordered_for_staff_id, paid_by_staff_id, approved_by, \
                              created_at, updated_at";

pub async fn find_all(pool: &SqlitePool) -> Result<Vec<PurchaseOrder>, AppError> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM purchase_order
          ORDER BY
            CASE status WHEN 'OPEN' THEN 0 WHEN 'IN_TRANSIT' THEN 1 WHEN 'DELIVERED' THEN 2 ELSE 3 END,
            COALESCE(expected_on, created_at) DESC"
    );
    let rows = sqlx::query_as::<_, PurchaseOrder>(&sql)
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

/// Generate the next free order number for the current year/month, e.g.
/// `B-2026-04-0007`. Cheap to compute (one indexed COUNT(*) per call) and
/// never decreases, so audits stay legible.
/// Local fallback (main device / standalone). Replicas get their number from
/// the main device before calling [`create`] (see the desktop command).
async fn next_order_number(pool: &SqlitePool) -> Result<String, AppError> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    crate::infrastructure::database::number_sequence::allocate_styled(
        pool,
        "B",
        &today,
        crate::infrastructure::database::number_sequence::NumberStyle::Monthly,
    )
    .await
}

pub async fn create(
    pool: &SqlitePool,
    data: &CreatePurchaseOrder,
    created_by: &str,
) -> Result<PurchaseOrder, AppError> {
    if data.supplier.trim().is_empty() {
        return Err(AppError::Validation("Supplier required".into()));
    }
    if data.item.trim().is_empty() {
        return Err(AppError::Validation("Item required".into()));
    }
    if data.quantity <= 0 {
        return Err(AppError::Validation("Quantity must be positive".into()));
    }
    if let Some(g) = data.total_amount {
        if !g.is_finite() || g < 0.0 {
            return Err(AppError::Validation("Total amount invalid".into()));
        }
    }
    let order_number = match data.order_number.as_ref().map(|s| s.trim()) {
        Some(s) if !s.is_empty() => s.to_string(),
        _ => next_order_number(pool).await?,
    };
    let id = uuid::Uuid::new_v4().to_string();
    let mut tx = pool.begin().await?;
    let staff_opt = |s: &Option<String>| {
        s.as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(str::to_string)
    };
    sqlx::query(
        "INSERT INTO purchase_order
            (id, order_number, supplier, pharma_consultant, item, status,
             expected_on, quantity, unit, remark, total_amount, created_by,
             ordered_for_staff_id, paid_by_staff_id, approved_by, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15,
                 strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    )
    .bind(&id)
    .bind(&order_number)
    .bind(data.supplier.trim())
    .bind(
        data.pharma_consultant
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty()),
    )
    .bind(data.item.trim())
    .bind(STATUS_OPEN)
    .bind(data.expected_on.as_deref())
    .bind(data.quantity)
    .bind(
        data.unit
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty()),
    )
    .bind(
        data.remark
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty()),
    )
    .bind(data.total_amount)
    .bind(created_by)
    .bind(staff_opt(&data.ordered_for_staff_id))
    .bind(staff_opt(&data.paid_by_staff_id))
    .bind(staff_opt(&data.approved_by))
    .execute(&mut *tx)
    .await?;
    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx,
        "purchase_order",
        &id,
        "INSERT",
    )
    .await?;
    tx.commit().await?;

    find_by_id(pool, &id).await
}

pub async fn update_status(
    pool: &SqlitePool,
    id: &str,
    status: &str,
) -> Result<PurchaseOrder, AppError> {
    if !is_valid_status(status) {
        return Err(AppError::Validation(format!("Unknown status: {status}")));
    }
    let cur = find_by_id(pool, id).await?;
    crate::domain::services::workflow_transitions::purchase_order_status_transition(
        &cur.status,
        status,
    )?;
    let delivered = if status == STATUS_DELIVERED {
        let tz = crate::domain::practice_time::practice_tz(pool).await;
        Some(
            chrono::Utc::now()
                .with_timezone(&tz)
                .date_naive()
                .to_string(),
        )
    } else {
        None
    };
    let mut tx = pool.begin().await?;
    // F81: on the transition to DELIVERED (never again after), add the ordered
    // quantity to the stock of the active product with the same name.
    if status == STATUS_DELIVERED && cur.status != STATUS_DELIVERED {
        let product_ids: Vec<String> = sqlx::query_scalar(
            "SELECT id FROM product WHERE active = 1 AND LOWER(TRIM(name)) = LOWER(TRIM(?1))",
        )
        .bind(&cur.item)
        .fetch_all(&mut *tx)
        .await?;
        if product_ids.len() == 1 {
            sqlx::query(
                "UPDATE product SET stock = COALESCE(stock, 0) + ?1,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?2",
            )
            .bind(cur.quantity)
            .bind(&product_ids[0])
            .execute(&mut *tx)
            .await?;
            crate::infrastructure::database::recorded_write::record_in_tx(
                &mut tx,
                "product",
                &product_ids[0],
                "UPDATE",
            )
            .await?;
        }
    }
    let result = sqlx::query(
        "UPDATE purchase_order
            SET status = ?1,
                delivered_on = COALESCE(?2, delivered_on),
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id = ?3",
    )
    .bind(status)
    .bind(delivered)
    .bind(id)
    .execute(&mut *tx)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("PurchaseOrder".into()));
    }
    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx,
        "purchase_order",
        id,
        "UPDATE",
    )
    .await?;
    tx.commit().await?;
    find_by_id(pool, id).await
}

pub async fn update(
    pool: &SqlitePool,
    id: &str,
    data: &UpdatePurchaseOrder,
) -> Result<PurchaseOrder, AppError> {
    // Validate the patch before constructing dynamic SQL.
    if let Some(l) = &data.supplier {
        if l.trim().is_empty() {
            return Err(AppError::Validation("Supplier required".into()));
        }
    }
    if let Some(a) = &data.item {
        if a.trim().is_empty() {
            return Err(AppError::Validation("Item required".into()));
        }
    }
    if let Some(m) = data.quantity {
        if m <= 0 {
            return Err(AppError::Validation("Quantity must be positive".into()));
        }
    }

    let mut sets: Vec<&'static str> = Vec::new();
    let mut binds: Vec<Option<String>> = Vec::new();

    if data.supplier.is_some() {
        sets.push("supplier = ?");
        binds.push(data.supplier.as_ref().map(|s| s.trim().to_string()));
    }
    if data.item.is_some() {
        sets.push("item = ?");
        binds.push(data.item.as_ref().map(|s| s.trim().to_string()));
    }
    if let Some(m) = data.quantity {
        // F84: keep the total in step with the quantity (unit price = old total / old
        // quantity). SET expressions read the old column values, so order is irrelevant.
        sets.push(
            "total_amount = CASE WHEN total_amount IS NULL OR quantity <= 0 THEN total_amount \
             ELSE ROUND(total_amount * CAST(? AS REAL) / quantity, 2) END",
        );
        binds.push(Some(m.to_string()));
        sets.push("quantity = ?");
        binds.push(Some(m.to_string()));
    }
    if let Some(opt) = &data.unit {
        sets.push("unit = ?");
        binds.push(
            opt.as_ref()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty()),
        );
    }
    if let Some(opt) = &data.expected_on {
        sets.push("expected_on = ?");
        binds.push(opt.clone().filter(|s| !s.is_empty()));
    }
    if let Some(opt) = &data.remark {
        sets.push("remark = ?");
        binds.push(
            opt.as_ref()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty()),
        );
    }
    if let Some(opt) = &data.order_number {
        sets.push("order_number = ?");
        binds.push(
            opt.as_ref()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty()),
        );
    }
    if let Some(opt) = &data.pharma_consultant {
        sets.push("pharma_consultant = ?");
        binds.push(
            opt.as_ref()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty()),
        );
    }

    if sets.is_empty() {
        return find_by_id(pool, id).await;
    }

    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
    let sql = format!("UPDATE purchase_order SET {} WHERE id = ?", sets.join(", "));
    let mut q = sqlx::query(&sql);
    for version in &binds {
        q = q.bind(version);
    }
    q = q.bind(id);
    let mut tx = pool.begin().await?;
    let result = q.execute(&mut *tx).await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("PurchaseOrder".into()));
    }
    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx,
        "purchase_order",
        id,
        "UPDATE",
    )
    .await?;
    tx.commit().await?;
    find_by_id(pool, id).await
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;
    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx,
        "purchase_order",
        id,
        "DELETE",
    )
    .await?;
    let result = sqlx::query("DELETE FROM purchase_order WHERE id = ?1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("PurchaseOrder".into()));
    }
    Ok(())
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<PurchaseOrder, AppError> {
    let sql = format!("SELECT {SELECT_COLUMNS} FROM purchase_order WHERE id = ?1");
    Ok(sqlx::query_as::<_, PurchaseOrder>(&sql)
        .bind(id)
        .fetch_one(pool)
        .await?)
}
