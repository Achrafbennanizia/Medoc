// Integration test for audit CSV export (ISO-compliance report handoff).

use medoc_lib::infrastructure::database::audit_repo;
use medoc_lib::infrastructure::database::connection::test_memory_pool;
use std::sync::Once;

static INIT_AUDIT: Once = Once::new();

/// Integration tests link the library without `cfg(test)`; the audit HMAC key
/// must be initialised the same way as in `connection::init_db`.
fn init_audit_for_tests() {
    INIT_AUDIT.call_once(|| {
        // Stable key for integration tests (avoids keychain flakiness in CI).
        std::env::set_var("MEDOC_AUDIT_KEY", "k9-medoc-test-audit-key-32bytes!");
        let base = std::env::temp_dir().join("medoc-audit-chain-tests");
        std::fs::create_dir_all(&base).expect("create temp app data dir");
        audit_repo::init_audit_hmac_key(&base).expect("init audit HMAC key");
    });
}

async fn mem_pool() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("encrypted memory pool");
    sqlx::query(
        "CREATE TABLE audit_log (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            action TEXT NOT NULL,
            entity TEXT NOT NULL,
            entity_id TEXT,
            details TEXT,
            prev_hash TEXT,
            hmac TEXT NOT NULL,
            under_break_glass INTEGER NOT NULL DEFAULT 0,
            break_glass_reason TEXT,
            created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
        )",
    )
    .execute(&pool)
    .await
    .unwrap();
    pool
}

#[tokio::test]
async fn audit_chain_links_consecutive_entries() {
    init_audit_for_tests();
    let pool = mem_pool().await;
    audit_repo::create(&pool, "u1", "CREATE", "Patient", Some("p1"), None)
        .await
        .expect("first");
    audit_repo::create(
        &pool,
        "u1",
        "UPDATE",
        "Patient",
        Some("p1"),
        Some("change name"),
    )
    .await
    .expect("second");
    let tampered = audit_repo::verify_chain(&pool).await.unwrap();
    assert!(tampered.is_none(), "unmodified chain must verify");
}

#[tokio::test]
async fn audit_chain_detects_tampering() {
    init_audit_for_tests();
    let pool = mem_pool().await;
    audit_repo::create(&pool, "u1", "CREATE", "Patient", Some("p1"), None)
        .await
        .unwrap();
    // Mutate a row's action to simulate tampering.
    sqlx::query("UPDATE audit_log SET action = 'HIDDEN' WHERE action = 'CREATE'")
        .execute(&pool)
        .await
        .unwrap();
    let bad = audit_repo::verify_chain(&pool).await.unwrap();
    assert!(bad.is_some(), "tampered row must be flagged");
}

#[tokio::test]
async fn audit_chain_concurrent_inserts_remain_valid() {
    init_audit_for_tests();
    let pool = std::sync::Arc::new(mem_pool().await);
    let n = 50usize;
    let mut handles = Vec::with_capacity(n);
    for i in 0..n {
        let pool = pool.clone();
        handles.push(tokio::spawn(async move {
            audit_repo::create(
                &pool,
                "u-concurrent",
                "CREATE",
                "Patient",
                Some(&format!("p-{i}")),
                None,
            )
            .await
        }));
    }
    for h in handles {
        h.await
            .expect("join")
            .expect("concurrent audit insert must succeed");
    }
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM audit_log")
        .fetch_one(pool.as_ref())
        .await
        .expect("count");
    assert_eq!(count.0, n as i64);
    let broken = audit_repo::verify_chain(pool.as_ref())
        .await
        .expect("verify");
    assert!(
        broken.is_none(),
        "concurrent inserts must not fork the hash chain: broken at {:?}",
        broken
    );
}
