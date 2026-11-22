//! Two-process TLS replica: the main device runs as a separate `medoc-server`
//! process over HTTPS with its self-signed certificate; the replica uses the
//! production sync path (`SyncEngine::push_to_master` / `pull_from_master`)
//! through the pinned TLS client, exactly as the desktop replica does.
//!
//! Needs the server binary: `cargo build -p medoc-lan-server` (the test fails
//! with a clear message when it is missing). Unlike `multi_device_port_http.rs`
//! it needs no Docker and no `MEDOC_MASTER_URL`.

use chrono::NaiveDate;
use medoc_core::domain::entities::patient::CreatePatient;
use medoc_core::domain::enums::Sex;
use medoc_core::infrastructure::database::repos::clinical::patient as patient_repo;
use medoc_e2e::harness::{
    self, open_headless_pool, prepare_master_data_dir, prepare_replica_data_dir,
    PORT_MASTER_SEED_PATIENT_NAME,
};
use medoc_e2e::port_client::{pair_replica_over_port, spawn_medoc_server, PortE2eClient};
use medoc_sync::engine::SyncEngine;

fn free_port() -> u16 {
    std::net::TcpListener::bind("127.0.0.1:0")
        .expect("bind")
        .local_addr()
        .expect("addr")
        .port()
}

fn fresh_dir(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("medoc-tls2p-{name}-{}", uuid::Uuid::new_v4()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

async fn set_pin(pool: &sqlx::SqlitePool, pin: &str) {
    let mut cfg = medoc_sync::repo::load_deployment(pool)
        .await
        .expect("deployment");
    cfg.master_cert_sha256 = pin.to_string();
    SyncEngine::set_deployment(pool, cfg)
        .await
        .expect("save pin");
}

#[tokio::test]
async fn replica_syncs_with_separate_master_process_over_pinned_tls() {
    harness::ensure_e2e_env();

    // Main device: its own data dir and its own OS process.
    let master_dir = fresh_dir("master");
    prepare_master_data_dir(&master_dir).await;
    // Same certificate the server loads from the data dir.
    let pin = medoc_lan::tls::ensure_lan_tls_identity(&master_dir)
        .expect("tls identity")
        .sha256_fingerprint;
    let port = free_port();
    let server = spawn_medoc_server(&master_dir, port, "TLS Master").await;

    // Pair over HTTPS (pairing itself is allowed before a pin exists).
    let client = PortE2eClient::lan(&server.base_url);
    let jwt = client.login_physician_totp("1234").await;
    let device_id = "tls2p-replica-1";
    let token = pair_replica_over_port(&client, &jwt, 41, device_id).await;
    let (_, info) = client
        .json("GET", "/api/v1/pairing/master-info", None, None)
        .await;
    let master_pubkey = info["masterPubkey"].as_str().expect("pubkey").to_string();
    let master_device_id = info["masterDeviceId"]
        .as_str()
        .expect("master id")
        .to_string();

    // Replica: separate data dir, production deployment config + the real pin.
    let replica_dir = fresh_dir("replica");
    prepare_replica_data_dir(
        &replica_dir,
        device_id,
        "TLS Replica",
        &server.base_url,
        &master_pubkey,
        &master_device_id,
        &token,
        false,
    )
    .await;
    let replica = open_headless_pool(&replica_dir).await;
    set_pin(&replica, &pin).await;

    // Replica write → push over pinned TLS → row on the main device.
    let created = patient_repo::create(
        &replica,
        &CreatePatient {
            name: "TLS Two Process".into(),
            date_of_birth: NaiveDate::from_ymd_opt(1979, 9, 9).unwrap(),
            sex: Sex::Female,
            insurance_number: "TLS-2P-1".into(),
            phone: None,
            email: None,
            address: None,
        },
    )
    .await
    .expect("create on replica");
    let pushed = SyncEngine::push_to_master(&replica)
        .await
        .expect("push over TLS");
    assert!(
        pushed.accepted >= 1,
        "main accepted the replica's rows: {pushed:?}"
    );

    let master_pool = open_headless_pool(&master_dir).await;
    let on_master: Option<String> = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(&created.id)
        .fetch_optional(&master_pool)
        .await
        .expect("query master");
    assert_eq!(on_master.as_deref(), Some("TLS Two Process"));

    // Main device data → pull over pinned TLS → row on the replica.
    let pulled = SyncEngine::pull_from_master(&replica)
        .await
        .expect("pull over TLS");
    assert!(
        pulled.applied >= 1,
        "replica applied rows from main: {pulled:?}"
    );
    let seeded: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM patient WHERE name = ?1")
        .bind(PORT_MASTER_SEED_PATIENT_NAME)
        .fetch_one(&replica)
        .await
        .expect("query replica");
    assert_eq!(seeded, 1, "main's seeded patient arrived on the replica");

    // Wrong pin: the TLS handshake must be refused, nothing is sent.
    set_pin(&replica, &"0".repeat(64)).await;
    patient_repo::create(
        &replica,
        &CreatePatient {
            name: "Must Not Arrive".into(),
            date_of_birth: NaiveDate::from_ymd_opt(1970, 1, 1).unwrap(),
            sex: Sex::Male,
            insurance_number: "TLS-2P-2".into(),
            phone: None,
            email: None,
            address: None,
        },
    )
    .await
    .expect("second create");
    let err = SyncEngine::push_to_master(&replica)
        .await
        .expect_err("pin mismatch must fail");
    let msg = err.to_string().to_lowercase();
    assert!(
        // reqwest wraps the rustls "certificate pin mismatch" as a send error.
        msg.contains("certificate")
            || msg.contains("pin")
            || msg.contains("tls")
            || msg.contains("error sending request"),
        "unexpected error for pin mismatch: {msg}"
    );
    let leaked: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM patient WHERE name = 'Must Not Arrive'")
            .fetch_one(&master_pool)
            .await
            .expect("query master");
    assert_eq!(leaked, 0);

    drop(server);
    let _ = std::fs::remove_dir_all(&master_dir);
    let _ = std::fs::remove_dir_all(&replica_dir);
}
