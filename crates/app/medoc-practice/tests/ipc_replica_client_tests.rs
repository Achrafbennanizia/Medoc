//! Replica is a LAN client: no listen sockets; writes go to the outbox.

mod support;

use chrono::NaiveDate;
use medoc_core::domain::entities::patient::CreatePatient;
use medoc_core::domain::enums::Sex;
use medoc_core::infrastructure::database::patient_repo;
use medoc_practice::commands::company_portal_commands::apply_serverless_role_from_license_code;
use medoc_practice::commands::lan_commands::lan_listen_block_reason;
use medoc_practice::commands::staff_commands::reject_staff_writes_on_replica;
use medoc_sync::deployment::{DeploymentMode, DeviceRole};
use medoc_sync::engine::SyncEngine;
use serial_test::serial;
use support::fresh_pool;

fn sample_patient(name: &str) -> CreatePatient {
    CreatePatient {
        name: name.into(),
        date_of_birth: NaiveDate::from_ymd_opt(1990, 1, 1).unwrap(),
        sex: Sex::Male,
        insurance_number: format!("V-{name}"),
        phone: None,
        email: None,
        address: None,
    }
}

#[tokio::test]
#[serial]
async fn master_license_code_sets_serverless_peer_master() {
    let pool = fresh_pool().await;
    apply_serverless_role_from_license_code(&pool, "MASTER-DEV-01")
        .await
        .expect("apply master");
    let snap = SyncEngine::status(&pool).await.expect("status");
    assert_eq!(snap.deployment.mode, DeploymentMode::ServerlessPeer);
    assert_eq!(snap.deployment.role, DeviceRole::Master);
    assert_eq!(snap.deployment.unstable_mesh, false);
    assert_eq!(lan_listen_block_reason(&pool).await, None);
}

#[tokio::test]
#[serial]
async fn replica_license_code_sets_serverless_peer_replica_and_blocks_lan() {
    let pool = fresh_pool().await;
    apply_serverless_role_from_license_code(&pool, "REPLICA-DEV-01")
        .await
        .expect("apply replica");
    let snap = SyncEngine::status(&pool).await.expect("status");
    assert_eq!(snap.deployment.mode, DeploymentMode::ServerlessPeer);
    assert_eq!(snap.deployment.role, DeviceRole::Replica);
    assert_eq!(lan_listen_block_reason(&pool).await, Some("replica"));
}

#[tokio::test]
#[serial]
async fn medoc_instance_env_blocks_lan_listen() {
    let pool = fresh_pool().await;
    std::env::set_var("MEDOC_INSTANCE", "2");
    let reason = lan_listen_block_reason(&pool).await;
    std::env::remove_var("MEDOC_INSTANCE");
    assert_eq!(reason, Some("instance"));
}

#[tokio::test]
#[serial]
async fn replica_patient_create_increases_pending_outbox() {
    let pool = fresh_pool().await;
    apply_serverless_role_from_license_code(&pool, "REPLICA-DEV-01")
        .await
        .expect("apply replica");
    let before: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox")
        .fetch_one(&pool)
        .await
        .unwrap();
    let _ = patient_repo::create(&pool, &sample_patient("replica-outbox"))
        .await
        .expect("create");
    let after: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox")
        .fetch_one(&pool)
        .await
        .unwrap();
    let patients: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox WHERE entity_table = 'patient'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(
        after > before,
        "outbox should grow, before={before} after={after}"
    );
    assert_eq!(patients, 1);
}

#[tokio::test]
#[serial]
async fn replica_cannot_create_staff() {
    let pool = fresh_pool().await;
    apply_serverless_role_from_license_code(&pool, "REPLICA-DEV-01")
        .await
        .expect("apply replica");
    let err = reject_staff_writes_on_replica(&pool)
        .await
        .expect_err("replica staff write");
    assert!(err.to_string().contains("Staff accounts are managed on the main device."));
}
