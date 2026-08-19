//! Binary attachments for the patient record (files under `app_data_dir/chart_attachments/{chart_id}/`).

use std::path::{Path, PathBuf};

use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppError;

pub const ATTACHMENT_MAX_BYTES: usize = 50 * 1024 * 1024;

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct ChartAttachmentRow {
    pub id: String,
    pub chart_id: String,
    pub display_name: String,
    pub mime_type: String,
    pub size_bytes: i64,
    /// Relative to `app_data_dir`, e.g. `chart_attachments/{chart_id}/{id}.pdf`
    pub rel_storage_path: String,
    /// Predefined category (e.g. MRT, LAB); see normalization in commands.
    pub document_kind: String,
    pub created_at: String,
}

fn extension_from_name(name: &str) -> &'static str {
    let lower = name.to_lowercase();
    const PAIRS: &[(&str, &str)] = &[
        (".pdf", ".pdf"),
        (".jpg", ".jpg"),
        (".jpeg", ".jpg"),
        (".png", ".png"),
        (".webp", ".webp"),
        (".heic", ".heic"),
        (".heif", ".heif"),
        (".gif", ".gif"),
        (".bmp", ".bmp"),
        (".tif", ".tif"),
        (".tiff", ".tif"),
        (".dcm", ".dcm"),
    ];
    for (suffix, ext) in PAIRS {
        if lower.ends_with(suffix) {
            return ext;
        }
    }
    ".bin"
}

pub fn storage_dir_for_chart(app_data_dir: &Path, chart_id: &str) -> PathBuf {
    app_data_dir.join("chart_attachments").join(chart_id)
}

pub fn absolute_path(app_data_dir: &Path, rel: &str) -> PathBuf {
    app_data_dir.join(rel)
}

/// After successfully deleting the record(s) from the DB: remove the folder.
pub fn remove_storage_dir_best_effort(app_data_dir: &Path, chart_id: &str) {
    let dir = storage_dir_for_chart(app_data_dir, chart_id);
    if dir.is_dir() {
        let _ = std::fs::remove_dir_all(&dir);
    }
}

pub async fn list_for_chart(
    pool: &SqlitePool,
    chart_id: &str,
) -> Result<Vec<ChartAttachmentRow>, AppError> {
    let rows = sqlx::query_as::<_, ChartAttachmentRow>(
        "SELECT id, chart_id, display_name, mime_type, size_bytes, rel_storage_path, document_kind, created_at
         FROM chart_attachment WHERE chart_id = ?1 ORDER BY created_at DESC",
    )
    .bind(chart_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(rows)
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<ChartAttachmentRow>, AppError> {
    let row = sqlx::query_as::<_, ChartAttachmentRow>(
        "SELECT id, chart_id, display_name, mime_type, size_bytes, rel_storage_path, document_kind, created_at
         FROM chart_attachment WHERE id = ?1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(row)
}

pub async fn create(
    pool: &SqlitePool,
    app_data_dir: &Path,
    chart_id: &str,
    display_name: &str,
    mime_type: &str,
    document_kind: &str,
    bytes: &[u8],
) -> Result<ChartAttachmentRow, AppError> {
    if bytes.len() > ATTACHMENT_MAX_BYTES {
        return Err(AppError::validation_code("error.attachment.file_too_large"));
    }

    let (cnt,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM patient_chart WHERE id = ?1")
        .bind(chart_id)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
    if cnt == 0 {
        return Err(AppError::NotFound("error.entity.patient_chart".into()));
    }

    let id = Uuid::new_v4().to_string();
    let ext = extension_from_name(display_name);
    let rel = format!("chart_attachments/{chart_id}/{id}{ext}");

    let dir = storage_dir_for_chart(app_data_dir, chart_id);
    std::fs::create_dir_all(&dir).map_err(|e| {
        AppError::Internal(format!("Could not create attachment folder: {e}"))
    })?;

    let disk_path = absolute_path(app_data_dir, &rel);
    std::fs::write(&disk_path, bytes)
        .map_err(|e| AppError::Internal(format!("Could not save file: {e}")))?;

    let size_i64 = i64::try_from(bytes.len()).map_err(|_| {
        AppError::Internal("File size outside supported range".into())
    })?;

    let created = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO chart_attachment (id, chart_id, display_name, mime_type, size_bytes, rel_storage_path, document_kind, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )
    .bind(&id)
    .bind(chart_id)
    .bind(display_name)
    .bind(mime_type)
    .bind(size_i64)
    .bind(&rel)
    .bind(document_kind)
    .bind(&created)
    .execute(pool)
    .await
    .map_err(|e| {
        let _ = std::fs::remove_file(&disk_path);
        AppError::Database(e)
    })?;

    find_by_id(pool, &id)
        .await?
        .ok_or_else(|| AppError::Internal("Attachment not readable after insert".into()))
}

pub async fn update_display_name(
    pool: &SqlitePool,
    id: &str,
    display_name: &str,
) -> Result<(), AppError> {
    let trimmed = display_name.trim();
    if trimmed.is_empty() {
        return Err(AppError::validation_code("error.attachment.label_empty"));
    }
    let n = sqlx::query("UPDATE chart_attachment SET display_name = ?1 WHERE id = ?2")
        .bind(trimmed)
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?
        .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("error.entity.chart_attachment".into()));
    }
    Ok(())
}

pub async fn update_document_kind(
    pool: &SqlitePool,
    id: &str,
    document_kind: &str,
) -> Result<(), AppError> {
    let trimmed = document_kind.trim();
    if trimmed.is_empty() {
        return Err(AppError::validation_code("error.attachment.doc_type_empty"));
    }
    let n = sqlx::query("UPDATE chart_attachment SET document_kind = ?1 WHERE id = ?2")
        .bind(trimmed)
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?
        .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("error.entity.chart_attachment".into()));
    }
    Ok(())
}

pub async fn delete_row_and_file(
    pool: &SqlitePool,
    app_data_dir: &Path,
    id: &str,
) -> Result<(), AppError> {
    let row = find_by_id(pool, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Chart-Attachment".into()))?;
    sqlx::query("DELETE FROM chart_attachment WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    let path = absolute_path(app_data_dir, &row.rel_storage_path);
    if path.is_file() {
        let _ = std::fs::remove_file(&path);
    }
    let dir = storage_dir_for_chart(app_data_dir, &row.chart_id);
    if dir.is_dir() {
        let empty = std::fs::read_dir(&dir)
            .map(|mut d| d.next().is_none())
            .unwrap_or(false);
        if empty {
            let _ = std::fs::remove_dir(&dir);
        }
    }
    Ok(())
}

#[cfg(test)]
#[test]
fn chart_attachment_extension_mapping_common_formats() {
    assert_eq!(extension_from_name("x.webp"), ".webp");
    assert_eq!(extension_from_name("X.WEBP"), ".webp");
    assert_eq!(extension_from_name("a.heic"), ".heic");
    assert_eq!(extension_from_name("b.heif"), ".heif");
}
