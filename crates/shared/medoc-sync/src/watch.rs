//! Background scan of the tables the admin device and a joined user device share.
//!
//! Repository writes already append to `sync_outbox`. This scan catches a shared
//! row whose `updated_at` moved without that hook, queues it, and leaves the
//! caller to send the queue to the other device immediately.
//!
//! The first pass only records what is already on disk. Rows applied from the
//! other device are marked seen in [`note_remote_applied`] so they are not
//! queued back.

use std::collections::HashMap;

use medoc_core::error::AppError;
use sqlx::SqlitePool;

use crate::deployment::DeploymentMode;
use crate::repo::{self, is_synced_table, synced_tables};
use crate::schema::ensure_sync_tables;

const BASELINE_KEY: &str = "sync.watch.baseline.v1";
const HIGH_PREFIX: &str = "sync.watch.high.v1.";

/// How many shared rows changed since the last observation.
///
/// `0` when replication is off, or on the first pass (that pass only records
/// the current rows). A count above zero means the outbox now holds those
/// changes, or they were already waiting there from the write hook.
pub async fn queue_shared_changes(pool: &SqlitePool) -> Result<u32, AppError> {
    ensure_sync_tables(pool).await?;
    if !replication_active(pool).await? {
        return Ok(0);
    }
    if !baseline_done(pool).await? {
        remember_current(pool).await?;
        write_baseline(pool).await?;
        tracing::info!(target: "medoc::sync", event = "SHARED_SYNC_BASELINE");
        return Ok(0);
    }
    diff_and_queue(pool).await
}

/// Remember a row that just arrived from the other device so the next scan
/// does not queue it again.
pub async fn note_remote_applied(
    pool: &SqlitePool,
    entity_table: &str,
    entity_id: &str,
) -> Result<(), AppError> {
    if !is_synced_table(entity_table) {
        return Ok(());
    }
    ensure_sync_tables(pool).await?;
    let Some(stamp) = row_stamp(pool, entity_table, entity_id).await? else {
        sqlx::query("DELETE FROM sync_watch_seen WHERE entity_table = ?1 AND entity_id = ?2")
            .bind(entity_table)
            .bind(entity_id)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        return Ok(());
    };
    upsert_seen(pool, entity_table, entity_id, &stamp).await
}

async fn replication_active(pool: &SqlitePool) -> Result<bool, AppError> {
    let deployment = repo::load_deployment(pool).await.unwrap_or_default();
    if deployment.mode == DeploymentMode::ServerlessPeer {
        return Ok(true);
    }
    let joined: i64 =
        medoc_core::infrastructure::database::recorded_write::count_remote_replicas(pool)
            .await
            .unwrap_or(0);
    Ok(joined > 0)
}

async fn baseline_done(pool: &SqlitePool) -> Result<bool, AppError> {
    let value: Option<String> =
        medoc_core::infrastructure::database::repos::admin::app_kv::get(pool, BASELINE_KEY).await?;
    Ok(value.as_deref() == Some("1"))
}

async fn write_baseline(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, '1', CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = CURRENT_TIMESTAMP",
    )
    .bind(BASELINE_KEY)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

async fn remember_current(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query("DELETE FROM sync_watch_seen")
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    for table in synced_tables() {
        let mut high = String::new();
        for (id, stamp) in list_stamps(pool, table).await? {
            if stamp > high {
                high.clone_from(&stamp);
            }
            upsert_seen(pool, table, &id, &stamp).await?;
        }
        store_watermark(pool, table, &high).await?;
    }
    Ok(())
}

async fn diff_and_queue(pool: &SqlitePool) -> Result<u32, AppError> {
    let mut changes = 0u32;
    for table in synced_tables() {
        let watermark = watermark(pool, table).await?;
        let mut high = watermark.clone();
        for (id, stamp) in list_changed_stamps(pool, table, &watermark).await? {
            if stamp > high {
                high.clone_from(&stamp);
            }
            let seen = seen_stamp(pool, table, &id).await?;
            if seen.as_deref() == Some(stamp.as_str()) {
                continue;
            }
            changes += 1;
            if let Some(payload) = repo::load_row_payload_json(pool, table, &id).await? {
                repo::sync_record_or_noop(pool, table, &id, "UPDATE", &payload).await?;
            }
            upsert_seen(pool, table, &id, &stamp).await?;
        }
        if high != watermark {
            store_watermark(pool, table, &high).await?;
        }
        for id in missing_seen_ids(pool, table).await? {
            changes += 1;
            repo::sync_record_or_noop(pool, table, &id, "DELETE", "{}").await?;
            sqlx::query("DELETE FROM sync_watch_seen WHERE entity_table = ?1 AND entity_id = ?2")
                .bind(table)
                .bind(&id)
                .execute(pool)
                .await
                .map_err(AppError::Database)?;
        }
    }
    Ok(changes)
}

fn watermark_key(table: &str) -> String {
    format!("{HIGH_PREFIX}{table}")
}

async fn watermark(pool: &SqlitePool, table: &str) -> Result<String, AppError> {
    let value = medoc_core::infrastructure::database::repos::admin::app_kv::get(
        pool,
        &watermark_key(table),
    )
    .await?;
    Ok(value.unwrap_or_default())
}

async fn store_watermark(pool: &SqlitePool, table: &str, stamp: &str) -> Result<(), AppError> {
    medoc_core::infrastructure::database::repos::admin::app_kv::set(
        pool,
        &watermark_key(table),
        stamp,
    )
    .await
}

async fn seen_stamp(
    pool: &SqlitePool,
    table: &str,
    entity_id: &str,
) -> Result<Option<String>, AppError> {
    let stamp: Option<String> = sqlx::query_scalar(
        "SELECT stamp FROM sync_watch_seen WHERE entity_table = ?1 AND entity_id = ?2",
    )
    .bind(table)
    .bind(entity_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(stamp)
}

async fn stamp_select(
    pool: &SqlitePool,
    table: &str,
) -> Result<Option<(String, String)>, AppError> {
    let cols: Vec<String> =
        sqlx::query_scalar(&format!("SELECT name FROM pragma_table_info('{table}')"))
            .fetch_all(pool)
            .await
            .map_err(AppError::Database)?;
    if cols.is_empty() {
        return Ok(None);
    }
    let key = medoc_core::infrastructure::database::sync_registry::key_expr(table);
    if medoc_core::infrastructure::database::sync_registry::key_is_column(table) {
        let id_col = medoc_core::infrastructure::database::sync_registry::id_column(table);
        if !cols.iter().any(|c| c == id_col) {
            return Ok(None);
        }
    }
    let stamp_sql = if cols.iter().any(|c| c == "updated_at") {
        "COALESCE(CAST(updated_at AS TEXT), '')".to_string()
    } else if cols.iter().any(|c| c == "created_at") {
        "COALESCE(CAST(created_at AS TEXT), '')".to_string()
    } else {
        "''".to_string()
    };
    Ok(Some((key, stamp_sql)))
}

async fn list_stamps(pool: &SqlitePool, table: &str) -> Result<HashMap<String, String>, AppError> {
    if !is_synced_table(table) {
        return Ok(HashMap::new());
    }
    let Some((key, stamp_sql)) = stamp_select(pool, table).await? else {
        return Ok(HashMap::new());
    };
    let mut from_sql = format!("\"{table}\"");
    if table == "app_kv" {
        from_sql.push_str(
            " WHERE key NOT LIKE 'sync.%'
               AND key NOT LIKE 'license.%'
               AND key NOT LIKE 'pairing.%'
               AND key NOT LIKE 'onboarding.%'
               AND key NOT LIKE 'cluster.%'",
        );
    }
    let sql = format!("SELECT CAST({key} AS TEXT), {stamp_sql} FROM {from_sql}");
    let rows: Vec<(String, String)> = sqlx::query_as(&sql)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(rows.into_iter().collect())
}

/// Rows that are new, or whose `updated_at` moved past the last scan.
/// Tables without `updated_at` still return every stamp.
async fn list_changed_stamps(
    pool: &SqlitePool,
    table: &str,
    watermark: &str,
) -> Result<HashMap<String, String>, AppError> {
    if !is_synced_table(table) {
        return Ok(HashMap::new());
    }
    let Some((key, stamp_sql)) = stamp_select(pool, table).await? else {
        return Ok(HashMap::new());
    };
    let cols: Vec<String> =
        sqlx::query_scalar(&format!("SELECT name FROM pragma_table_info('{table}')"))
            .fetch_all(pool)
            .await
            .map_err(AppError::Database)?;
    if !cols.iter().any(|c| c == "updated_at") {
        return list_stamps(pool, table).await;
    }
    let from_sql = format!("\"{table}\"");
    let mut filter = String::new();
    if table == "app_kv" {
        filter.push_str(
            " key NOT LIKE 'sync.%'
               AND key NOT LIKE 'license.%'
               AND key NOT LIKE 'pairing.%'
               AND key NOT LIKE 'onboarding.%'
               AND key NOT LIKE 'cluster.%'
               AND ",
        );
    }
    let sql = format!(
        "SELECT CAST({key} AS TEXT), {stamp_sql} FROM {from_sql}
         WHERE {filter}(
            CAST(updated_at AS TEXT) > ?1
            OR CAST({key} AS TEXT) NOT IN (
                SELECT entity_id FROM sync_watch_seen WHERE entity_table = ?2
            )
         )"
    );
    let rows: Vec<(String, String)> = sqlx::query_as(&sql)
        .bind(watermark)
        .bind(table)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(rows.into_iter().collect())
}

async fn missing_seen_ids(pool: &SqlitePool, table: &str) -> Result<Vec<String>, AppError> {
    if !is_synced_table(table) {
        return Ok(Vec::new());
    }
    let Some((key, _)) = stamp_select(pool, table).await? else {
        return Ok(Vec::new());
    };
    let sql = format!(
        "SELECT entity_id FROM sync_watch_seen
         WHERE entity_table = ?1
           AND entity_id NOT IN (SELECT CAST({key} AS TEXT) FROM \"{table}\")"
    );
    let ids: Vec<String> = sqlx::query_scalar(&sql)
        .bind(table)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(ids)
}

async fn row_stamp(
    pool: &SqlitePool,
    table: &str,
    entity_id: &str,
) -> Result<Option<String>, AppError> {
    if !is_synced_table(table) {
        return Ok(None);
    }
    let Some((key, stamp_sql)) = stamp_select(pool, table).await? else {
        return Ok(None);
    };
    let sql = format!("SELECT {stamp_sql} FROM \"{table}\" WHERE {key} = ?1");
    let stamp: Option<String> = sqlx::query_scalar(&sql)
        .bind(entity_id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(stamp)
}

async fn upsert_seen(
    pool: &SqlitePool,
    table: &str,
    entity_id: &str,
    stamp: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO sync_watch_seen (entity_table, entity_id, stamp) VALUES (?1, ?2, ?3)
         ON CONFLICT(entity_table, entity_id) DO UPDATE SET stamp = excluded.stamp",
    )
    .bind(table)
    .bind(entity_id)
    .bind(stamp)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
    use crate::schema::ensure_sync_tables;
    use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};

    async fn enable_peer(pool: &SqlitePool) {
        let mut cfg = SyncDeploymentConfig::default();
        cfg.mode = DeploymentMode::ServerlessPeer;
        cfg.role = DeviceRole::Replica;
        cfg.device_label = "watch-test".into();
        repo::save_deployment(pool, &cfg).await.unwrap();
    }

    async fn outbox_ops(pool: &SqlitePool, id: &str) -> Vec<String> {
        sqlx::query_scalar(
            "SELECT op FROM sync_outbox WHERE entity_table = 'app_kv' AND entity_id = ?1 ORDER BY seq",
        )
        .bind(id)
        .fetch_all(pool)
        .await
        .unwrap()
    }

    #[tokio::test]
    async fn queues_a_shared_row_once_then_a_later_edit_and_a_delete() {
        let pool = test_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        ensure_sync_tables(&pool).await.unwrap();
        enable_peer(&pool).await;

        assert_eq!(queue_shared_changes(&pool).await.unwrap(), 0);

        sqlx::query(
            "INSERT INTO app_kv (key, value, updated_at) VALUES ('practice.watch.test', 'a', '2026-01-01T00:00:00Z')",
        )
        .execute(&pool)
        .await
        .unwrap();
        assert_eq!(queue_shared_changes(&pool).await.unwrap(), 1);
        assert_eq!(queue_shared_changes(&pool).await.unwrap(), 0);
        assert_eq!(
            outbox_ops(&pool, "practice.watch.test").await,
            vec!["UPDATE".to_string()]
        );

        sqlx::query(
            "UPDATE app_kv SET value = 'b', updated_at = '2026-01-02T00:00:00Z' WHERE key = 'practice.watch.test'",
        )
        .execute(&pool)
        .await
        .unwrap();
        note_remote_applied(&pool, "app_kv", "practice.watch.test")
            .await
            .unwrap();
        assert_eq!(queue_shared_changes(&pool).await.unwrap(), 0);

        sqlx::query("DELETE FROM app_kv WHERE key = 'practice.watch.test'")
            .execute(&pool)
            .await
            .unwrap();
        assert_eq!(queue_shared_changes(&pool).await.unwrap(), 1);
        assert_eq!(
            outbox_ops(&pool, "practice.watch.test").await,
            vec!["UPDATE".to_string(), "DELETE".to_string()]
        );
    }

    #[tokio::test]
    async fn stays_quiet_when_replication_is_off() {
        let pool = test_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        ensure_sync_tables(&pool).await.unwrap();
        sqlx::query(
            "INSERT INTO app_kv (key, value, updated_at) VALUES ('practice.watch.off', 'a', '2026-01-01T00:00:00Z')",
        )
        .execute(&pool)
        .await
        .unwrap();
        assert_eq!(queue_shared_changes(&pool).await.unwrap(), 0);
        assert!(outbox_ops(&pool, "practice.watch.off").await.is_empty());
    }
}
