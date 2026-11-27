//! Cabinet+ sharing rules on the payment list (T5.4): a dentist may keep "Payments for me" to
//! themself or the other dentist (Settings → Sharing). The list leaves those out and says whose
//! are missing; totals and the cash book stay complete (legal records). Other editions have one
//! dentist and no rules.

use sqlx::SqlitePool;

use medoc_core::application::auth_service::Session;

use crate::error::AppError;

/// Doctors whose payments this person does not see, and single payments hidden from them.
#[derive(Debug, Default)]
pub struct PaymentScope {
    pub hidden_doctors: Vec<String>,
    pub hidden_ids: Vec<String>,
}

#[cfg(feature = "cap-allowances")]
pub async fn scope(
    pool: &SqlitePool,
    session: &Session,
    doctor: Option<&str>,
) -> Result<PaymentScope, AppError> {
    use medoc_core::application::allowances::{self, ScopeFilter};
    use medoc_core::domain::allowances::ShareArea;
    let viewer = allowances::viewer_of(pool, session).await?;
    let filter = ScopeFilter::load(pool, viewer, ShareArea::Payments, "payment").await?;
    let hidden_doctors = filter.hidden_owners();
    if doctor.is_some_and(|d| hidden_doctors.iter().any(|h| h == d)) {
        return Err(AppError::validation_code("error.access.not_allowed_by_owner"));
    }
    Ok(PaymentScope {
        hidden_doctors,
        hidden_ids: filter.hidden_records(),
    })
}

#[cfg(not(feature = "cap-allowances"))]
pub async fn scope(
    _pool: &SqlitePool,
    _session: &Session,
    _doctor: Option<&str>,
) -> Result<PaymentScope, AppError> {
    Ok(PaymentScope::default())
}
