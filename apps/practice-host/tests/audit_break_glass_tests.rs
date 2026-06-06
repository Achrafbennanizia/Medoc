//! Audit rows record active break-glass context per user/entity.

use medoc_lib::application::break_glass::{BreakGlassGrant, BreakGlassState};
use medoc_lib::infrastructure::database::audit_break_glass;
use medoc_lib::infrastructure::database::audit_repo;
use medoc_lib::infrastructure::database::connection::test_memory_pool;
use std::sync::{Arc, Once};
use std::time::Instant;

static INIT_AUDIT: Once = Once::new();

fn init_audit_for_tests() {
    INIT_AUDIT.call_once(|| {
        std::env::set_var("MEDOC_AUDIT_KEY", "k9-medoc-test-audit-key-32bytes!");
        let base = std::env::temp_dir().join("medoc-audit-break-glass-tests");
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
async fn audit_create_flags_active_break_glass() {
    init_audit_for_tests();
    let pool = mem_pool().await;
    let bg = Arc::new(BreakGlassState::new());
    audit_break_glass::register_break_glass(Arc::clone(&bg));

    bg.grant(BreakGlassGrant {
        user_id: "u1".into(),
        reason: "Notfall Patient X".into(),
        patient_id: Some("p1".into()),
        granted_at: Instant::now(),
    });

    audit_repo::create(&pool, "u1", "READ", "Patient", Some("p1"), None)
        .await
        .expect("create under break-glass");
    audit_repo::create(&pool, "u1", "READ", "Patient", Some("p2"), None)
        .await
        .expect("create outside patient scope");

    let (all, _) = audit_repo::find_paginated(&pool, 10, 0, "DESC", false)
        .await
        .expect("list all");
    let flagged: Vec<_> = all.iter().filter(|r| r.under_break_glass).collect();
    assert_eq!(flagged.len(), 1);
    assert_eq!(
        flagged[0].break_glass_reason.as_deref(),
        Some("Notfall Patient X")
    );

    let (only_bg, total_bg) = audit_repo::find_paginated(&pool, 10, 0, "DESC", true)
        .await
        .expect("list break-glass only");
    assert_eq!(total_bg, 1);
    assert_eq!(only_bg.len(), 1);
    assert!(only_bg[0].under_break_glass);
}
