use medoc_lib::infrastructure::database::audit_repo;
use medoc_lib::infrastructure::database::brute_force_repo;
use medoc_lib::infrastructure::database::connection::test_memory_pool;
use medoc_lib::infrastructure::logging::brute_force::{
    self, BruteForceTracker, BruteKey, CheckResult, DESKTOP_PEER_IP,
};
use std::sync::Once;

static INIT_AUDIT: Once = Once::new();

fn init_audit() {
    INIT_AUDIT.call_once(|| {
        std::env::set_var("MEDOC_AUDIT_KEY", "k9-medoc-test-audit-key-32bytes!");
        let base = std::env::temp_dir().join("medoc-brute-force-tests");
        std::fs::create_dir_all(&base).expect("temp dir");
        audit_repo::init_audit_hmac_key(&base).expect("audit key");
    });
}

async fn pool() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    brute_force_repo::ensure_schema(&pool)
        .await
        .expect("schema");
    pool
}

fn key(subject: &str, peer: &str) -> BruteKey {
    BruteKey::from_subject(subject, peer).expect("brute key")
}

#[tokio::test]
async fn locks_out_after_six_failures() {
    init_audit();
    let pool = pool().await;
    let t = BruteForceTracker::new();
    let k = key("user@practice.de", "1.2.3.4");
    for _ in 0..5 {
        assert!(matches!(
            t.check(Some(&pool), &k).await,
            CheckResult::Allowed
        ));
        assert!(!t.record_failure(Some(&pool), &k).await);
    }
    assert!(t.record_failure(Some(&pool), &k).await);
    assert!(matches!(
        t.check(Some(&pool), &k).await,
        CheckResult::Locked { .. }
    ));
}

#[tokio::test]
async fn other_ip_unaffected() {
    init_audit();
    let pool = pool().await;
    let t = BruteForceTracker::new();
    let victim = key("victim@practice.de", "1.2.3.4");
    for _ in 0..6 {
        t.record_failure(Some(&pool), &victim).await;
    }
    let attacker_ip = key("victim@practice.de", "9.9.9.9");
    assert!(matches!(
        t.check(Some(&pool), &attacker_ip).await,
        CheckResult::Allowed
    ));
}

#[tokio::test]
async fn different_subject_same_ip_unaffected() {
    init_audit();
    let pool = pool().await;
    let t = BruteForceTracker::new();
    let a = key("alice@practice.de", "5.5.5.5");
    for _ in 0..6 {
        t.record_failure(Some(&pool), &a).await;
    }
    let b = key("bob@practice.de", "5.5.5.5");
    assert!(matches!(
        t.check(Some(&pool), &b).await,
        CheckResult::Allowed
    ));
}

#[tokio::test]
async fn success_clears_state() {
    init_audit();
    let pool = pool().await;
    let t = BruteForceTracker::new();
    let k = key("reset@practice.de", "8.8.8.8");
    for _ in 0..3 {
        t.record_failure(Some(&pool), &k).await;
    }
    t.record_success(Some(&pool), &k).await;
    for _ in 0..5 {
        assert!(!t.record_failure(Some(&pool), &k).await);
    }
}

#[tokio::test]
async fn lockout_survives_hydrate_restart() {
    init_audit();
    let pool = pool().await;
    let t1 = BruteForceTracker::new();
    let k = key("persist@practice.de", DESKTOP_PEER_IP);
    for _ in 0..6 {
        t1.record_failure(Some(&pool), &k).await;
    }
    assert!(matches!(
        t1.check(Some(&pool), &k).await,
        CheckResult::Locked { .. }
    ));

    let t2 = BruteForceTracker::new();
    t2.hydrate_from_db(&pool).await.expect("hydrate");
    assert!(matches!(
        t2.check(Some(&pool), &k).await,
        CheckResult::Locked { .. }
    ));
}

#[tokio::test]
async fn admin_clear_subject_removes_all_peer_ips() {
    init_audit();
    let pool = pool().await;
    let t = BruteForceTracker::new();
    let email = "admin-clear@practice.de";
    let hashed = brute_force::hash_subject(email).expect("hash");
    for ip in ["1.1.1.1", "2.2.2.2"] {
        let k = key(email, ip);
        for _ in 0..6 {
            t.record_failure(Some(&pool), &k).await;
        }
    }
    let removed = t.admin_clear_subject(&pool, &hashed).await.expect("clear");
    assert_eq!(removed, 2);
    let k = key(email, "1.1.1.1");
    assert!(matches!(
        t.check(Some(&pool), &k).await,
        CheckResult::Allowed
    ));
}
