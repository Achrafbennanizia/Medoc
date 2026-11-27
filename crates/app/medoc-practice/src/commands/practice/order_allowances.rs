//! Cabinet+ sharing rules on the purchase-order list (T5.4): a dentist may keep "Orders placed
//! for me" to themself. The list leaves those out and says whose are missing.

use sqlx::SqlitePool;

use medoc_core::application::auth_service::Session;
use medoc_core::domain::allowances::ShareArea;
use medoc_core::domain::entities::purchase_order::PurchaseOrder;

use crate::commands::share_scope::{self, ShareScope};
use crate::error::AppError;

pub type OrderScope = ShareScope;

pub async fn scope(
    pool: &SqlitePool,
    session: &Session,
    doctor: Option<&str>,
) -> Result<OrderScope, AppError> {
    share_scope::load(pool, session, ShareArea::Orders, "purchase_order", doctor).await
}

/// Keep orders the viewer may see; optionally only one doctor's.
pub fn apply(
    scope: &OrderScope,
    doctor: Option<&str>,
    items: Vec<PurchaseOrder>,
) -> Vec<PurchaseOrder> {
    items
        .into_iter()
        .filter(|o| scope.keeps(doctor, &o.id, o.ordered_for_staff_id.as_deref()))
        .collect()
}
