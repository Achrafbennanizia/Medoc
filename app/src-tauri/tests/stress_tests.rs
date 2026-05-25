//! G11 / WAAD 9.4 — lightweight stress harness: 5 parallel logical clients hammering the audit chain.

use medoc_lib::infrastructure::database::audit_repo;
use medoc_lib::infrastructure::database::connection::test_memory_pool;
use std::sync::{Arc, Once};

static INIT_AUDIT: Once = Once::new();

fn init_audit_for_tests() {
    INIT_AUDIT.call_once(|| {
        std::env::set_var("MEDOC_AUDIT_KEY", "k9-medoc-test-audit-key-32bytes!");
        let base = std::env::temp_dir().join("medoc-stress-tests");
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
async fn five_parallel_clients_audit_inserts_remain_valid() {
    init_audit_for_tests();
    let pool = Arc::new(mem_pool().await);
    const CLIENTS: usize = 5;
    const OPS_PER_CLIENT: usize = 20;

    let mut client_handles = Vec::with_capacity(CLIENTS);
    for client in 0..CLIENTS {
        let pool = pool.clone();
        client_handles.push(tokio::spawn(async move {
            let mut op_handles = Vec::with_capacity(OPS_PER_CLIENT);
            for op in 0..OPS_PER_CLIENT {
                let pool = pool.clone();
                op_handles.push(tokio::spawn(async move {
                    audit_repo::create(
                        &pool,
                        &format!("client-{client}"),
                        "CREATE",
                        "Patient",
                        Some(&format!("c{client}-op{op}")),
                        None,
                    )
                    .await
                }));
            }
            for h in op_handles {
                h.await
                    .expect("join op")
                    .expect("stress audit insert must succeed");
            }
        }));
    }

    for h in client_handles {
        h.await.expect("join client");
    }

    let expected = (CLIENTS * OPS_PER_CLIENT) as i64;
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM audit_log")
        .fetch_one(pool.as_ref())
        .await
        .expect("count");
    assert_eq!(count.0, expected);

    let broken = audit_repo::verify_chain(pool.as_ref())
        .await
        .expect("verify");
    assert!(
        broken.is_none(),
        "5 parallel clients must not break audit chain: {:?}",
        broken
    );
}
