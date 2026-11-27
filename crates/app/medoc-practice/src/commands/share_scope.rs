//! Cabinet+ sharing rules on per-doctor lists (T5.4: payments, tasks, orders). A dentist may keep
//! an area to themself (Settings → Sharing); lists leave those rows out and say whose are missing.
//! Other editions have one dentist and no rules: `load` returns an empty scope there.

use sqlx::SqlitePool;

use medoc_core::application::auth_service::Session;
use medoc_core::domain::allowances::ShareArea;

use crate::error::AppError;

/// Doctors whose rows this person does not see in one area, and single rows hidden from them.
#[derive(Debug, Default)]
pub struct ShareScope {
    pub hidden_doctors: Vec<String>,
    pub hidden_ids: Vec<String>,
}

impl ShareScope {
    /// Row `id` owned by `owner` stays in the list: not hidden, and the doctor filter (if any)
    /// matches. A row without a doctor is shared with everyone but drops out of a doctor filter.
    pub fn keeps(&self, doctor: Option<&str>, id: &str, owner: Option<&str>) -> bool {
        let owner = owner.filter(|s| !s.is_empty());
        if doctor.is_some_and(|d| owner != Some(d)) {
            return false;
        }
        if owner.is_some_and(|o| self.hidden_doctors.iter().any(|h| h == o)) {
            return false;
        }
        !self.hidden_ids.iter().any(|h| h == id)
    }
}

/// Load the viewer's scope for `area` on `table`; filtering on a hidden doctor is refused.
#[cfg(feature = "cap-allowances")]
pub async fn load(
    pool: &SqlitePool,
    session: &Session,
    area: ShareArea,
    table: &'static str,
    doctor: Option<&str>,
) -> Result<ShareScope, AppError> {
    use medoc_core::application::allowances::{self, ScopeFilter};
    let viewer = allowances::viewer_of(pool, session).await?;
    let filter = ScopeFilter::load(pool, viewer, area, table).await?;
    let hidden_doctors = filter.hidden_owners();
    if doctor.is_some_and(|d| hidden_doctors.iter().any(|h| h == d)) {
        return Err(AppError::validation_code(
            "error.access.not_allowed_by_owner",
        ));
    }
    Ok(ShareScope {
        hidden_doctors,
        hidden_ids: filter.hidden_records(),
    })
}

#[cfg(not(feature = "cap-allowances"))]
pub async fn load(
    _pool: &SqlitePool,
    _session: &Session,
    _area: ShareArea,
    _table: &'static str,
    _doctor: Option<&str>,
) -> Result<ShareScope, AppError> {
    Ok(ShareScope::default())
}
