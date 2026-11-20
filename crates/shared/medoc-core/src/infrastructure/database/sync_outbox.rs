//! Outbox helper used by repository write paths.
//!
//! Lives in **medoc-core** (not medoc-sync) so the dependency stays
//! `medoc-sync → medoc-core`. The write rules are in [`super::recorded_write`].

use sqlx::SqlitePool;

use crate::error::AppError;
use crate::infrastructure::database::recorded_write;
use crate::infrastructure::database::sync_registry;

/// Allow-listed entity tables that flow through the outbox.
pub fn synced_tables() -> impl Iterator<Item = &'static str> {
    sync_registry::synced_tables()
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
    let _ = payload_json;
    recorded_write::record_or_noop_in_own_tx(pool, entity_table, entity_id, op).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::database::connection::{run_migrations, test_memory_pool};
    use crate::infrastructure::database::repos::admin::app_kv as app_kv_repo;

    const APP_KV_DEPLOYMENT_KEY: &str = "sync.deployment.v1";

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

    async fn insert_replica_peer(pool: &SqlitePool) {
        sqlx::query(
            "INSERT INTO sync_device (device_id, display_name, role, is_local)
             VALUES ('peer-replica', 'Replica', 'REPLICA', 0)",
        )
        .execute(pool)
        .await
        .unwrap();
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
    async fn records_on_practice_desktop_when_a_replica_is_registered() {
        let pool = test_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        app_kv_repo::set(
            &pool,
            APP_KV_DEPLOYMENT_KEY,
            r#"{"schemaVersion":1,"mode":"practice_desktop","role":"MASTER","masterBaseUrl":"","masterCertSha256":"","masterAccessToken":"","deviceLabel":"Main"}"#,
        )
        .await
        .unwrap();
        insert_replica_peer(&pool).await;
        record_or_noop(
            &pool,
            "appointment",
            "a1",
            "INSERT",
            r#"{"id":"a1","date":"2026-10-01"}"#,
        )
        .await
        .unwrap();
        assert_eq!(count_outbox(&pool).await, 1);
    }

    #[tokio::test]
    async fn a_live_write_stays_ahead_of_a_slow_wall_clock() {
        let pool = test_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        enable_serverless(&pool).await;
        app_kv_repo::set(&pool, "sync.hlc.v1", "5000000000000:4")
            .await
            .unwrap();
        record_or_noop(&pool, "appointment", "a-slow", "INSERT", "{}")
            .await
            .unwrap();
        let payload: String =
            sqlx::query_scalar("SELECT payload_json FROM sync_outbox WHERE entity_id = 'a-slow'")
                .fetch_one(&pool)
                .await
                .unwrap();
        let value: serde_json::Value = serde_json::from_str(&payload).unwrap();
        let stamp = value["syncHlc"].as_str().expect("syncHlc");
        let hlc = crate::infrastructure::database::hlc::parse_hlc(stamp).expect("hlc");
        assert_eq!(hlc.wall_ms, 5_000_000_000_000);
        assert!(hlc.counter > 4);
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
    async fn outbox_inserts_sync_device_when_only_the_kv_id_exists() {
        let pool = test_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO app_kv (key, value, updated_at) VALUES ('sync.device_id.v1', 'orphan-device', CURRENT_TIMESTAMP)",
        )
        .execute(&pool)
        .await
        .unwrap();
        enable_serverless(&pool).await;
        record_or_noop(&pool, "app_kv", "practice.timezone.v1", "UPDATE", "{}")
            .await
            .expect("outbox must create the sync_device parent before sync_vector");
        let n: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sync_device WHERE device_id = 'orphan-device'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(n, 1);
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
            "issued_document",
        ] {
            record_or_noop(&pool, table, "id-x", "INSERT", "{}")
                .await
                .unwrap();
        }
        assert_eq!(count_outbox(&pool).await, 16);
    }
}
