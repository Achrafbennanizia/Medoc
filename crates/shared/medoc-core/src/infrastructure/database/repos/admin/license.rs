//! Persistence layer for license tokens (NFA-LIC-01).
//!
//! Both v1 and v2 license strings are stored as plain text in `app_kv`:
//!
//! - `license.v1` — legacy `<json>.<sig>` line.
//! - `license.v2` — `v2.<nonce>.<ct>` envelope (already AES-GCM encrypted).
//!
//! The v2 ciphertext is itself encrypted (device-bound), so storing it next
//! to the SQLCipher-encrypted at-rest layer is acceptable: an attacker who
//! extracts the row still cannot decrypt the license without the device id +
//! vendor seed.

use crate::error::AppError;
use crate::infrastructure::database::app_kv_repo;
use crate::infrastructure::license::{self, LicenseStatus};
use sqlx::SqlitePool;

pub const KEY_V1: &str = "license.v1";
pub const KEY_V2: &str = "license.v2";
pub const KEY_DEVICE_ID: &str = "license.device_id.v1";

/// Persist a v2 envelope. Caller must have called `verify_v2_envelope`
/// first — this function only writes, it never validates.
pub async fn store_v2(pool: &SqlitePool, envelope: &str) -> Result<(), AppError> {
    app_kv_repo::set(pool, KEY_V2, envelope.trim()).await
}

pub async fn load_v2(pool: &SqlitePool) -> Result<Option<String>, AppError> {
    app_kv_repo::get(pool, KEY_V2).await
}

pub async fn store_v1(pool: &SqlitePool, token: &str) -> Result<(), AppError> {
    app_kv_repo::set(pool, KEY_V1, token.trim()).await
}

pub async fn load_v1(pool: &SqlitePool) -> Result<Option<String>, AppError> {
    app_kv_repo::get(pool, KEY_V1).await
}

pub async fn clear(pool: &SqlitePool) -> Result<(), AppError> {
    app_kv_repo::delete(pool, KEY_V1).await?;
    app_kv_repo::delete(pool, KEY_V2).await?;
    Ok(())
}

/// Stable per-install device id used for v2 binding and sync device registry.
/// Reuses the same UUID that `medoc-sync` writes to `sync.device_id.v1`.
pub async fn ensure_device_id(pool: &SqlitePool) -> Result<String, AppError> {
    if let Some(existing) = app_kv_repo::get(pool, "sync.device_id.v1")
        .await?
        .filter(|s| !s.is_empty())
    {
        return Ok(existing);
    }
    if let Some(legacy) = app_kv_repo::get(pool, KEY_DEVICE_ID).await? {
        if !legacy.is_empty() {
            return Ok(legacy);
        }
    }
    let id = uuid::Uuid::new_v4().to_string();
    app_kv_repo::set(pool, KEY_DEVICE_ID, &id).await?;
    Ok(id)
}

/// Current effective license status (prefers v2, falls back to v1).
pub async fn current_status(pool: &SqlitePool) -> Result<LicenseStatus, AppError> {
    let device_id = ensure_device_id(pool).await?;
    if let Some(v2) = load_v2(pool).await? {
        let status = license::verify(&v2, &device_id);
        if status.valid {
            return Ok(status);
        }
        if let Some(v1) = load_v1(pool).await? {
            let v1_status = license::verify_v1(&v1);
            if v1_status.valid {
                return Ok(v1_status);
            }
        }
        return Ok(status);
    }
    if let Some(v1) = load_v1(pool).await? {
        return Ok(license::verify_v1(&v1));
    }
    Ok(LicenseStatus {
        valid: false,
        reason: Some("Keine Lizenz aktiviert".into()),
        license: None,
        license_v2: None,
        days_until_expiry: None,
        format: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::database::connection::{run_migrations, test_memory_pool};

    #[tokio::test]
    async fn device_id_is_stable() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        let a = ensure_device_id(&pool).await.unwrap();
        let b = ensure_device_id(&pool).await.unwrap();
        assert_eq!(a, b);
        assert!(!a.is_empty());
    }

    #[tokio::test]
    async fn store_and_load_v2_roundtrip() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        store_v2(&pool, "v2.AAA.BBB").await.unwrap();
        assert_eq!(load_v2(&pool).await.unwrap().as_deref(), Some("v2.AAA.BBB"));
        clear(&pool).await.unwrap();
        assert!(load_v2(&pool).await.unwrap().is_none());
    }

    #[tokio::test]
    async fn current_status_returns_invalid_when_no_license() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        let s = current_status(&pool).await.unwrap();
        assert!(!s.valid);
        assert!(s.reason.unwrap().contains("Keine Lizenz"));
    }
}
