//! T5.8 phase 1: every local change carries its author (`syncActor`) inside the signed payload.
//! The author is the scoped actor (LAN request, background job) if one is set, else the person
//! signed in on this device, else `system`.

use medoc_core::infrastructure::database::actor::{self, SYSTEM};
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::field_hlc;
use medoc_core::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use medoc_core::infrastructure::database::sync_outbox::record_or_noop;
use sqlx::SqlitePool;

async fn replicating_pool() -> SqlitePool {
    let pool = test_memory_pool().await.unwrap();
    run_migrations(&pool).await.unwrap();
    app_kv_repo::set(
        &pool,
        "sync.deployment.v1",
        r#"{"schemaVersion":1,"mode":"serverless_peer","role":"REPLICA","masterBaseUrl":"","masterCertSha256":"","masterAccessToken":"","deviceLabel":"Test"}"#,
    )
    .await
    .unwrap();
    pool
}

async fn last_actor(pool: &SqlitePool, entity_id: &str) -> Option<String> {
    let payload: String = sqlx::query_scalar(
        "SELECT payload_json FROM sync_outbox WHERE entity_id = ?1 ORDER BY seq DESC LIMIT 1",
    )
    .bind(entity_id)
    .fetch_one(pool)
    .await
    .unwrap();
    let v: serde_json::Value = serde_json::from_str(&payload).unwrap();
    v.get(actor::PAYLOAD_KEY)
        .and_then(|a| a.as_str())
        .map(str::to_string)
}

#[tokio::test]
async fn local_write_carries_the_scoped_actor() {
    let pool = replicating_pool().await;
    actor::with_actor("dr-a", async {
        record_or_noop(&pool, "patient", "p-scoped", "UPDATE", "")
            .await
            .unwrap();
    })
    .await;
    assert_eq!(last_actor(&pool, "p-scoped").await.as_deref(), Some("dr-a"));
}

#[tokio::test]
async fn deletes_carry_the_actor_too() {
    let pool = replicating_pool().await;
    actor::with_actor("dr-b", async {
        record_or_noop(&pool, "patient", "p-del", "DELETE", "")
            .await
            .unwrap();
    })
    .await;
    assert_eq!(last_actor(&pool, "p-del").await.as_deref(), Some("dr-b"));
}

#[tokio::test]
async fn background_jobs_write_as_system() {
    let pool = replicating_pool().await;
    actor::with_actor(SYSTEM, async {
        record_or_noop(&pool, "patient", "p-sys", "UPDATE", "")
            .await
            .unwrap();
    })
    .await;
    assert_eq!(last_actor(&pool, "p-sys").await.as_deref(), Some(SYSTEM));
}

/// The device-wide actor is process state, so all of its cases live in one test.
#[tokio::test]
async fn device_actor_follows_sign_in_and_sign_out() {
    assert_eq!(actor::current(), SYSTEM, "nobody signed in");
    actor::set_device_actor(Some("desk-1"));
    assert_eq!(actor::current(), "desk-1");
    let scoped = actor::with_actor("dr-lan", async { actor::current() }).await;
    assert_eq!(
        scoped, "dr-lan",
        "a scoped actor wins over the device actor"
    );
    assert_eq!(actor::current(), "desk-1", "the scope ends with its future");
    actor::set_device_actor(None);
    assert_eq!(actor::current(), SYSTEM);
}

#[test]
fn the_actor_key_is_not_a_merged_field() {
    assert!(!field_hlc::is_merged_field(actor::PAYLOAD_KEY));
}
