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
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO product (id, name, description, category, price, stock, min_stock)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
    .bind(&id)
    .bind(&data.name)
    .bind(&data.description)
    .bind(&data.category)
    .bind(data.price)
    .bind(data.stock)
    .bind(data.min_stock)
    .execute(pool)
    .await?;

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
    let existing = sqlx::query_as::<_, Product>("SELECT * FROM product WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound("Product".into()))?;

    sqlx::query(
        "UPDATE product SET name = ?1, description = ?2, category = ?3, price = ?4,
         stock = ?5, min_stock = ?6, active = ?7, updated_at = CURRENT_TIMESTAMP WHERE id = ?8"
    )
    .bind(data.name.as_deref().unwrap_or(&existing.name))
    .bind(data.description.as_deref().or(existing.description.as_deref()))
    .bind(data.category.as_deref().unwrap_or(&existing.category))
    .bind(data.price.unwrap_or(existing.price))
    .bind(data.stock.unwrap_or(existing.stock))
    .bind(data.min_stock.unwrap_or(existing.min_stock))
    .bind(data.active.unwrap_or(existing.active))
    .bind(id)
    .execute(pool)
    .await?;

    Ok(
        sqlx::query_as::<_, Product>("SELECT * FROM product WHERE id = ?1")
            .bind(id)
            .fetch_one(pool)
            .await?,
    )
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query("UPDATE product SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
