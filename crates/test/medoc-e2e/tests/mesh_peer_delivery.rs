//! Per-peer outbox delivery vector (mesh hardening).

use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_sync::repo;

#[tokio::test]
async fn mesh_peer_vector_prevents_duplicate_peer_push() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    medoc_sync::schema::ensure_sync_tables(&pool)
        .await
        .expect("sync tables");

    let local = repo::ensure_local_device(&pool, "local-device")
        .await
        .expect("local device");
    let peer = "device-peer";
    repo::append_outbox(
        &pool,
        &local,
        "app_kv",
        "k1",
        "INSERT",
        r#"{"key":"k1","value":"version"}"#,
    )
    .await
    .expect("outbox");
    repo::append_outbox(
        &pool,
        &local,
        "app_kv",
        "k2",
        "INSERT",
        r#"{"key":"k2","value":"v2"}"#,
    )
    .await
    .expect("outbox");

    let first = repo::list_pending_outbox_for_peer(&pool, &local, peer)
        .await
        .expect("pending");
    assert_eq!(first.len(), 2);

    repo::mark_peer_delivery(&pool, &local, peer, 1)
        .await
        .expect("mark");

    let second = repo::list_pending_outbox_for_peer(&pool, &local, peer)
        .await
        .expect("pending after");
    assert_eq!(second.len(), 1);
    assert_eq!(second[0].seq, 2);
}
