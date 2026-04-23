use crate::domain::entities::AuditLog;
use crate::error::AppError;
use crate::infrastructure::crypto;
use rand::RngCore;
use sqlx::SqlitePool;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

static AUDIT_KEY_MATERIAL: OnceLock<Vec<u8>> = OnceLock::new();

/// Initialise the audit HMAC key **before** any audit row is written.
/// Prefer `MEDOC_AUDIT_KEY`; otherwise loads or creates `.audit_hmac_key` next to `medoc.db`.
/// Migrates a legacy key from `~/medoc-data/.audit-hmac-key` when present.
pub fn init_audit_hmac_key(app_data_dir: &Path) -> Result<(), std::io::Error> {
    if AUDIT_KEY_MATERIAL.get().is_some() {
        return Ok(());
    }
    let key = resolve_audit_key_material(app_data_dir)?;
    let _ = AUDIT_KEY_MATERIAL.set(key);
    Ok(())
}

fn chmod600(path: &Path) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = std::fs::metadata(path) {
            let mut perms = meta.permissions();
            perms.set_mode(0o600);
            let _ = std::fs::set_permissions(path, perms);
        }
    }
}

fn resolve_audit_key_material(app_data_dir: &Path) -> Result<Vec<u8>, std::io::Error> {
    if let Ok(env) = std::env::var("MEDOC_AUDIT_KEY") {
        return Ok(env.into_bytes());
    }

    let path = app_data_dir.join(".audit_hmac_key");
    if path.exists() {
        return std::fs::read(&path);
    }

    // Legacy location (pre–app-data-dir alignment)
    if let Some(home) = dirs::home_dir() {
        let legacy: PathBuf = home.join("medoc-data").join(".audit-hmac-key");
        if legacy.exists() {
            let bytes = std::fs::read(&legacy)?;
            std::fs::create_dir_all(app_data_dir)?;
            std::fs::write(&path, &bytes)?;
            chmod600(&path);
            return Ok(bytes);
        }
    }

    std::fs::create_dir_all(app_data_dir)?;
    let mut raw = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut raw);
    std::fs::write(&path, raw)?;
    chmod600(&path);
    Ok(raw.to_vec())
}

#[cfg(test)]
fn audit_key_fallback() -> Vec<u8> {
    (*b"k9-medoc-test-audit-key-32bytes!").into()
}

#[cfg(not(test))]
fn audit_key_fallback() -> Vec<u8> {
    panic!("init_audit_hmac_key must run before audit repository use");
}

fn audit_key() -> Vec<u8> {
    if let Some(k) = AUDIT_KEY_MATERIAL.get() {
        k.clone()
    } else {
        audit_key_fallback()
    }
}

pub async fn find_all(pool: &SqlitePool, limit: i64) -> Result<Vec<AuditLog>, AppError> {
    let rows =
        sqlx::query_as::<_, AuditLog>("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?1")
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

    // Hash chain — include the previous row's HMAC so any tampering in the
    // middle of the log is detectable.
    let prev_hash: Option<String> =
        sqlx::query_scalar("SELECT hmac FROM audit_log ORDER BY created_at DESC LIMIT 1")
            .fetch_optional(pool)
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
    let hmac = crypto::audit_hmac(&audit_key(), &payload);

    sqlx::query(
        "INSERT INTO audit_log (id, user_id, action, entity, entity_id, details, prev_hash, hmac)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )
    .bind(&id)
    .bind(user_id)
    .bind(action)
    .bind(entity)
    .bind(entity_id)
    .bind(details)
    .bind(prev_hash)
    .bind(&hmac)
    .execute(pool)
    .await?;
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

/// Verify the integrity of the entire audit-log chain.
/// Returns `Ok(broken_at)` where `broken_at` is `None` if the chain is intact,
/// or the row id where verification failed.
pub async fn verify_chain(pool: &SqlitePool) -> Result<Option<String>, AppError> {
    let rows: Vec<AuditRow> = sqlx::query_as(
        "SELECT id, user_id, action, entity, entity_id, details, prev_hash, hmac
             FROM audit_log ORDER BY created_at ASC",
    )
    .fetch_all(pool)
    .await?;

    let key = audit_key();
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
        let expected = crypto::audit_hmac(&key, &payload);
        if expected != stored_hmac {
            return Ok(Some(id));
        }
        last_hmac = stored_hmac;
    }
    Ok(None)
}
