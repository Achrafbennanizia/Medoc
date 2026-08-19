use crate::application::rbac::{self, FINANCE_READ_OR_RECEPTION};
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::service_item::{CreateServiceItem, UpdateServiceItem};
use crate::domain::entities::ServiceItem;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, service_item_repo};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_services(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<ServiceItem>, AppError> {
    rbac::require_one_of(&session_state, FINANCE_READ_OR_RECEPTION)?;
    service_item_repo::find_all(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_service_item(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateServiceItem,
) -> Result<ServiceItem, AppError> {
    let session = rbac::require(&session_state, "finance.write")?;
    let l = service_item_repo::create(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "ServiceItem",
        Some(&l.id),
        None,
    )
    .await
    .ok();
    Ok(l)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id, data))]
pub async fn update_service_item(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: UpdateServiceItem,
) -> Result<ServiceItem, AppError> {
    let session = rbac::require(&session_state, "finance.write")?;
    let l = service_item_repo::update(&pool, &id, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "ServiceItem",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(l)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_service_item(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "finance.write")?;
    service_item_repo::delete(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "ServiceItem",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_service_item_commands {
    () => {
        $crate::commands::service_item_commands::list_services,
        $crate::commands::service_item_commands::create_service_item,
        $crate::commands::service_item_commands::update_service_item,
        $crate::commands::service_item_commands::delete_service_item,
    };
}
