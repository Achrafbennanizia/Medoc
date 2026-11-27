//! Cabinet+ sharing rules on the practice-task admin list (T5.4): a dentist may keep "My tasks"
//! to themself. Personal inboxes stay unfiltered so an assignee can still do the work.

use sqlx::SqlitePool;

use medoc_core::application::auth_service::Session;
use medoc_core::domain::allowances::ShareArea;

use crate::commands::share_scope::{self, ShareScope};
use crate::error::AppError;

pub type TaskScope = ShareScope;

pub async fn scope(
    pool: &SqlitePool,
    session: &Session,
    doctor: Option<&str>,
) -> Result<TaskScope, AppError> {
    share_scope::load(pool, session, ShareArea::Tasks, "practice_task", doctor).await
}
