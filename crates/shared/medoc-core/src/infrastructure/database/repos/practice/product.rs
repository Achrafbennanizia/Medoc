use crate::domain::entities::product::{CreateProduct, UpdateProduct};
use crate::domain::entities::Product;
use crate::error::AppError;
use sqlx::SqlitePool;

pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Product>, AppError> {
    let rows = sqlx::query_as::<_, Product>(
        "SELECT * FROM product WHERE active = 1 ORDER BY category, name",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn create(pool: &SqlitePool, data: &CreateProduct) -> Result<Product, AppError> {
    crate::domain::services::pricing::require_non_negative_amount(data.price, "Price")?;
    if data.stock < 0 || data.min_stock < 0 {
        return Err(AppError::Validation("Stock must be zero or more".into()));
    }
    let id = uuid::Uuid::new_v4().to_string();
    let mut tx = pool.begin().await?;
    sqlx::query(
        "INSERT INTO product (id, name, description, category, price, stock, min_stock, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    )
    .bind(&id)
    .bind(&data.name)
    .bind(&data.description)
    .bind(&data.category)
    .bind(data.price)
    .bind(data.stock)
    .bind(data.min_stock)
    .execute(&mut *tx)
    .await?;
    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx, "product", &id, "INSERT",
    )
    .await?;
    tx.commit().await?;

    Ok(
        sqlx::query_as::<_, Product>("SELECT * FROM product WHERE id = ?1")
            .bind(&id)
            .fetch_one(pool)
            .await?,
    )
}

pub async fn update(
    pool: &SqlitePool,
    id: &str,
    data: &UpdateProduct,
) -> Result<Product, AppError> {
    if let Some(p) = data.price {
        crate::domain::services::pricing::require_non_negative_amount(p, "Price")?;
    }
    if data.stock.is_some_and(|v| v < 0) || data.min_stock.is_some_and(|v| v < 0) {
        return Err(AppError::Validation("Stock must be zero or more".into()));
    }
    let existing = sqlx::query_as::<_, Product>("SELECT * FROM product WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound("Product".into()))?;

    let mut tx = pool.begin().await?;
    sqlx::query(
        "UPDATE product SET name = ?1, description = ?2, category = ?3, price = ?4,
         stock = ?5, min_stock = ?6, active = ?7, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?8",
    )
    .bind(data.name.as_deref().unwrap_or(&existing.name))
    .bind(
        data.description
            .as_deref()
            .or(existing.description.as_deref()),
    )
    .bind(data.category.as_deref().unwrap_or(&existing.category))
    .bind(data.price.unwrap_or(existing.price))
    .bind(data.stock.unwrap_or(existing.stock))
    .bind(data.min_stock.unwrap_or(existing.min_stock))
    .bind(data.active.unwrap_or(existing.active))
    .bind(id)
    .execute(&mut *tx)
    .await?;
    crate::infrastructure::database::recorded_write::record_in_tx(&mut tx, "product", id, "UPDATE")
        .await?;
    tx.commit().await?;

    Ok(
        sqlx::query_as::<_, Product>("SELECT * FROM product WHERE id = ?1")
            .bind(id)
            .fetch_one(pool)
            .await?,
    )
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;
    let n = sqlx::query(
        "UPDATE product SET active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    // F92: deleting an unknown id was reported as success.
    if n != 1 {
        return Err(AppError::NotFound("Product".into()));
    }
    crate::infrastructure::database::recorded_write::record_in_tx(&mut tx, "product", id, "UPDATE")
        .await?;
    tx.commit().await?;
    Ok(())
}
