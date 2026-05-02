use crate::domain::entities::DokumentTemplateUser;
use crate::error::AppError;
use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn list_for_kind(pool: &SqlitePool, kind: &str) -> Result<Vec<DokumentTemplateUser>, AppError> {
    let rows = sqlx::query_as::<_, DokumentTemplateUser>(
        "SELECT * FROM dokument_template_user WHERE kind = ?1 ORDER BY is_default DESC, name ASC",
    )
    .bind(kind)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<Option<DokumentTemplateUser>, AppError> {
    let row = sqlx::query_as::<_, DokumentTemplateUser>("SELECT * FROM dokument_template_user WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn insert(
    pool: &SqlitePool,
    id: &str,
    kind: &str,
    name: &str,
    payload: &str,
    is_default: bool,
    created_by: Option<&str>,
) -> Result<(), AppError> {
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    sqlx::query(
        "INSERT INTO dokument_template_user (id, kind, name, payload, is_default, created_by, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )
    .bind(id)
    .bind(kind)
    .bind(name)
    .bind(payload)
    .bind(if is_default { 1 } else { 0 })
    .bind(created_by)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update(
    pool: &SqlitePool,
    id: &str,
    name: &str,
    payload: &str,
    is_default: bool,
) -> Result<u64, AppError> {
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let r = sqlx::query(
        "UPDATE dokument_template_user SET name = ?2, payload = ?3, is_default = ?4, updated_at = ?5 WHERE id = ?1",
    )
    .bind(id)
    .bind(name)
    .bind(payload)
    .bind(if is_default { 1 } else { 0 })
    .bind(&now)
    .execute(pool)
    .await?;
    Ok(r.rows_affected())
}

pub async fn delete_id(pool: &SqlitePool, id: &str) -> Result<u64, AppError> {
    let r = sqlx::query("DELETE FROM dokument_template_user WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(r.rows_affected())
}

/// Höchstens eine Vorlage pro `kind` mit `is_default = 1`.
pub async fn clear_default_for_kind(pool: &SqlitePool, kind: &str) -> Result<(), AppError> {
    sqlx::query("UPDATE dokument_template_user SET is_default = 0 WHERE kind = ?1")
        .bind(kind)
        .execute(pool)
        .await?;
    Ok(())
}

pub fn new_id() -> String {
    Uuid::new_v4().to_string()
}
