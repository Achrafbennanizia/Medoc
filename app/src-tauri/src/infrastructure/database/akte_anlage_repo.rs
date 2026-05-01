//! Binär-Anlagen zur Patientenakte (Dateien unter `app_data_dir/akte_anlagen/{akte_id}/`).

use std::path::{Path, PathBuf};

use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppError;

pub const ANLAGE_MAX_BYTES: usize = 50 * 1024 * 1024;

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct AkteAnlageRow {
    pub id: String,
    pub akte_id: String,
    pub display_name: String,
    pub mime_type: String,
    pub size_bytes: i64,
    /// Relativ zu `app_data_dir`, z. B. `akte_anlagen/{akte_id}/{id}.pdf`
    pub rel_storage_path: String,
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

pub fn storage_dir_for_akte(app_data_dir: &Path, akte_id: &str) -> PathBuf {
    app_data_dir.join("akte_anlagen").join(akte_id)
}

pub fn absolute_path(app_data_dir: &Path, rel: &str) -> PathBuf {
    app_data_dir.join(rel)
}

/// Nach erfolgreichem Löschen der Akte(n) aus der DB: Ordner entfernen.
pub fn remove_storage_dir_best_effort(app_data_dir: &Path, akte_id: &str) {
    let dir = storage_dir_for_akte(app_data_dir, akte_id);
    if dir.is_dir() {
        let _ = std::fs::remove_dir_all(&dir);
    }
}

pub async fn list_for_akte(pool: &SqlitePool, akte_id: &str) -> Result<Vec<AkteAnlageRow>, AppError> {
    let rows = sqlx::query_as::<_, AkteAnlageRow>(
        "SELECT id, akte_id, display_name, mime_type, size_bytes, rel_storage_path, created_at
         FROM akte_anlage WHERE akte_id = ?1 ORDER BY created_at DESC",
    )
    .bind(akte_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(rows)
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<AkteAnlageRow>, AppError> {
    let row = sqlx::query_as::<_, AkteAnlageRow>(
        "SELECT id, akte_id, display_name, mime_type, size_bytes, rel_storage_path, created_at
         FROM akte_anlage WHERE id = ?1",
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
    akte_id: &str,
    display_name: &str,
    mime_type: &str,
    bytes: &[u8],
) -> Result<AkteAnlageRow, AppError> {
    if bytes.len() > ANLAGE_MAX_BYTES {
        return Err(AppError::Validation(
            "Datei zu groß (max. 50 MB).".into(),
        ));
    }

    let (cnt,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM patientenakte WHERE id = ?1")
        .bind(akte_id)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
    if cnt == 0 {
        return Err(AppError::NotFound("Patientenakte".into()));
    }

    let id = Uuid::new_v4().to_string();
    let ext = extension_from_name(display_name);
    let rel = format!("akte_anlagen/{akte_id}/{id}{ext}");

    let dir = storage_dir_for_akte(app_data_dir, akte_id);
    std::fs::create_dir_all(&dir).map_err(|e| {
        AppError::Internal(format!("Anlagen-Ordner konnte nicht angelegt werden: {e}"))
    })?;

    let disk_path = absolute_path(app_data_dir, &rel);
    std::fs::write(&disk_path, bytes).map_err(|e| {
        AppError::Internal(format!("Datei konnte nicht gespeichert werden: {e}"))
    })?;

    let size_i64 = i64::try_from(bytes.len()).map_err(|_| {
        AppError::Internal("Dateigröße außerhalb des unterstützten Bereichs".into())
    })?;

    let created = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO akte_anlage (id, akte_id, display_name, mime_type, size_bytes, rel_storage_path, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
    .bind(&id)
    .bind(akte_id)
    .bind(display_name)
    .bind(mime_type)
    .bind(size_i64)
    .bind(&rel)
    .bind(&created)
    .execute(pool)
    .await
    .map_err(|e| {
        let _ = std::fs::remove_file(&disk_path);
        AppError::Database(e)
    })?;

    find_by_id(pool, &id)
        .await?
        .ok_or_else(|| AppError::Internal("Anlage nach Insert nicht lesbar".into()))
}

pub async fn update_display_name(pool: &SqlitePool, id: &str, display_name: &str) -> Result<(), AppError> {
    let trimmed = display_name.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation("Bezeichnung darf nicht leer sein.".into()));
    }
    let n = sqlx::query("UPDATE akte_anlage SET display_name = ?1 WHERE id = ?2")
        .bind(trimmed)
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?
        .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("Akte-Anlage".into()));
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
        .ok_or_else(|| AppError::NotFound("Akte-Anlage".into()))?;
    sqlx::query("DELETE FROM akte_anlage WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    let path = absolute_path(app_data_dir, &row.rel_storage_path);
    if path.is_file() {
        let _ = std::fs::remove_file(&path);
    }
    let dir = storage_dir_for_akte(app_data_dir, &row.akte_id);
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
