use crate::domain::entities::AuditLog;
use crate::error::AppError;
use crate::infrastructure::crypto;
use crate::infrastructure::database::audit_break_glass;
use crate::infrastructure::secret_store;
use sqlx::SqlitePool;
use std::path::Path;
use std::sync::OnceLock;

static AUDIT_KEY_MATERIAL: OnceLock<Vec<u8>> = OnceLock::new();

/// Initialise the audit HMAC key **before** any audit row is written.
/// Prefer `MEDOC_AUDIT_KEY` (tests); otherwise OS keychain (`de.medoc.app` / `audit-hmac-key`).
/// Migrates legacy plaintext `.audit_hmac_key` into the keychain and deletes the file.
pub fn init_audit_hmac_key(app_data_dir: &Path) -> Result<(), std::io::Error> {
    if AUDIT_KEY_MATERIAL.get().is_some() {
        return Ok(());
    }
    let key = resolve_audit_key_material(app_data_dir)
        .map_err(|e| std::io::Error::other(e.to_string()))?;
    let _ = AUDIT_KEY_MATERIAL.set(key);
    Ok(())
}

fn resolve_audit_key_material(app_data_dir: &Path) -> Result<Vec<u8>, AppError> {
    let mut legacy_candidates = vec![app_data_dir.join(".audit_hmac_key")];
    if let Some(home) = dirs::home_dir() {
        legacy_candidates.push(home.join("medoc-data").join(".audit-hmac-key"));
    }
    let legacy = legacy_candidates.iter().find(|p| p.exists());

    secret_store::load_or_create_bytes("audit-hmac-key", legacy.map(|p| p.as_path()), 32)
}

#[cfg(test)]
fn audit_key_fallback() -> Result<Vec<u8>, AppError> {
    Ok((*b"k9-medoc-test-audit-key-32bytes!").into())
}

#[cfg(not(test))]
fn audit_key_fallback() -> Result<Vec<u8>, AppError> {
    Err(AppError::Internal(
        "Audit key was not initialised (init_audit_hmac_key)".into(),
    ))
}

fn audit_key() -> Result<Vec<u8>, AppError> {
    if let Some(k) = AUDIT_KEY_MATERIAL.get() {
        Ok(k.clone())
    } else {
        audit_key_fallback()
    }
}

/// HMAC-SHA256 hex digest of `subject` (login email, practice slug, …) for brute-force keys.
pub fn subject_hmac(subject: &str) -> Result<String, AppError> {
    crypto::audit_hmac(&audit_key()?, subject).map_err(AppError::Internal)
}

/// HMAC-SHA256 (hex) over a backup file using the audit-chain key.
pub fn hmac_file(path: &Path) -> Result<String, AppError> {
    crypto::audit_hmac_file(&audit_key()?, path).map_err(AppError::Internal)
}

/// Returns `Ok(true)` when the sidecar matches, `Ok(false)` when it does not.
pub fn verify_file_hmac(path: &Path, expected_hex: &str) -> Result<bool, AppError> {
    let actual = hmac_file(path)?;
    Ok(actual == expected_hex.trim())
}

pub async fn find_all(pool: &SqlitePool, limit: i64) -> Result<Vec<AuditLog>, AppError> {
    let rows =
        sqlx::query_as::<_, AuditLog>("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?1")
            .bind(limit)
            .fetch_all(pool)
            .await?;
    Ok(rows)
}

/// Paginated audit-log query. The audit table grows monotonically and the
/// current page only requests `limit` rows.
pub async fn find_paginated(
    pool: &SqlitePool,
    limit: u32,
    offset: u32,
    sort_dir_sql: &'static str,
    break_glass_only: bool,
) -> Result<(Vec<AuditLog>, i64), AppError> {
    let (total, sql) = if break_glass_only {
        let total: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM audit_log WHERE under_break_glass = 1")
                .fetch_one(pool)
                .await?;
        (
            total,
            format!(
                "SELECT * FROM audit_log WHERE under_break_glass = 1 ORDER BY created_at {} LIMIT ?1 OFFSET ?2",
                sort_dir_sql
            ),
        )
    } else {
        let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM audit_log")
            .fetch_one(pool)
            .await?;
        (
            total,
            format!(
                "SELECT * FROM audit_log ORDER BY created_at {} LIMIT ?1 OFFSET ?2",
                sort_dir_sql
            ),
        )
    };
    let rows = sqlx::query_as::<_, AuditLog>(&sql)
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(pool)
        .await?;
    Ok((rows, total.0))
}

/// Recent audit rows for a user filtered by action names (newest first).
pub async fn find_recent_for_user_actions(
    pool: &SqlitePool,
    user_id: &str,
    actions: &[&str],
    limit: i64,
) -> Result<Vec<AuditLog>, AppError> {
    if actions.is_empty() {
        return Ok(Vec::new());
    }
    let placeholders = actions
        .iter()
        .enumerate()
        .map(|(i, _)| format!("?{}", i + 2))
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "SELECT * FROM audit_log WHERE user_id = ?1 AND action IN ({placeholders}) ORDER BY created_at DESC LIMIT ?{}",
        actions.len() + 2
    );
    let mut q = sqlx::query_as::<_, AuditLog>(&sql).bind(user_id);
    for action in actions {
        q = q.bind(*action);
    }
    q = q.bind(limit);
    Ok(q.fetch_all(pool).await?)
}

/// Audit rows that reference a patient id (`entity_id` in the log).
pub async fn find_for_patient_entity(
    pool: &SqlitePool,
    patient_id: &str,
    limit: i64,
) -> Result<Vec<AuditLog>, AppError> {
    let rows = sqlx::query_as::<_, AuditLog>(
        "SELECT * FROM audit_log WHERE entity_id = ?1 ORDER BY created_at DESC LIMIT ?2",
    )
    .bind(patient_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn create(
    pool: &SqlitePool,
    user_id: &str,
    action: &str,
    entity: &str,
    entity_id: Option<&str>,
    details: Option<&str>,
) -> Result<(), AppError> {
    let id = uuid::Uuid::new_v4().to_string();

    // Serialize chain tip read + insert (BEGIN IMMEDIATE) so concurrent writers
    // cannot observe the same prev HMAC and fork the chain.
    let mut tx = pool
        .begin_with("BEGIN IMMEDIATE")
        .await
        .map_err(AppError::Database)?;

    let prev_hash: Option<String> =
        sqlx::query_scalar("SELECT hmac FROM audit_log ORDER BY rowid DESC LIMIT 1")
            .fetch_optional(&mut *tx)
            .await?;
    let prev = prev_hash.clone().unwrap_or_default();

    let payload = format!(
        "{}|{}|{}|{}|{}|{}|{}",
        id,
        user_id,
        action,
        entity,
        entity_id.unwrap_or(""),
        details.unwrap_or(""),
        prev
    );
    let hmac = crypto::audit_hmac(&audit_key()?, &payload).map_err(AppError::Internal)?;

    let (under_break_glass, break_glass_reason) =
        audit_break_glass::break_glass_meta_for_audit(user_id, entity, entity_id);

    sqlx::query(
        "INSERT INTO audit_log (id, user_id, action, entity, entity_id, details, prev_hash, hmac, under_break_glass, break_glass_reason)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
    )
    .bind(&id)
    .bind(user_id)
    .bind(action)
    .bind(entity)
    .bind(entity_id)
    .bind(details)
    .bind(prev_hash)
    .bind(&hmac)
    .bind(u8::from(under_break_glass))
    .bind(break_glass_reason.as_deref())
    .execute(&mut *tx)
    .await?;

    tx.commit().await.map_err(AppError::Database)?;
    Ok(())
}

/// Tuple representing one persisted audit-log row, used for `verify_chain`.
type AuditRow = (
    String,
    String,
    String,
    String,
    Option<String>,
    Option<String>,
    Option<String>,
    String,
);

/// Removes legacy demo rows and other placeholders that were inserted without a
/// valid HMAC chain (e.g. historical seed SQL). Safe to run on every startup.
pub async fn purge_legacy_placeholder_audit_rows(pool: &SqlitePool) -> Result<u64, AppError> {
    let result = sqlx::query(
        "DELETE FROM audit_log WHERE hmac IS NULL OR hmac = '' OR id LIKE 'seed-audit-%'",
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

/// Deletes the broken row and all subsequent audit entries so verification can succeed again.
pub async fn truncate_audit_chain_from(
    pool: &SqlitePool,
    broken_id: &str,
) -> Result<u64, AppError> {
    let result = sqlx::query(
        "DELETE FROM audit_log WHERE rowid >= (SELECT rowid FROM audit_log WHERE id = ?1 LIMIT 1)",
    )
    .bind(broken_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

/// Purges placeholders, then truncates from each broken row until the chain verifies.
pub async fn repair_broken_audit_chain(pool: &SqlitePool) -> Result<u64, AppError> {
    let mut total = purge_legacy_placeholder_audit_rows(pool).await?;
    const MAX_ROUNDS: u32 = 256;
    for _ in 0..MAX_ROUNDS {
        match verify_chain(pool).await? {
            None => return Ok(total),
            Some(broken_id) => {
                let n = truncate_audit_chain_from(pool, &broken_id).await?;
                if n == 0 {
                    return Ok(total);
                }
                total += n;
            }
        }
    }
    Ok(total)
}

/// Verify the integrity of the entire audit-log chain.
/// Returns `Ok(broken_at)` where `broken_at` is `None` if the chain is intact,
/// or the row id where verification failed.
pub async fn verify_chain(pool: &SqlitePool) -> Result<Option<String>, AppError> {
    let rows: Vec<AuditRow> = sqlx::query_as(
        "SELECT id, user_id, action, entity, entity_id, details, prev_hash, hmac
             FROM audit_log ORDER BY rowid ASC",
    )
    .fetch_all(pool)
    .await?;

    let key = audit_key()?;
    let mut last_hmac = String::new();
    for (id, user_id, action, entity, entity_id, details, prev_hash, stored_hmac) in rows {
        let prev = prev_hash.unwrap_or_default();
        if prev != last_hmac {
            return Ok(Some(id));
        }
        let payload = format!(
            "{}|{}|{}|{}|{}|{}|{}",
            id,
            user_id,
            action,
            entity,
            entity_id.unwrap_or_default(),
            details.unwrap_or_default(),
            prev
        );
        let expected = crypto::audit_hmac(&key, &payload).map_err(AppError::Internal)?;
        if expected != stored_hmac {
            return Ok(Some(id));
        }
        last_hmac = stored_hmac;
    }
    Ok(None)
}
