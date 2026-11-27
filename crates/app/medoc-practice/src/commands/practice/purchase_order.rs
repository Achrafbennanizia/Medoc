//! Tauri commands for purchase orders.
//!
//! - RBAC enforced via [`rbac::require`] with `purchase_order.read`/`purchase_order.write`.
//! - Mutations are recorded in the audit log so the inventory trail is auditable.
use crate::application::rbac;
use crate::commands::admin::auth::SessionState;
use crate::domain::entities::purchase_order::{
    CreatePurchaseOrder, PurchaseOrder, UpdatePurchaseOrder,
};
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::repos::practice::purchase_order as purchase_order_repo;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseOrderList {
    pub items: Vec<PurchaseOrder>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub hidden_doctors: Vec<String>,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_purchase_orders(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    doctor_id: Option<String>,
) -> Result<PurchaseOrderList, AppError> {
    let session = rbac::require(&session_state, "purchase_order.read")?;
    let doctor = doctor_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let scope = super::order_allowances::scope(&pool, &session, doctor).await?;
    let items = purchase_order_repo::find_all(&pool).await?;
    Ok(PurchaseOrderList {
        items: super::order_allowances::apply(&scope, doctor, items),
        hidden_doctors: scope.hidden_doctors,
    })
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_purchase_order(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreatePurchaseOrder,
) -> Result<PurchaseOrder, AppError> {
    #[cfg(feature = "cap-guest-inbox")]
    {
        // Solo guest may confirm deliveries but never place a new order.
        let early = rbac::require_authenticated(&session_state)?;
        if rbac::Role::parse(&early.role) == Some(rbac::Role::Reception) {
            return Err(AppError::validation_code(
                "error.guest.order_create_forbidden",
            ));
        }
    }
    let session = rbac::require(&session_state, "purchase_order.write")?;
    let mut data = data;
    // F85: order numbers come from the cluster sequence (main device), not MAX+1.
    if data
        .order_number
        .as_deref()
        .map(str::trim)
        .unwrap_or("")
        .is_empty()
    {
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        data.order_number = Some(
            medoc_sync::numbering::allocate_document_number(
                pool.inner(),
                "B",
                &today,
                medoc_core::infrastructure::database::number_sequence::NumberStyle::Monthly,
            )
            .await?,
        );
    }
    let b = purchase_order_repo::create(&pool, &data, &session.user_id).await?;
    crate::commands::ownership::stamp_created(&pool, &session, "purchase_order", &b.id, None)
        .await?;
    let b = purchase_order_repo::find_by_id(&pool, &b.id)
        .await
        .unwrap_or(b);
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
    use crate::domain::entities::purchase_order::{STATUS_DELIVERED, STATUS_IN_TRANSIT};
    let status_trim = status.trim();
    let session = if status_trim == STATUS_IN_TRANSIT || status_trim == STATUS_DELIVERED {
        // Guests (and anyone with receive) may mark in transit / delivered.
        match rbac::require(&session_state, "purchase_order.receive") {
            Ok(s) => s,
            Err(_) => rbac::require(&session_state, "purchase_order.write")?,
        }
    } else {
        rbac::require(&session_state, "purchase_order.write")?
    };
    let b = purchase_order_repo::update_status(&pool, &id, status_trim).await?;
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
