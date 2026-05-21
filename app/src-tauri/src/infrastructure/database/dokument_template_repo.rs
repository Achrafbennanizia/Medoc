use crate::domain::entities::DokumentTemplateUser;
use crate::error::AppError;
use sqlx::SqlitePool;

pub async fn list_for_kind(
    pool: &SqlitePool,
    kind: &str,
) -> Result<Vec<DokumentTemplateUser>, AppError> {
    let rows = sqlx::query_as::<_, DokumentTemplateUser>(
        "SELECT * FROM dokument_template_user WHERE kind = ?1 ORDER BY is_default DESC, name ASC",
    )
    .bind(kind)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}
