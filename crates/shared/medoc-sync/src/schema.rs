use medoc_core::error::AppError;
use sqlx::SqlitePool;

/// Idempotent DDL for peer replication tables (practice `medoc.db` only).
pub async fn ensure_sync_tables(pool: &SqlitePool) -> Result<(), AppError> {
    if sync_schema_current(pool).await? {
        return Ok(());
    }
    ensure_sync_tables_cold(pool).await
}

async fn sync_schema_current(pool: &SqlitePool) -> Result<bool, AppError> {
    let ready: Option<(i64, i64, i64, i64, i64, i64)> = sqlx::query_as(
        "SELECT
            (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'device_blocklist'),
            (SELECT COUNT(*) FROM pragma_table_info('sync_pull_failure') WHERE name = 'entry_id'),
            (SELECT COUNT(*) FROM pragma_table_info('pairing_request') WHERE name = 'transport'),
            (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'sync_row_hlc'),
            (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'sync_packet_queue'),
            (SELECT COUNT(*) FROM pragma_table_info('sync_outbox') WHERE name = 'snapshot_for')",
    )
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(matches!(
        ready,
        Some((tables, payload, transport, hlc, packets, snapshot))
            if tables > 0 && payload > 0 && transport > 0 && hlc > 0 && packets > 0 && snapshot > 0
    ))
}

async fn ensure_sync_tables_cold(pool: &SqlitePool) -> Result<(), AppError> {
    // Shared replication and pairing tables live in medoc-core. This function
    // only adds the tables the sync crate owns on top of that DDL.
    medoc_core::infrastructure::database::migrations::ensure_sync_replication_tables(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS sync_pull_failure (
            source_device_id TEXT NOT NULL,
            source_seq INTEGER NOT NULL,
            attempts INTEGER NOT NULL,
            PRIMARY KEY (source_device_id, source_seq)
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    migrate_pull_failure_payload(pool).await?;

    medoc_core::infrastructure::database::hlc::ensure_sync_row_hlc(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS sync_watch_seen (
            entity_table TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            stamp TEXT NOT NULL,
            PRIMARY KEY (entity_table, entity_id)
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    migrate_pairing_pin_columns(pool).await?;

    medoc_core::infrastructure::database::migrations::ensure_cluster_tables(pool).await?;

    Ok(())
}

async fn migrate_pull_failure_payload(pool: &SqlitePool) -> Result<(), AppError> {
    for (name, ddl) in [
        (
            "payload_json",
            "ALTER TABLE sync_pull_failure ADD COLUMN payload_json TEXT",
        ),
        (
            "entity_table",
            "ALTER TABLE sync_pull_failure ADD COLUMN entity_table TEXT",
        ),
        (
            "entity_id",
            "ALTER TABLE sync_pull_failure ADD COLUMN entity_id TEXT",
        ),
        ("op", "ALTER TABLE sync_pull_failure ADD COLUMN op TEXT"),
        (
            "entry_created_at",
            "ALTER TABLE sync_pull_failure ADD COLUMN entry_created_at TEXT",
        ),
        (
            "entry_id",
            "ALTER TABLE sync_pull_failure ADD COLUMN entry_id TEXT",
        ),
    ] {
        let present: Option<i64> = sqlx::query_scalar(
            "SELECT COUNT(*) FROM pragma_table_info('sync_pull_failure') WHERE name = ?1",
        )
        .bind(name)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
        if present == Some(0) {
            sqlx::query(ddl)
                .execute(pool)
                .await
                .map_err(AppError::Database)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::ensure_sync_tables;
    use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};

    async fn create_sql(pool: &sqlx::SqlitePool, name: &str) -> Option<String> {
        sqlx::query_scalar("SELECT sql FROM sqlite_master WHERE name = ?1")
            .bind(name)
            .fetch_optional(pool)
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn sync_extras_do_not_rewrite_the_core_replication_tables() {
        let pool = test_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        let before_outbox = create_sql(&pool, "sync_outbox").await;
        let before_pairing = create_sql(&pool, "pairing_request").await;
        let before_permission = create_sql(&pool, "slave_permission").await;
        assert!(
            before_outbox.is_some(),
            "core migration creates sync_outbox"
        );
        ensure_sync_tables(&pool).await.unwrap();
        assert_eq!(create_sql(&pool, "sync_outbox").await, before_outbox);
        assert_eq!(
            create_sql(&pool, "slave_permission").await,
            before_permission
        );
        let pairing = create_sql(&pool, "pairing_request").await.unwrap();
        assert!(
            pairing.starts_with(before_pairing.unwrap().trim_end_matches(')')),
            "pairing columns are added onto the core table"
        );
        assert!(pairing.contains("confirm_pin_hash"));
        assert!(pairing.contains("transport"));
        assert!(create_sql(&pool, "sync_pull_failure").await.is_some());
        assert!(create_sql(&pool, "sync_watch_seen").await.is_some());
        let transport: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM pragma_table_info('pairing_request') WHERE name = 'transport'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(transport, 1);
    }
}

async fn migrate_pairing_pin_columns(pool: &SqlitePool) -> Result<(), AppError> {
    let has_hash: Option<i64> = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pragma_table_info('pairing_request') WHERE name = 'confirm_pin_hash'",
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    if has_hash == Some(0) {
        sqlx::query("ALTER TABLE pairing_request ADD COLUMN confirm_pin_hash TEXT")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        sqlx::query("ALTER TABLE pairing_request ADD COLUMN confirm_pin_expires_at TEXT")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        sqlx::query(
            "ALTER TABLE pairing_request ADD COLUMN confirm_pin_attempts INTEGER NOT NULL DEFAULT 0",
        )
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        sqlx::query("ALTER TABLE pairing_request ADD COLUMN transport TEXT NOT NULL DEFAULT 'lan'")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    }
    Ok(())
}
