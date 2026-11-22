use crate::application::rbac;
use crate::commands::admin::auth::SessionState;
use crate::domain::entities::product::{CreateProduct, UpdateProduct};
use crate::domain::entities::Product;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::repos::practice::product as product_repo;
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_products(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<Product>, AppError> {
    rbac::require(&session_state, "product.read")?;
    product_repo::find_all(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_product(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateProduct,
) -> Result<Product, AppError> {
    let session = rbac::require(&session_state, "product.write")?;
    let p = product_repo::create(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Product",
        Some(&p.id),
        None,
    )
    .await
    .ok();
    Ok(p)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id, data))]
pub async fn update_product(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: UpdateProduct,
) -> Result<Product, AppError> {
    let session = rbac::require(&session_state, "product.write")?;
    let p = product_repo::update(&pool, &id, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Product",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(p)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_product(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "product.write")?;
    product_repo::delete(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "Product",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}
