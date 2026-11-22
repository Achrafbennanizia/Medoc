//! Crash-safe update queue: spooled changes reach the outbox, journaled sends are restored after a
//! power cut, and the files are deleted once the receiver confirmed.

use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_sync::durable_queue::{self, SendChannel, SpooledChange};
use medoc_sync::repo::OutboxEntry;
use medoc_sync::schema::ensure_sync_tables;
use sqlx::SqlitePool;

async fn pool() -> SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");
    ensure_sync_tables(&pool).await.expect("sync schema");
    pool
}

fn entry(id: &str, seq: i64) -> OutboxEntry {
    OutboxEntry {
        id: id.into(),
        device_id: "replica-1".into(),
        seq,
        entity_table: "patient".into(),
        entity_id: format!("p-{seq}"),
        op: "UPDATE".into(),
        payload_json: format!(r#"{{"id":"p-{seq}"}}"#),
        created_at: "2026-11-22T10:00:00Z".into(),
    }
}

async fn outbox_ids(pool: &SqlitePool) -> Vec<String> {
    sqlx::query_scalar("SELECT id FROM sync_outbox ORDER BY seq")
        .fetch_all(pool)
        .await
        .unwrap()
}

/// One test: the cache folder is process-wide (environment).
#[tokio::test]
async fn queue_files_survive_until_confirmed() {
    let dir = std::env::temp_dir().join(format!("medoc-queue-{}", uuid::Uuid::new_v4()));
    std::env::set_var("MEDOC_CACHE_DIR", &dir);
    std::env::set_var("MEDOC_CACHE_KEY_HEX", "22".repeat(32));
    let pool = pool().await;

    // Send journal: written before the request; a power cut lost the rows from the database.
    durable_queue::journal_send(SendChannel::Push, &[entry("e-1", 1), entry("e-2", 2)]);
    assert!(dir.join("sync-send-push.mdc").exists());
    let restored = durable_queue::recover(&pool).await.unwrap();
    assert_eq!(restored, 2);
    assert_eq!(outbox_ids(&pool).await, vec!["e-1", "e-2"]);
    assert!(
        !dir.join("sync-send-push.mdc").exists(),
        "journal cleared after restore"
    );

    // Rows still present: recovery restores nothing twice.
    durable_queue::journal_send(SendChannel::Exchange, &[entry("e-1", 1)]);
    assert_eq!(durable_queue::recover(&pool).await.unwrap(), 0);

    // Confirmed send (2xx): the journal is deleted.
    durable_queue::journal_send(SendChannel::Push, &[entry("e-3", 3)]);
    durable_queue::confirm_send(SendChannel::Push);
    assert!(!dir.join("sync-send-push.mdc").exists());

    // Spool: a change the outbox could not take is kept, then drained and the file deleted.
    durable_queue::spool_change(SpooledChange {
        entity_table: "patient".into(),
        entity_id: "p-9".into(),
        op: "UPDATE".into(),
        payload_json: r#"{"id":"p-9"}"#.into(),
        queued_at: "2026-11-22T10:05:00Z".into(),
    })
    .unwrap();
    assert!(dir.join("sync-spool.mdc").exists());
    assert_eq!(durable_queue::drain_spool(&pool).await.unwrap(), 0);
    assert!(!dir.join("sync-spool.mdc").exists());

    let _ = std::fs::remove_dir_all(dir);
}
