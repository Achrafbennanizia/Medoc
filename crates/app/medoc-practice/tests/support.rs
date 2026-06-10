//! Test fixtures for medoc-practice IPC tests.

use medoc_core::infrastructure::database::connection;
use medoc_sync::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
use medoc_sync::engine::SyncEngine;
use medoc_sync::schema::ensure_sync_tables;
use sqlx::SqlitePool;

static ENV: std::sync::Once = std::sync::Once::new();

pub fn ensure_env() {
    ENV.call_once(|| {
        std::env::set_var("MEDOC_DEV_SEED", "1");
        std::env::set_var(
            "MEDOC_PAIRING_MASTER_SECRET",
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        );
        std::env::set_var(
            "MEDOC_DB_KEY",
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        );
        std::env::set_var(
            "MEDOC_VENDOR_PUBKEY",
            "79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32",
        );
    });
}

pub async fn fresh_pool() -> SqlitePool {
    ensure_env();
    let pool = connection::test_memory_pool().await.expect("pool");
    connection::run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("sync schema");
    pool
}

pub async fn seed_master_license(pool: &SqlitePool) {
    use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
    use chrono::{TimeZone, Utc};
    use ed25519_dalek::{Signer, SigningKey};
    use medoc_core::infrastructure::license::{encrypt_v2_for_device, LicenseV2, VENDOR_PUBKEY};
    use medoc_core::infrastructure::license_repo;

    const VENDOR_KEY_HEX: &str = "8762be1a9a0963f36d98d47c0de6a73a0124b77d3268c170365824a6045d2fbf";

    let device_id = medoc_sync::repo::ensure_local_device(pool, "IPC Master")
        .await
        .expect("device");
    let mut bytes = [0u8; 32];
    for (i, chunk) in VENDOR_KEY_HEX.as_bytes().chunks(2).enumerate() {
        bytes[i] = u8::from_str_radix(std::str::from_utf8(chunk).unwrap(), 16).unwrap();
    }
    let sk = SigningKey::from_bytes(&bytes);
    assert_eq!(sk.verifying_key().to_bytes(), VENDOR_PUBKEY);
    let lic = LicenseV2 {
        version: 2,
        customer_id: "ipc-test".into(),
        edition: "PRO".into(),
        device_id: device_id.clone(),
        activated_at: Utc.with_ymd_and_hms(2026, 5, 26, 12, 0, 0).unwrap(),
        max_users: 5,
        modules: vec![],
        edition_features: vec![],
    };
    let body = serde_json::to_string(&lic).unwrap();
    let sig = sk.sign(body.as_bytes());
    let signed = format!("{body}.{}", STANDARD_NO_PAD.encode(sig.to_bytes()));
    let envelope = encrypt_v2_for_device(&signed, &device_id).expect("encrypt");
    license_repo::store_v2(pool, &envelope)
        .await
        .expect("store");
    SyncEngine::set_deployment(
        pool,
        SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Master,
            device_label: "IPC Master".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deploy");
}
