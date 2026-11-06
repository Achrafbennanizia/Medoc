//! Loopback integration: TCP listener bind + Noise XX handshake + JOIN_REQUEST.

use std::net::IpAddr;

use chrono::Utc;
use medoc_core::infrastructure::database::audit_repo::init_audit_hmac_key;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_sync::cluster::crypto::{derive_sas_from_transcript, hash_sas, DeviceIdentity};
use medoc_sync::cluster::services::{
    list_pending_requests, mirror_join_session, store_join_admin_endpoint, submit_sas,
    PairingHandle,
};
use medoc_sync::cluster::SeatRole;
use medoc_sync::cluster::{License, LicenseRepo, PairingRepo, PairingStatus, SqliteClusterRepos};
use medoc_sync::net::{
    bind_cluster_listener, complete_xx_handshake, confirm_sas_on_admin, fetch_staff_directory,
    generate_keypair, handle_join_connection, join_admin_endpoint, run_xx_initiator,
    run_xx_responder, spawn_cluster_connection_handler,
};
use medoc_sync::schema::ensure_sync_tables;
use tokio::net::TcpStream;

async fn fresh_pool() -> sqlx::SqlitePool {
    let audit_dir =
        std::env::temp_dir().join(format!("medoc-cluster-test-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&audit_dir).expect("audit dir");
    init_audit_hmac_key(&audit_dir).expect("audit key");
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("schema");
    pool
}

#[tokio::test]
async fn cluster_listener_binds_private_loopback() {
    let addr: IpAddr = "127.0.0.1".parse().unwrap();
    let listener = bind_cluster_listener(addr, 0).await.expect("bind");
    assert!(listener.local_addr().unwrap().port() > 0);
}

#[test]
fn noise_xx_produces_shared_transcript() {
    let kp1 = generate_keypair().expect("kp1");
    let kp2 = generate_keypair().expect("kp2");
    let (_t1, _t2, transcript) = complete_xx_handshake(&kp1, &kp2).expect("hs");
    assert!(!transcript.is_empty());
}

#[tokio::test]
async fn xx_handshake_over_tcp_matches_transcript() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("addr");
    let server = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.expect("accept");
        run_xx_responder(&mut stream).await.expect("responder")
    });
    let mut client = TcpStream::connect(addr).await.expect("connect");
    let (_t1, tr1) = run_xx_initiator(&mut client).await.expect("initiator");
    let (_t2, tr2) = server.await.expect("server");
    assert_eq!(tr1, tr2);
}

#[tokio::test]
async fn join_request_accept_over_loopback() {
    std::env::set_var(
        "MEDOC_CLUSTER_DEVICE_SECRET",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );

    let pool = fresh_pool().await;
    let addr: IpAddr = "127.0.0.1".parse().unwrap();
    let listener = bind_cluster_listener(addr, 0).await.expect("bind");
    let port = listener.local_addr().unwrap().port();
    let pool_clone = pool.clone();

    let server = tokio::spawn(async move {
        let (stream, _) = listener.accept().await.expect("accept");
        handle_join_connection(stream, pool_clone).await;
    });

    let identity = DeviceIdentity::load_or_create().expect("identity");
    let outcome = join_admin_endpoint("127.0.0.1", port, &identity, SeatRole::Member)
        .await
        .expect("join");
    server.await.expect("server done");

    assert!(!outcome.session_id.is_empty());
    assert!(!outcome.handshake_transcript.is_empty());

    let pending = list_pending_requests(&pool).await.expect("pending");
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].fingerprint, identity.fingerprint);

    let stored_b64: Option<String> =
        sqlx::query_scalar("SELECT handshake_transcript_b64 FROM pairing_request WHERE id = ?1")
            .bind(&pending[0].id)
            .fetch_optional(&pool)
            .await
            .expect("select transcript");
    let stored = stored_b64.filter(|s| !s.trim().is_empty()).map(|s| {
        base64::Engine::decode(&base64::engine::general_purpose::STANDARD, s.trim())
            .expect("decode stored transcript")
    });
    assert_eq!(
        stored.as_deref(),
        Some(outcome.handshake_transcript.as_slice()),
        "admin must persist the same Noise transcript the joiner uses for SAS"
    );
    assert_eq!(
        derive_sas_from_transcript(stored.as_ref().unwrap()),
        derive_sas_from_transcript(&outcome.handshake_transcript)
    );

    std::env::remove_var("MEDOC_CLUSTER_DEVICE_SECRET");
}

#[tokio::test]
async fn replica_sas_uses_stored_transcript_not_ipc_garbage() {
    std::env::set_var(
        "MEDOC_CLUSTER_DEVICE_SECRET",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );

    let admin_pool = fresh_pool().await;
    let replica_pool = fresh_pool().await;
    let addr: IpAddr = "127.0.0.1".parse().unwrap();
    let listener = bind_cluster_listener(addr, 0).await.expect("bind");
    let port = listener.local_addr().unwrap().port();
    let pool_clone = admin_pool.clone();

    let server = tokio::spawn(async move {
        let (stream, _) = listener.accept().await.expect("accept");
        handle_join_connection(stream, pool_clone).await;
    });

    let identity = DeviceIdentity::load_or_create().expect("identity");
    let outcome = join_admin_endpoint("127.0.0.1", port, &identity, SeatRole::Member)
        .await
        .expect("join");
    server.await.expect("server done");

    mirror_join_session(
        &replica_pool,
        &outcome.session_id,
        &outcome.fingerprint,
        SeatRole::Member,
        &outcome.handshake_transcript,
    )
    .await
    .expect("mirror");

    let digits = derive_sas_from_transcript(&outcome.handshake_transcript);
    let handle = PairingHandle {
        session_id: outcome.session_id,
        fingerprint: outcome.fingerprint,
    };
    let wrong_ipc = vec![0xAAu8; 64];
    submit_sas(&replica_pool, "joiner", &handle, &digits, &wrong_ipc)
        .await
        .expect(
            "SAS must follow the join transcript stored in SQLite, not a corrupted IPC payload",
        );

    std::env::remove_var("MEDOC_CLUSTER_DEVICE_SECRET");
}

async fn save_admin_license(pool: &sqlx::SqlitePool) -> Vec<u8> {
    let signing_key = vec![7u8; 32];
    let repos = SqliteClusterRepos { pool };
    repos
        .save(&License {
            cluster_id: "c-sas".into(),
            license_ref: "test".into(),
            signing_key_enc: signing_key.clone(),
            max_total: 10,
            max_admin: 3,
            max_member: 7,
            activated_at: Utc::now(),
        })
        .await
        .expect("license");
    signing_key
}

async fn arm_admin_sas(pool: &sqlx::SqlitePool, session_id: &str, digits: &str) {
    let signing_key = save_admin_license(pool).await;
    let sas_hash = hash_sas(session_id, digits, &signing_key);
    SqliteClusterRepos { pool }
        .update_state(session_id, PairingStatus::AwaitingSas, Some(&sas_hash))
        .await
        .expect("awaiting sas");
}

#[tokio::test]
async fn sas_confirm_via_spawned_cluster_handler() {
    std::env::set_var(
        "MEDOC_CLUSTER_DEVICE_SECRET",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );

    let admin_pool = fresh_pool().await;
    let replica_pool = fresh_pool().await;
    let addr: IpAddr = "127.0.0.1".parse().unwrap();
    let listener = bind_cluster_listener(addr, 0).await.expect("bind");
    let port = listener.local_addr().unwrap().port();
    let pool_clone = admin_pool.clone();
    tokio::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((stream, _)) => spawn_cluster_connection_handler(stream, pool_clone.clone()),
                Err(_) => break,
            }
        }
    });

    let identity = DeviceIdentity::load_or_create().expect("identity");
    let outcome = join_admin_endpoint("127.0.0.1", port, &identity, SeatRole::Member)
        .await
        .expect("join");
    let digits = derive_sas_from_transcript(&outcome.handshake_transcript);
    arm_admin_sas(&admin_pool, &outcome.session_id, &digits).await;

    confirm_sas_on_admin("127.0.0.1", port, &outcome.session_id, &digits)
        .await
        .expect("admin hash must accept the displayed SAS");
    let bad = confirm_sas_on_admin("127.0.0.1", port, &outcome.session_id, "0000").await;
    assert!(bad.is_err(), "wrong digits must fail remote SAS");

    mirror_join_session(
        &replica_pool,
        &outcome.session_id,
        &outcome.fingerprint,
        SeatRole::Member,
        &vec![0xAAu8; 64],
    )
    .await
    .expect("mirror garbage transcript");
    store_join_admin_endpoint(&replica_pool, "127.0.0.1", port)
        .await
        .expect("endpoint");
    let handle = PairingHandle {
        session_id: outcome.session_id,
        fingerprint: outcome.fingerprint,
    };
    submit_sas(&replica_pool, "joiner", &handle, &digits, &[])
        .await
        .expect("replica must accept the admin-shown SAS even if local transcript differs");

    std::env::remove_var("MEDOC_CLUSTER_DEVICE_SECRET");
}

#[tokio::test]
async fn sas_confirm_works_when_license_exists_before_join() {
    std::env::set_var(
        "MEDOC_CLUSTER_DEVICE_SECRET",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );

    let admin_pool = fresh_pool().await;
    save_admin_license(&admin_pool).await;
    let addr: IpAddr = "127.0.0.1".parse().unwrap();
    let listener = bind_cluster_listener(addr, 0).await.expect("bind");
    let port = listener.local_addr().unwrap().port();
    let pool_clone = admin_pool.clone();
    tokio::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((stream, _)) => spawn_cluster_connection_handler(stream, pool_clone.clone()),
                Err(_) => break,
            }
        }
    });

    let identity = DeviceIdentity::load_or_create().expect("identity");
    let outcome = join_admin_endpoint("127.0.0.1", port, &identity, SeatRole::Member)
        .await
        .expect("join");
    let digits = derive_sas_from_transcript(&outcome.handshake_transcript);
    confirm_sas_on_admin("127.0.0.1", port, &outcome.session_id, &digits)
        .await
        .expect("join must arm SAS hash so confirm works without a separate Accept");

    std::env::remove_var("MEDOC_CLUSTER_DEVICE_SECRET");
}

#[tokio::test]
async fn sas_confirm_from_transcript_while_still_join_requested() {
    std::env::set_var(
        "MEDOC_CLUSTER_DEVICE_SECRET",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );

    let admin_pool = fresh_pool().await;
    let addr: IpAddr = "127.0.0.1".parse().unwrap();
    let listener = bind_cluster_listener(addr, 0).await.expect("bind");
    let port = listener.local_addr().unwrap().port();
    let pool_clone = admin_pool.clone();
    tokio::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((stream, _)) => spawn_cluster_connection_handler(stream, pool_clone.clone()),
                Err(_) => break,
            }
        }
    });

    let identity = DeviceIdentity::load_or_create().expect("identity");
    let outcome = join_admin_endpoint("127.0.0.1", port, &identity, SeatRole::Member)
        .await
        .expect("join");
    save_admin_license(&admin_pool).await;
    let digits = derive_sas_from_transcript(&outcome.handshake_transcript);
    confirm_sas_on_admin("127.0.0.1", port, &outcome.session_id, &digits)
        .await
        .expect("JOIN_REQUESTED plus stored transcript must still accept the handshake SAS");

    std::env::remove_var("MEDOC_CLUSTER_DEVICE_SECRET");
}

#[tokio::test]
async fn sas_confirm_uses_transcript_when_stored_hash_is_wrong() {
    std::env::set_var(
        "MEDOC_CLUSTER_DEVICE_SECRET",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );

    let admin_pool = fresh_pool().await;
    let signing_key = save_admin_license(&admin_pool).await;
    let addr: IpAddr = "127.0.0.1".parse().unwrap();
    let listener = bind_cluster_listener(addr, 0).await.expect("bind");
    let port = listener.local_addr().unwrap().port();
    let pool_clone = admin_pool.clone();
    tokio::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((stream, _)) => spawn_cluster_connection_handler(stream, pool_clone.clone()),
                Err(_) => break,
            }
        }
    });

    let identity = DeviceIdentity::load_or_create().expect("identity");
    let outcome = join_admin_endpoint("127.0.0.1", port, &identity, SeatRole::Member)
        .await
        .expect("join");
    let digits = derive_sas_from_transcript(&outcome.handshake_transcript);
    let wrong_hash = hash_sas(&outcome.session_id, "0000", &signing_key);
    SqliteClusterRepos { pool: &admin_pool }
        .update_state(
            &outcome.session_id,
            PairingStatus::AwaitingSas,
            Some(&wrong_hash),
        )
        .await
        .expect("stale hash");
    confirm_sas_on_admin("127.0.0.1", port, &outcome.session_id, &digits)
        .await
        .expect("displayed/handshake SAS must win over a stale HMAC");

    std::env::remove_var("MEDOC_CLUSTER_DEVICE_SECRET");
}

#[tokio::test]
async fn staff_directory_and_lan_token_after_sas() {
    std::env::set_var(
        "MEDOC_CLUSTER_DEVICE_SECRET",
        "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
    );
    std::env::set_var(
        "MEDOC_PAIRING_MASTER_SECRET",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );

    let admin_pool = fresh_pool().await;
    save_admin_license(&admin_pool).await;

    let addr: IpAddr = "127.0.0.1".parse().unwrap();
    let listener = bind_cluster_listener(addr, 0).await.expect("bind");
    let port = listener.local_addr().unwrap().port();
    let pool_clone = admin_pool.clone();
    tokio::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((stream, _)) => spawn_cluster_connection_handler(stream, pool_clone.clone()),
                Err(_) => break,
            }
        }
    });

    let identity = DeviceIdentity::load_or_create().expect("identity");
    let outcome = join_admin_endpoint("127.0.0.1", port, &identity, SeatRole::Member)
        .await
        .expect("join");
    let digits = derive_sas_from_transcript(&outcome.handshake_transcript);
    let lan = confirm_sas_on_admin("127.0.0.1", port, &outcome.session_id, &digits)
        .await
        .expect("sas");
    assert!(
        lan.activation_token
            .as_deref()
            .unwrap_or("")
            .starts_with("mt2."),
        "SAS confirm must return a master activation token"
    );

    let json = fetch_staff_directory("127.0.0.1", port, &identity, &outcome.session_id)
        .await
        .expect("staff directory after SAS");
    assert!(
        json.contains("staff") || json.contains('{'),
        "owner must return a staff directory payload, got {json}"
    );

    std::env::remove_var("MEDOC_CLUSTER_DEVICE_SECRET");
    std::env::remove_var("MEDOC_PAIRING_MASTER_SECRET");
}
