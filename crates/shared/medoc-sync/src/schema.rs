use medoc_core::error::AppError;
use sqlx::SqlitePool;

/// Serializes the cold path. Many startup tasks (sync watcher, pairing store, cluster repo) call
/// `ensure_sync_tables` lazily; on a fresh database they raced through check-then-ALTER and the loser
/// failed with "duplicate column name: payload_json".
static COLD_PATH: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// Idempotent DDL for peer replication tables (practice `medoc.db` only).
pub async fn ensure_sync_tables(pool: &SqlitePool) -> Result<(), AppError> {
    if sync_schema_current(pool).await? {
        return Ok(());
    }
    let _guard = COLD_PATH.lock().await;
    // Another task may have finished the upgrade while this one waited.
    if sync_schema_current(pool).await? {
        return Ok(());
    }
    ensure_sync_tables_cold(pool).await
}

/// `ALTER TABLE … ADD COLUMN` that is safe to repeat: skips a column that exists, and treats SQLite's
/// "duplicate column name" as done (another process — e.g. a second app instance — added it first).
async fn add_column_if_missing(
    pool: &SqlitePool,
    table: &str,
    column: &str,
    ddl: &str,
) -> Result<(), AppError> {
    let present: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM pragma_table_info(?1) WHERE name = ?2")
            .bind(table)
            .bind(column)
            .fetch_one(pool)
            .await
            .map_err(AppError::Database)?;
    if present > 0 {
        return Ok(());
    }
    match sqlx::query(ddl).execute(pool).await {
        Ok(_) => Ok(()),
        Err(e) if e.to_string().contains("duplicate column name") => Ok(()),
        Err(e) => Err(AppError::Database(e)),
    }
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
        add_column_if_missing(pool, "sync_pull_failure", name, ddl).await?;
    }
    Ok(())
}

async fn migrate_pairing_pin_columns(pool: &SqlitePool) -> Result<(), AppError> {
    // Column by column: a start interrupted after the first ALTER used to leave the rest missing forever
    // (the old code only checked `confirm_pin_hash`).
    for (name, ddl) in [
        ("confirm_pin_hash", "ALTER TABLE pairing_request ADD COLUMN confirm_pin_hash TEXT"),
        ("confirm_pin_expires_at", "ALTER TABLE pairing_request ADD COLUMN confirm_pin_expires_at TEXT"),
        (
            "confirm_pin_attempts",
            "ALTER TABLE pairing_request ADD COLUMN confirm_pin_attempts INTEGER NOT NULL DEFAULT 0",
        ),
        ("transport", "ALTER TABLE pairing_request ADD COLUMN transport TEXT NOT NULL DEFAULT 'lan'"),
    ] {
        add_column_if_missing(pool, "pairing_request", name, ddl).await?;
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

    async fn column_count(pool: &sqlx::SqlitePool, table: &str, column: &str) -> i64 {
        sqlx::query_scalar("SELECT COUNT(*) FROM pragma_table_info(?1) WHERE name = ?2")
            .bind(table)
            .bind(column)
            .fetch_one(pool)
            .await
            .unwrap()
    }

    /// Regression: on a fresh database many startup tasks call this at once; the loser of the
    /// check-then-ALTER race failed with "duplicate column name: payload_json".
    #[tokio::test]
    async fn concurrent_first_calls_all_succeed() {
        let pool = test_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        let _ = sqlx::query("DROP TABLE IF EXISTS sync_pull_failure")
            .execute(&pool)
            .await;
        let (a, b, c, d, e, f) = tokio::join!(
            ensure_sync_tables(&pool),
            ensure_sync_tables(&pool),
            ensure_sync_tables(&pool),
            ensure_sync_tables(&pool),
            ensure_sync_tables(&pool),
            ensure_sync_tables(&pool),
        );
        for r in [a, b, c, d, e, f] {
            r.expect("every concurrent call succeeds");
        }
        assert_eq!(
            column_count(&pool, "sync_pull_failure", "payload_json").await,
            1
        );
        assert_eq!(
            column_count(&pool, "sync_pull_failure", "entry_id").await,
            1
        );
    }

    /// Regression: an upgrade interrupted after the first pairing ALTER left the other columns missing,
    /// because only `confirm_pin_hash` was checked.
    #[tokio::test]
    async fn half_finished_pairing_upgrade_is_completed() {
        let pool = test_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        ensure_sync_tables(&pool).await.unwrap();
        for col in ["transport", "confirm_pin_attempts"] {
            sqlx::query(&format!("ALTER TABLE pairing_request DROP COLUMN {col}"))
                .execute(&pool)
                .await
                .unwrap();
        }
        ensure_sync_tables(&pool).await.unwrap();
        assert_eq!(column_count(&pool, "pairing_request", "transport").await, 1);
        assert_eq!(
            column_count(&pool, "pairing_request", "confirm_pin_attempts").await,
            1
        );
        // Running again is a no-op, not an error.
        ensure_sync_tables(&pool).await.unwrap();
    }
}
