//! Cabinet+ sharing rules on the payment list (T5.4): a dentist may keep "Payments for me" to
//! themself or the other dentist (Settings → Sharing). The list leaves those out and says whose
//! are missing; totals and the cash book stay complete (legal records).

use sqlx::SqlitePool;

use medoc_core::application::auth_service::Session;
use medoc_core::domain::allowances::ShareArea;

use crate::commands::share_scope::{self, ShareScope};
use crate::error::AppError;

pub type PaymentScope = ShareScope;

pub async fn scope(
    pool: &SqlitePool,
    session: &Session,
    doctor: Option<&str>,
) -> Result<PaymentScope, AppError> {
    share_scope::load(pool, session, ShareArea::Payments, "payment", doctor).await
}
