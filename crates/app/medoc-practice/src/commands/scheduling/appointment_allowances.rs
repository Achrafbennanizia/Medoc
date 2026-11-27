//! Group sharing rules on the calendar (T5.1 / T5.3): what a dentist shares of their own agenda
//! and who may change it (`medoc_core::application::allowances`). Other editions have one
//! dentist and no rules, so these are no-ops there.

use sqlx::SqlitePool;

use medoc_core::application::auth_service::Session;

use crate::domain::entities::Appointment;
use crate::error::AppError;

#[cfg(feature = "cap-allowances")]
mod imp {
    use super::*;
    use medoc_core::application::allowances::{self, ScopeFilter};
    use medoc_core::domain::allowances::{ShareArea, Sight};

    pub async fn visible(
        pool: &SqlitePool,
        session: &Session,
        rows: Vec<Appointment>,
    ) -> Result<Vec<Appointment>, AppError> {
        let viewer = allowances::viewer_of(pool, session).await?;
        let filter = ScopeFilter::load(pool, viewer, ShareArea::Calendar, "appointment").await?;
        Ok(rows
            .into_iter()
            .filter(|a| filter.sight_of(&a.id, Some(&a.physician_id)) == Sight::Full)
            .collect())
    }

    pub async fn require_change(
        pool: &SqlitePool,
        session: &Session,
        physician_id: &str,
    ) -> Result<(), AppError> {
        let viewer = allowances::viewer_of(pool, session).await?;
        allowances::require_change(pool, &viewer, ShareArea::Calendar, Some(physician_id)).await
    }
}

#[cfg(not(feature = "cap-allowances"))]
mod imp {
    use super::*;

    pub async fn visible(
        _pool: &SqlitePool,
        _session: &Session,
        rows: Vec<Appointment>,
    ) -> Result<Vec<Appointment>, AppError> {
        Ok(rows)
    }

    pub async fn require_change(
        _pool: &SqlitePool,
        _session: &Session,
        _physician_id: &str,
    ) -> Result<(), AppError> {
        Ok(())
    }
}

/// Drops appointments hidden from this person.
pub use imp::visible;

/// May this person book, change, move or cancel in `physician_id`'s agenda?
pub use imp::require_change;

/// One appointment through [`visible`]: hidden is "not found".
pub async fn visible_one(
    pool: &SqlitePool,
    session: &Session,
    row: Appointment,
) -> Result<Appointment, AppError> {
    visible(pool, session, vec![row])
        .await?
        .pop()
        .ok_or(AppError::NotFound("Appointment".into()))
}
