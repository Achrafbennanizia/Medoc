//! Practice network seat cap invariants (3 ADMIN / 7 MEMBER / 10 total).

use chrono::Utc;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_sync::schema::ensure_sync_tables;
use medoc_sync::cluster::{
    reserve_seat_atomic, Device, DeviceRepo, DeviceStatus, License, LicenseRepo, SeatRole,
    SqliteClusterRepos,
};
use uuid::Uuid;

async fn fresh_pool() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("sync");
    pool
}

#[tokio::test]
async fn cluster_rejects_fourth_admin_seat() {
    let pool = fresh_pool().await;
    let cluster_id = Uuid::new_v4().to_string();
    let repos = SqliteClusterRepos { pool: &pool };
    repos
        .save(&License {
            cluster_id: cluster_id.clone(),
            license_ref: "e2e".into(),
            signing_key_enc: vec![1, 2, 3],
            max_total: 10,
            max_admin: 3,
            max_member: 7,
            activated_at: Utc::now(),
        })
        .await
        .expect("license");

    for i in 0..3 {
        let g = Device {
            fingerprint: format!("admin-{i}"),
            cluster_id: cluster_id.clone(),
            device_id: Uuid::new_v4().to_string(),
            pubkey: vec![1u8; 32],
            hostname: None,
            os: None,
            last_ip: None,
            seat_role: SeatRole::Admin,
            status: DeviceStatus::Active,
            seat_cert: None,
            last_seen: None,
            created_at: Utc::now(),
        };
        repos.upsert(&g).await.expect("upsert");
    }

    assert!(
        reserve_seat_atomic(&pool, &cluster_id, SeatRole::Admin, 10, 3, 7)
            .await
            .is_err()
    );
    assert!(
        reserve_seat_atomic(&pool, &cluster_id, SeatRole::Member, 10, 3, 7)
            .await
            .is_ok()
    );
}
