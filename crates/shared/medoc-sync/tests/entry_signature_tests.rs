//! Signed change envelopes: forged, altered or re-keyed changes are refused before any merge.

use ed25519_dalek::SigningKey;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use medoc_sync::entry_signature::{
    sign_batch, verify_batch, BatchTrust, SignedBatch, REQUIRE_SIGNED_KV,
};
use medoc_sync::repo::OutboxEntry;
use medoc_sync::schema::ensure_sync_tables;
use sqlx::SqlitePool;

async fn pool() -> SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");
    ensure_sync_tables(&pool).await.expect("sync schema");
    pool
}

fn entry(seq: i64, payload: &str) -> OutboxEntry {
    OutboxEntry {
        id: format!("e-{seq}"),
        device_id: "replica-1".into(),
        seq,
        entity_table: "patient".into(),
        entity_id: "p-1".into(),
        op: "UPDATE".into(),
        payload_json: payload.into(),
        created_at: "2026-11-22T10:00:00Z".into(),
    }
}

fn key(seed: u8) -> SigningKey {
    SigningKey::from_bytes(&[seed; 32])
}

#[tokio::test]
async fn signed_batch_is_accepted_and_key_is_pinned() {
    let pool = pool().await;
    let entries = vec![
        entry(1, r#"{"id":"p-1","name":"A"}"#),
        entry(2, r#"{"id":"p-1","name":"B"}"#),
    ];
    let batch = sign_batch(&key(7), &entries);
    let trust = verify_batch(&pool, "replica-1", &entries, &batch)
        .await
        .expect("valid");
    assert_eq!(trust, BatchTrust::Signed);

    // Same device, another key: refused (pinned on first use).
    let other = sign_batch(&key(9), &entries);
    let err = verify_batch(&pool, "replica-1", &entries, &other)
        .await
        .expect_err("re-keyed");
    assert!(err.to_string().contains("change_signer_unknown"), "{err}");
}

#[tokio::test]
async fn altered_payload_is_refused() {
    let pool = pool().await;
    let mut entries = vec![entry(1, r#"{"id":"p-1","name":"A"}"#)];
    let batch = sign_batch(&key(7), &entries);
    entries[0].payload_json = r#"{"id":"p-1","name":"Mallory"}"#.into();
    let err = verify_batch(&pool, "replica-1", &entries, &batch)
        .await
        .expect_err("tampered");
    assert!(
        err.to_string().contains("change_signature_invalid"),
        "{err}"
    );
}

#[tokio::test]
async fn unsigned_batch_accepted_until_signing_is_required() {
    let pool = pool().await;
    let entries = vec![entry(1, "{}")];
    let trust = verify_batch(&pool, "replica-1", &entries, &SignedBatch::default())
        .await
        .unwrap();
    assert_eq!(trust, BatchTrust::UnsignedAccepted);

    app_kv_repo::set(&pool, REQUIRE_SIGNED_KV, "1")
        .await
        .unwrap();
    let err = verify_batch(&pool, "replica-1", &entries, &SignedBatch::default())
        .await
        .expect_err("unsigned refused");
    assert!(err.to_string().contains("unsigned_changes"), "{err}");
}

#[tokio::test]
async fn missing_signature_for_one_entry_refuses_the_batch() {
    let pool = pool().await;
    let entries = vec![entry(1, "{}"), entry(2, "{}")];
    let mut batch = sign_batch(&key(7), &entries[..1]);
    batch.signer = sign_batch(&key(7), &entries).signer;
    assert!(verify_batch(&pool, "replica-1", &entries, &batch)
        .await
        .is_err());
}
