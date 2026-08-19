use crate::domain::entities::service_item::{CreateServiceItem, UpdateServiceItem};
use crate::domain::entities::ServiceItem;
use crate::error::AppError;
use sqlx::SqlitePool;

pub async fn find_all(pool: &SqlitePool) -> Result<Vec<ServiceItem>, AppError> {
    let rows = sqlx::query_as::<_, ServiceItem>(
        "SELECT * FROM service_item WHERE active = 1 ORDER BY category, name",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn create(pool: &SqlitePool, data: &CreateServiceItem) -> Result<ServiceItem, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO service_item (id, name, description, category, price)
         VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(&id)
    .bind(&data.name)
    .bind(&data.description)
    .bind(&data.category)
    .bind(data.price)
    .execute(pool)
    .await?;

    let inserted = sqlx::query_as::<_, ServiceItem>("SELECT * FROM service_item WHERE id = ?1")
        .bind(&id)
        .fetch_one(pool)
        .await?;
    let body = serde_json::to_string(&inserted).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "service_item", &id, "INSERT", &body,
    )
    .await?;
    Ok(inserted)
}

pub async fn update(
    pool: &SqlitePool,
    id: &str,
    data: &UpdateServiceItem,
) -> Result<ServiceItem, AppError> {
    let existing = sqlx::query_as::<_, ServiceItem>("SELECT * FROM service_item WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound("ServiceItem".into()))?;

    sqlx::query(
        "UPDATE service_item SET name = ?1, description = ?2, category = ?3, price = ?4,
         active = ?5, updated_at = CURRENT_TIMESTAMP WHERE id = ?6",
    )
    .bind(data.name.as_deref().unwrap_or(&existing.name))
    .bind(
        data.description
            .as_deref()
            .or(existing.description.as_deref()),
    )
    .bind(data.category.as_deref().unwrap_or(&existing.category))
    .bind(data.price.unwrap_or(existing.price))
    .bind(data.active.unwrap_or(existing.active))
    .bind(id)
    .execute(pool)
    .await?;

    let updated = sqlx::query_as::<_, ServiceItem>("SELECT * FROM service_item WHERE id = ?1")
        .bind(id)
        .fetch_one(pool)
        .await?;
    let body = serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "service_item", id, "UPDATE", &body,
    )
    .await?;
    Ok(updated)
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    // Soft delete
    sqlx::query("UPDATE service_item SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    if let Ok(updated) = sqlx::query_as::<_, ServiceItem>("SELECT * FROM service_item WHERE id = ?1")
        .bind(id)
        .fetch_one(pool)
        .await
    {
        let body =
            serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
        crate::infrastructure::database::sync_outbox::record_or_noop(
            pool, "service_item", id, "UPDATE", &body,
        )
        .await?;
    }
    Ok(())
}
