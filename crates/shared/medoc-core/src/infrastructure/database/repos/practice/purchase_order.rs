//! Persistence for [`PurchaseOrder`] (purchase orders).
//!
//! Mirrors the shape of `product_repo` for consistency with the rest of the
//! Clean Architecture data layer.

use crate::domain::entities::purchase_order::{
    is_valid_status, PurchaseOrder, CreatePurchaseOrder, UpdatePurchaseOrder, STATUS_DELIVERED, STATUS_OPEN,
};
use crate::error::AppError;
use chrono::Datelike;
use sqlx::SqlitePool;

const SELECT_COLUMNS: &str = "id, order_number, supplier, pharma_consultant, item, status, \
                              expected_on, delivered_on, quantity, unit, remark, total_amount, created_by, \
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
async fn next_order_number(pool: &SqlitePool) -> Result<String, AppError> {
    let now = chrono::Local::now().date_naive();
    let prefix = format!("B-{:04}-{:02}-", now.year(), now.month());
    let pattern = format!("{prefix}%");
    let max_seq: Option<String> =
        sqlx::query_scalar("SELECT MAX(order_number) FROM purchase_order WHERE order_number LIKE ?1")
            .bind(&pattern)
            .fetch_one(pool)
            .await?;
    let next = match max_seq.as_deref() {
        Some(prev) => prev
            .rsplit('-')
            .next()
            .and_then(|s| s.parse::<u32>().ok())
            .map(|n| n + 1)
            .unwrap_or(1),
        None => 1,
    };
    Ok(format!("{prefix}{:04}", next))
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
    sqlx::query(
        "INSERT INTO purchase_order
            (id, order_number, supplier, pharma_consultant, item, status,
             expected_on, quantity, unit, remark, total_amount, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
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
    .execute(pool)
    .await?;

    fetch_by_id(pool, &id).await
}

pub async fn update_status(
    pool: &SqlitePool,
    id: &str,
    status: &str,
) -> Result<PurchaseOrder, AppError> {
    if !is_valid_status(status) {
        return Err(AppError::Validation(format!(
            "Unknown status: {status}"
        )));
    }
    let cur = fetch_by_id(pool, id).await?;
    crate::domain::services::workflow_transitions::purchase_order_status_transition(
        &cur.status,
        status,
    )?;
    let delivered = if status == STATUS_DELIVERED {
        Some(chrono::Utc::now().date_naive().to_string())
    } else {
        None
    };
    let result = sqlx::query(
        "UPDATE purchase_order
            SET status = ?1,
                delivered_on = COALESCE(?2, delivered_on),
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?3",
    )
    .bind(status)
    .bind(delivered)
    .bind(id)
    .execute(pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("PurchaseOrder".into()));
    }
    fetch_by_id(pool, id).await
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
        return fetch_by_id(pool, id).await;
    }

    sets.push("updated_at = CURRENT_TIMESTAMP");
    let sql = format!("UPDATE purchase_order SET {} WHERE id = ?", sets.join(", "));
    let mut q = sqlx::query(&sql);
    for version in &binds {
        q = q.bind(version);
    }
    q = q.bind(id);
    let result = q.execute(pool).await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("PurchaseOrder".into()));
    }
    fetch_by_id(pool, id).await
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM purchase_order WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("PurchaseOrder".into()));
    }
    Ok(())
}

async fn fetch_by_id(pool: &SqlitePool, id: &str) -> Result<PurchaseOrder, AppError> {
    let sql = format!("SELECT {SELECT_COLUMNS} FROM purchase_order WHERE id = ?1");
    Ok(sqlx::query_as::<_, PurchaseOrder>(&sql)
        .bind(id)
        .fetch_one(pool)
        .await?)
}
