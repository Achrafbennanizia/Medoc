//! Staff/staff persistence port — implemented by `database::repos::admin::staff`.

use std::future::Future;

use sqlx::SqlitePool;

use crate::domain::entities::Staff;
use crate::error::AppError;

/// Read-side contract for staff lookup (extend with write methods as needed).
pub trait StaffRepository: Send + Sync {
    fn find_by_email(
        &self,
        email: &str,
    ) -> impl Future<Output = Result<Option<Staff>, AppError>> + Send;
}

/// Default SQLite adapter — delegates to the existing repo functions.
#[derive(Clone, Copy)]
pub struct SqliteStaffRepository<'a>(pub &'a SqlitePool);

impl StaffRepository for SqliteStaffRepository<'_> {
    async fn find_by_email(&self, email: &str) -> Result<Option<Staff>, AppError> {
        crate::infrastructure::database::staff_repo::find_by_email(self.0, email).await
    }
}
