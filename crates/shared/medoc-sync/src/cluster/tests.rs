//! Practice network (Geräteverbund) domain + seat invariant tests.

use chrono::Utc;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use sqlx::SqlitePool;
use uuid::Uuid;

use super::entities::{Device, License, SeatUsage, Cluster};
use super::enums::{DeviceStatus, PairingStatus, SeatRole};
use super::ports::{reserve_seat_atomic, DeviceRepo, LicenseRepo, SqliteClusterRepos};
use crate::schema::ensure_sync_tables;

fn sample_license(cluster_id: &str) -> License {
    License {
        cluster_id: cluster_id.to_string(),
        license_ref: "test-license".into(),
        signing_key_enc: vec![1, 2, 3],
        max_total: 10,
        max_admin: 3,
        max_member: 7,
        activated_at: Utc::now(),
    }
}

fn sample_device(cluster_id: &str, fp: &str, role: SeatRole, status: DeviceStatus) -> Device {
    Device {
        fingerprint: fp.to_string(),
        cluster_id: cluster_id.to_string(),
        device_id: Uuid::new_v4().to_string(),
        pubkey: vec![1u8; 32],
        hostname: Some("test-host".into()),
        os: Some("macos".into()),
        last_ip: Some("192.168.1.10".into()),
        seat_role: role,
        status,
        seat_cert: None,
        last_seen: None,
        created_at: Utc::now(),
    }
}

#[test]
fn cluster_reserve_seat_rejects_when_full() {
    let cluster = Cluster {
        cluster_id: "c1".into(),
        max_total: 10,
        max_admin: 3,
        max_member: 7,
        usage: SeatUsage {
            admin_used: 3,
            member_used: 7,
            total_used: 10,
            max_admin: 3,
            max_member: 7,
            max_total: 10,
        },
    };
    assert!(cluster.reserve_seat(SeatRole::Member).is_err());
    assert!(cluster.reserve_seat(SeatRole::Admin).is_err());
}

#[test]
fn cluster_reserve_seat_admin_cap() {
    let cluster = Cluster {
        cluster_id: "c1".into(),
        max_total: 10,
        max_admin: 3,
        max_member: 7,
        usage: SeatUsage {
            admin_used: 3,
            member_used: 0,
            total_used: 3,
            max_admin: 3,
            max_member: 7,
            max_total: 10,
        },
    };
    assert!(cluster.reserve_seat(SeatRole::Admin).is_err());
    assert!(cluster.reserve_seat(SeatRole::Member).is_ok());
}

#[test]
fn pairing_state_machine_transitions() {
    use PairingStatus::*;
    assert!(Discovered.can_transition_to(JoinRequested));
    assert!(JoinRequested.can_transition_to(AwaitingSas));
    assert!(AwaitingSas.can_transition_to(SasConfirmed));
    assert!(SasConfirmed.can_transition_to(Provisioned));
    assert!(!Provisioned.can_transition_to(JoinRequested));
    assert!(AwaitingSas.can_transition_to(Aborted));
}

async fn fresh_pool() -> SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("schema");
    pool
}

#[tokio::test]
async fn seat_usage_counts_pending_and_active() {
    let pool = fresh_pool().await;
    let cluster_id = Uuid::new_v4().to_string();
    let repos = SqliteClusterRepos { pool: &pool };
    repos
        .save(&sample_license(&cluster_id))
        .await
        .expect("license");

    for i in 0..3 {
        repos
            .upsert(&sample_device(
                &cluster_id,
                &format!("fp-admin-{i}"),
                SeatRole::Admin,
                DeviceStatus::Active,
            ))
            .await
            .expect("upsert");
    }

    let usage = repos.seat_usage(&cluster_id).await.expect("usage");
    assert_eq!(usage.admin_used, 3);
    assert_eq!(usage.total_used, 3);
    assert!(
        reserve_seat_atomic(&pool, &cluster_id, SeatRole::Admin, 10, 3, 7)
            .await
            .is_err()
    );
}

#[tokio::test]
async fn incomplete_identity_not_counted_in_seat_usage() {
    let pool = fresh_pool().await;
    let cluster_id = Uuid::new_v4().to_string();
    let repos = SqliteClusterRepos { pool: &pool };
    repos
        .save(&sample_license(&cluster_id))
        .await
        .expect("license");
    repos
        .upsert(&sample_device(
            &cluster_id,
            "legacy-no-pubkey",
            SeatRole::Admin,
            DeviceStatus::Active,
        ))
        .await
        .expect("upsert");
    // Simulate migration: zero pubkey must not occupy a seat.
    sqlx::query("UPDATE sync_device SET pubkey = X'0000000000000000000000000000000000000000000000000000000000000000' WHERE fingerprint = 'legacy-no-pubkey'")
        .execute(&pool)
        .await
        .expect("update");
    let usage = repos.seat_usage(&cluster_id).await.expect("usage");
    assert_eq!(usage.total_used, 0);
}

#[test]
fn seat_budget_from_basis_edition() {
    use super::seat_budget::seat_budget_from_edition;
    let b = seat_budget_from_edition("BASIS");
    assert_eq!(b.max_total, 2);
    assert_eq!(b.max_admin, 1);
}

#[tokio::test]
async fn provisioning_is_idempotent_guard() {
    let pool = fresh_pool().await;
    let fp = "fp-prov-test";
    super::ports::mark_provisioned(&pool, fp)
        .await
        .expect("first");
    assert!(super::ports::mark_provisioned(&pool, fp).await.is_err());
    assert!(super::ports::is_provisioned(&pool, fp)
        .await
        .expect("check"));
}
