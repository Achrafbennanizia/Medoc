//! Outbox helper used by repository write paths.
//!
//! Lives in **medoc-core** (not medoc-sync) to keep the dependency
//! direction one-way: `medoc-sync → medoc-core`. The runtime sync engine
//! still lives in medoc-sync; the helper here is the minimal write-side
//! intercept the practice's repositories need.
//!
//! Semantics:
//! 1. Looks up the persisted deployment from `app_kv` (`sync.deployment.v1`).
//! 2. No-op unless `mode = serverless_peer`.
//! 3. No-op when `entity_table` is not in [`SYNCED_TABLES`].
//! 4. Otherwise appends one row to `sync_outbox` and bumps `sync_vector`.

use chrono::Utc;
use serde::Deserialize;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppError;
use crate::infrastructure::database::app_kv_repo;

const APP_KV_DEPLOYMENT_KEY: &str = "sync.deployment.v1";
const APP_KV_DEVICE_ID_KEY: &str = "sync.device_id.v1";

/// Allow-listed entity tables that flow through the outbox.
pub const SYNCED_TABLES: &[&str] = &[
    "patient",
    "patient_chart",
    "appointment",
    "treatment",
    "examination",
    "payment",
    "app_kv",
    "practice_task",
    "anamnesis_form",
    "dental_finding",
    "prescription",
    "certificate",
    "service_item",
    "in_app_notification",
    "practice_ticket",
];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredDeployment {
    #[serde(default)]
    mode: String,
    #[serde(default)]
    device_label: String,
}

/// Append one outbox row for a successful local write, when running in
/// serverless-peer mode. Returns `Ok(())` even when the call is skipped.
pub async fn record_or_noop(
    pool: &SqlitePool,
    entity_table: &str,
    entity_id: &str,
    op: &str,
    payload_json: &str,
) -> Result<(), AppError> {
    if !SYNCED_TABLES.contains(&entity_table) {
        return Ok(());
    }
    let Some(raw) = app_kv_repo::get(pool, APP_KV_DEPLOYMENT_KEY).await? else {
        return Ok(());
    };
    let deployment: StoredDeployment = match serde_json::from_str(&raw) {
        Ok(d) => d,
        Err(e) => {
            tracing::warn!(
                target: "medoc::sync",
                event = "OUTBOX_DEPLOYMENT_PARSE",
                error = %e,
            );
            return Ok(());
        }
    };
    if deployment.mode != "serverless_peer" {
        return Ok(());
    }

    let local_id = ensure_local_device_id(pool, &deployment.device_label).await?;
    let seq: i64 = sqlx::query_scalar(
        "INSERT INTO sync_vector (device_id, seq) VALUES (?1, 1)
         ON CONFLICT(device_id) DO UPDATE SET seq = seq + 1
         RETURNING seq",
    )
    .bind(&local_id)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO sync_outbox (id, device_id, seq, entity_table, entity_id, op, payload_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )
    .bind(&id)
    .bind(&local_id)
    .bind(seq)
    .bind(entity_table)
    .bind(entity_id)
    .bind(op)
    .bind(payload_json)
    .bind(&created_at)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

/// Bypasses `app_kv_repo::set` to avoid an async cycle: that helper now calls
/// back into [`record_or_noop`] for non-internal keys, and the Rust compiler
/// cannot prove the runtime guard (`is_internal_sync_key`) breaks the cycle.
async fn ensure_local_device_id(pool: &SqlitePool, label: &str) -> Result<String, AppError> {
    if let Some(existing) = app_kv_repo::get(pool, APP_KV_DEVICE_ID_KEY).await? {
        if !existing.is_empty() {
            return Ok(existing);
        }
    }
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
    )
    .bind(APP_KV_DEVICE_ID_KEY)
    .bind(&id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    let display = if label.is_empty() {
        "This device"
    } else {
        label
    };
    let _ = sqlx::query(
        "INSERT OR IGNORE INTO sync_device (device_id, display_name, role, is_local)
         VALUES (?1, ?2, 'MASTER', 1)",
    )
    .bind(&id)
    .bind(display)
    .execute(pool)
    .await;
    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::database::connection::{run_migrations, test_memory_pool};

    async fn enable_serverless(pool: &SqlitePool) {
        app_kv_repo::set(
            pool,
            APP_KV_DEPLOYMENT_KEY,
            r#"{"schemaVersion":1,"mode":"serverless_peer","role":"REPLICA","masterBaseUrl":"","masterCertSha256":"","masterAccessToken":"","deviceLabel":"Test"}"#,
        )
        .await
        .unwrap();
    }

    async fn count_outbox(pool: &SqlitePool) -> i64 {
        sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox")
            .fetch_one(pool)
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn noop_when_mode_is_practice_desktop() {
        let pool = test_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        record_or_noop(&pool, "patient", "p1", "INSERT", "{}")
            .await
            .unwrap();
        assert_eq!(count_outbox(&pool).await, 0);
    }

    #[tokio::test]
    async fn noop_when_table_not_allow_listed() {
        let pool = test_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        enable_serverless(&pool).await;
        record_or_noop(&pool, "staff", "p1", "INSERT", "{}")
            .await
            .unwrap();
        assert_eq!(count_outbox(&pool).await, 0);
    }

    #[tokio::test]
    async fn records_one_row_for_allow_listed_table_in_serverless_mode() {
        let pool = test_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        enable_serverless(&pool).await;
        for table in [
            "patient",
            "patient_chart",
            "appointment",
            "treatment",
            "examination",
            "payment",
            "app_kv",
            "practice_task",
            "anamnesis_form",
            "dental_finding",
            "prescription",
            "certificate",
            "service_item",
            "in_app_notification",
            "practice_ticket",
        ] {
            record_or_noop(&pool, table, "id-x", "INSERT", "{}")
                .await
                .unwrap();
        }
        assert_eq!(count_outbox(&pool).await, 15);
    }
}
