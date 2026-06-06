//! Personal/staff persistence port — implemented by `database::repos::admin::personal`.

use std::future::Future;

use sqlx::SqlitePool;

use crate::domain::entities::Personal;
use crate::error::AppError;

/// Read-side contract for staff lookup (extend with write methods as needed).
pub trait PersonalRepository: Send + Sync {
    fn find_by_email(
        &self,
        email: &str,
    ) -> impl Future<Output = Result<Option<Personal>, AppError>> + Send;
}

/// Default SQLite adapter — delegates to the existing repo functions.
#[derive(Clone, Copy)]
pub struct SqlitePersonalRepository<'a>(pub &'a SqlitePool);

impl PersonalRepository for SqlitePersonalRepository<'_> {
    async fn find_by_email(&self, email: &str) -> Result<Option<Personal>, AppError> {
        crate::infrastructure::database::personal_repo::find_by_email(self.0, email).await
    }
}
