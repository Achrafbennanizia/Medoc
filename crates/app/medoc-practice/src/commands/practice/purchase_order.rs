//! Tauri commands for purchase orders.
//!
//! - RBAC enforced via [`rbac::require`] with `purchase_order.read`/`purchase_order.write`.
//! - Mutations are recorded in the audit log so the inventory trail is auditable.
use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::purchase_order::{PurchaseOrder, CreatePurchaseOrder, UpdatePurchaseOrder};
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, purchase_order_repo};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_purchase_orders(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<PurchaseOrder>, AppError> {
    rbac::require(&session_state, "purchase_order.read")?;
    purchase_order_repo::find_all(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_purchase_order(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreatePurchaseOrder,
) -> Result<PurchaseOrder, AppError> {
    let session = rbac::require(&session_state, "purchase_order.write")?;
    let b = purchase_order_repo::create(&pool, &data, &session.user_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "PurchaseOrder",
        Some(&b.id),
        Some(&format!(
            "supplier={};item={};quantity={}",
            b.supplier, b.item, b.quantity
        )),
    )
    .await
    .ok();
    Ok(b)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn update_purchase_order_status(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    status: String,
) -> Result<PurchaseOrder, AppError> {
    let session = rbac::require(&session_state, "purchase_order.write")?;
    let b = purchase_order_repo::update_status(&pool, &id, &status).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE_STATUS",
        "PurchaseOrder",
        Some(&id),
        Some(&format!("status={status}")),
    )
    .await
    .ok();
    Ok(b)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_purchase_order(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: UpdatePurchaseOrder,
) -> Result<PurchaseOrder, AppError> {
    let session = rbac::require(&session_state, "purchase_order.write")?;
    let b = purchase_order_repo::update(&pool, &id, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "PurchaseOrder",
        Some(&id),
        Some(&format!(
            "supplier={};item={};quantity={}",
            b.supplier, b.item, b.quantity
        )),
    )
    .await
    .ok();
    Ok(b)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn delete_purchase_order(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "purchase_order.write")?;
    purchase_order_repo::delete(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "PurchaseOrder",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_purchase_order_commands {
    () => {
        $crate::commands::purchase_order_commands::list_purchase_orders,
        $crate::commands::purchase_order_commands::create_purchase_order,
        $crate::commands::purchase_order_commands::update_purchase_order_status,
        $crate::commands::purchase_order_commands::update_purchase_order,
        $crate::commands::purchase_order_commands::delete_purchase_order,
    };
}
