use base64::{
    engine::general_purpose::{STANDARD, STANDARD_NO_PAD},
    Engine,
};
use ed25519_dalek::SigningKey;
use medoc_core::error::AppError;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use rand::rngs::OsRng;
use sqlx::SqlitePool;

use super::policy::slave_actions;
use super::store::{confirm_pin, decide, load_by_device, revoke, submit_request};
use super::token::verify_activation_token;
use super::types::{
    PairingDecision, PairingRequest, PairingRequestSubmit, ACTIVATION_TOKEN_PREFIX,
    DEFAULT_REPLICA_HTTP_PORT,
};
use crate::master_keys;

async fn fresh_pool() -> SqlitePool {
    std::env::set_var(
        "MEDOC_PAIRING_MASTER_SECRET",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    crate::schema::ensure_sync_tables(&pool)
        .await
        .expect("schema");
    pool
}

async fn accept_with_pin(
    pool: &SqlitePool,
    master_id: &str,
    request_id: &str,
    allowed_actions: Vec<String>,
    decided_by: &str,
) -> PairingRequest {
    let decided = decide(
        pool,
        master_id,
        request_id,
        PairingDecision {
            accept: true,
            allowed_actions,
            decided_by: decided_by.into(),
        },
        DEFAULT_REPLICA_HTTP_PORT,
    )
    .await
    .expect("decide ok");
    assert!(decided.confirm_pin.is_some());
    assert!(decided.request.awaiting_pin);
    let pin = decided.confirm_pin.expect("pin");
    confirm_pin(pool, master_id, request_id, &pin, DEFAULT_REPLICA_HTTP_PORT)
        .await
        .expect("confirm ok")
}

#[tokio::test]
async fn submit_then_accept_round_trip_issues_token() {
    let pool = fresh_pool().await;
    let slave_sk = SigningKey::generate(&mut OsRng);
    let slave_pubkey_b64 = STANDARD_NO_PAD.encode(slave_sk.verifying_key().to_bytes());

    let req = submit_request(
        &pool,
        PairingRequestSubmit {
            device_id: "slave-1".into(),
            slave_pubkey: slave_pubkey_b64,
            slave_label: "Empfang iPad".into(),
            requester_ip: "192.168.1.20".into(),
            transport: "lan".into(),
        },
    )
    .await
    .expect("submit ok");
    assert_eq!(req.status, "PENDING");
    assert!(req.activation_token.is_none());

    let decided = accept_with_pin(
        &pool,
        "master-1",
        &req.id,
        vec!["sync.push".into(), "sync.pull".into()],
        "admin@practice",
    )
    .await;
    assert_eq!(decided.status, "ACCEPTED");
    let token = decided.activation_token.expect("token attached");
    assert!(token.starts_with(ACTIVATION_TOKEN_PREFIX));

    let master_sk = master_keys::load_or_create().expect("master key");
    let payload = verify_activation_token(&token, &master_sk.verifying_key()).expect("verify");
    assert_eq!(payload.device_id, "slave-1");
    assert_eq!(payload.master_device_id, "master-1");
    assert_eq!(
        payload.allowed_actions,
        vec!["sync.pull".to_string(), "sync.push".to_string()]
    );

    let actions = slave_actions(&pool, "slave-1").await.unwrap();
    assert_eq!(
        actions,
        vec!["sync.pull".to_string(), "sync.push".to_string()]
    );

    let peer_url: Option<String> =
        sqlx::query_scalar("SELECT peer_base_url FROM sync_device WHERE device_id = ?1")
            .bind("slave-1")
            .fetch_one(&pool)
            .await
            .expect("sync_device row");
    assert_eq!(peer_url.as_deref(), Some("https://192.168.1.20:8787"));
}

#[tokio::test]
async fn wrong_pin_rejected_before_accept() {
    let pool = fresh_pool().await;
    let req = submit_request(
        &pool,
        PairingRequestSubmit {
            device_id: "slave-pin".into(),
            slave_pubkey: "AAAA".into(),
            slave_label: "Test".into(),
            requester_ip: "10.0.0.1".into(),
            transport: "lan".into(),
        },
    )
    .await
    .unwrap();
    let decided = decide(
        &pool,
        "master-1",
        &req.id,
        PairingDecision {
            accept: true,
            allowed_actions: vec!["sync.push".into()],
            decided_by: "admin".into(),
        },
        DEFAULT_REPLICA_HTTP_PORT,
    )
    .await
    .unwrap();
    assert!(decided.confirm_pin.is_some());

    let err = confirm_pin(
        &pool,
        "master-1",
        &req.id,
        "0000",
        DEFAULT_REPLICA_HTTP_PORT,
    )
    .await
    .expect_err("wrong pin");
    assert!(
        matches!(err, AppError::ValidationCode(_)),
        "expected ValidationCode for wrong PIN, got {err:?}"
    );

    let still = load_by_device(&pool, "slave-pin").await.unwrap().unwrap();
    assert_eq!(still.status, "PENDING");
    assert!(still.awaiting_pin);
}

#[tokio::test]
async fn second_submit_replaces_pending_row() {
    let pool = fresh_pool().await;
    let req1 = submit_request(
        &pool,
        PairingRequestSubmit {
            device_id: "slave-2".into(),
            slave_pubkey: "AAAA".into(),
            slave_label: "Lab".into(),
            requester_ip: "10.0.0.5".into(),
            transport: "lan".into(),
        },
    )
    .await
    .unwrap();
    let req2 = submit_request(
        &pool,
        PairingRequestSubmit {
            device_id: "slave-2".into(),
            slave_pubkey: "AAAA".into(),
            slave_label: "Lab (renamed)".into(),
            requester_ip: "10.0.0.5".into(),
            transport: "lan".into(),
        },
    )
    .await
    .unwrap();
    assert_eq!(req1.id, req2.id, "same row reused for same device_id");
    assert_eq!(req2.slave_label, "Lab (renamed)");
    assert_eq!(req2.status, "PENDING");

    // Another key for the same (public) device_id must not take over the
    // open request.
    let hijack = submit_request(
        &pool,
        PairingRequestSubmit {
            device_id: "slave-2".into(),
            slave_pubkey: "BBBB".into(),
            slave_label: "Attacker".into(),
            requester_ip: "10.0.0.66".into(),
            transport: "lan".into(),
        },
    )
    .await;
    assert!(matches!(hijack, Err(AppError::Conflict(_))));
    let still = load_by_device(&pool, "slave-2").await.unwrap().unwrap();
    assert_eq!(still.slave_pubkey, "AAAA");
}

#[tokio::test]
async fn reject_keeps_no_token_and_no_permissions() {
    let pool = fresh_pool().await;
    let req = submit_request(
        &pool,
        PairingRequestSubmit {
            device_id: "slave-3".into(),
            slave_pubkey: "CCCC".into(),
            slave_label: "Test".into(),
            requester_ip: "1.2.3.4".into(),
            transport: "lan".into(),
        },
    )
    .await
    .unwrap();
    let decided = decide(
        &pool,
        "master-1",
        &req.id,
        PairingDecision {
            accept: false,
            allowed_actions: vec![],
            decided_by: "admin".into(),
        },
        DEFAULT_REPLICA_HTTP_PORT,
    )
    .await
    .unwrap();
    assert_eq!(decided.request.status, "REJECTED");
    assert!(decided.request.activation_token.is_none());
    assert!(slave_actions(&pool, "slave-3").await.unwrap().is_empty());
}

#[tokio::test]
async fn revoke_clears_permissions_and_marks_revoked() {
    let pool = fresh_pool().await;
    let req = submit_request(
        &pool,
        PairingRequestSubmit {
            device_id: "slave-4".into(),
            slave_pubkey: "DDDD".into(),
            slave_label: "Tablet".into(),
            requester_ip: "1.1.1.1".into(),
            transport: "lan".into(),
        },
    )
    .await
    .unwrap();
    accept_with_pin(&pool, "m", &req.id, vec!["sync.push".into()], "admin").await;
    revoke(&pool, "m", "slave-4", "admin").await.unwrap();
    let after = load_by_device(&pool, "slave-4").await.unwrap().unwrap();
    assert_eq!(after.status, "REVOKED");
    assert!(after.activation_token.is_none());
    assert!(slave_actions(&pool, "slave-4").await.unwrap().is_empty());
    let seat: String =
        sqlx::query_scalar("SELECT device_status FROM sync_device WHERE device_id = 'slave-4'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(seat, "REVOKED");
    assert!(revoke(&pool, "m", "slave-4", "admin").await.is_err());
}

#[tokio::test]
async fn verify_token_rejects_wrong_master_pubkey() {
    let pool = fresh_pool().await;
    let req = submit_request(
        &pool,
        PairingRequestSubmit {
            device_id: "slave-5".into(),
            slave_pubkey: "EEEE".into(),
            slave_label: "X".into(),
            requester_ip: "".into(),
            transport: "lan".into(),
        },
    )
    .await
    .unwrap();
    let decided = accept_with_pin(&pool, "m", &req.id, vec!["sync.push".into()], "a").await;
    let other = SigningKey::generate(&mut OsRng).verifying_key();
    let err = verify_activation_token(decided.activation_token.as_ref().unwrap(), &other)
        .expect_err("must fail for wrong pubkey");
    assert!(matches!(err, AppError::Validation(_)));
}

#[tokio::test]
async fn accept_pin_matches_handshake_transcript_sas() {
    use crate::cluster::crypto::derive_sas_from_transcript;
    use base64::{engine::general_purpose::STANDARD, Engine};

    let pool = fresh_pool().await;
    let transcript = b"noise-xx-handshake-transcript-bytes";
    let expected = derive_sas_from_transcript(transcript);
    let req = submit_request(
        &pool,
        PairingRequestSubmit {
            device_id: "slave-sas".into(),
            slave_pubkey: "AAAA".into(),
            slave_label: "Replica".into(),
            requester_ip: "192.168.1.30".into(),
            transport: "lan".into(),
        },
    )
    .await
    .expect("submit");
    sqlx::query("UPDATE pairing_request SET handshake_transcript_b64 = ?1 WHERE id = ?2")
        .bind(STANDARD.encode(transcript))
        .bind(&req.id)
        .execute(&pool)
        .await
        .expect("store transcript");

    let decided = decide(
        &pool,
        "master-1",
        &req.id,
        PairingDecision {
            accept: true,
            allowed_actions: vec!["sync.push".into()],
            decided_by: "admin".into(),
        },
        DEFAULT_REPLICA_HTTP_PORT,
    )
    .await
    .expect("decide");
    assert_eq!(decided.confirm_pin.as_deref(), Some(expected.as_str()));
}

#[tokio::test]
async fn accept_pin_matches_url_safe_handshake_b64() {
    use crate::cluster::crypto::derive_sas_from_transcript;
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};

    let pool = fresh_pool().await;
    let transcript = b"noise-xx-url-safe-transcript-bytes!!";
    let expected = derive_sas_from_transcript(transcript);
    let req = submit_request(
        &pool,
        PairingRequestSubmit {
            device_id: "slave-sas-b64".into(),
            slave_pubkey: "AAAA".into(),
            slave_label: "Replica".into(),
            requester_ip: "192.168.1.30".into(),
            transport: "lan".into(),
        },
    )
    .await
    .expect("submit");
    sqlx::query("UPDATE pairing_request SET handshake_transcript_b64 = ?1 WHERE id = ?2")
        .bind(URL_SAFE_NO_PAD.encode(transcript))
        .bind(&req.id)
        .execute(&pool)
        .await
        .expect("store transcript");

    let decided = decide(
        &pool,
        "master-1",
        &req.id,
        PairingDecision {
            accept: true,
            allowed_actions: vec!["sync.push".into()],
            decided_by: "admin".into(),
        },
        DEFAULT_REPLICA_HTTP_PORT,
    )
    .await
    .expect("decide");
    assert_eq!(decided.confirm_pin.as_deref(), Some(expected.as_str()));
}

#[tokio::test]
async fn public_view_drops_the_activation_token() {
    let pool = fresh_pool().await;
    let req = submit_request(
        &pool,
        PairingRequestSubmit {
            device_id: "slave-public".into(),
            slave_pubkey: "cHVi".into(),
            slave_label: "Front".into(),
            requester_ip: "10.0.0.8".into(),
            transport: "lan".into(),
        },
    )
    .await
    .expect("submit");
    sqlx::query(
        "UPDATE pairing_request SET status = 'ACCEPTED', activation_token = 'mt2.secret' WHERE id = ?1",
    )
    .bind(&req.id)
    .execute(&pool)
    .await
    .unwrap();
    let stored = super::load_by_id(&pool, &req.id)
        .await
        .unwrap()
        .expect("row");
    assert_eq!(stored.activation_token.as_deref(), Some("mt2.secret"));
    assert!(stored.redact_public_token().activation_token.is_none());
}

#[tokio::test]
async fn revoked_device_is_not_reminted() {
    let pool = fresh_pool().await;
    let req = submit_request(
        &pool,
        PairingRequestSubmit {
            device_id: "fp-revoked".into(),
            slave_pubkey: "cHVi".into(),
            slave_label: "Front".into(),
            requester_ip: "10.0.0.9".into(),
            transport: "lan".into(),
        },
    )
    .await
    .expect("submit");
    sqlx::query(
        "UPDATE pairing_request SET status = 'ACCEPTED', activation_token = 'mt2.live' WHERE id = ?1",
    )
    .bind(&req.id)
    .execute(&pool)
    .await
    .unwrap();
    super::clear_device_activation(&pool, "fp-revoked")
        .await
        .expect("clear");
    let token: Option<String> =
        sqlx::query_scalar("SELECT activation_token FROM pairing_request WHERE id = ?1")
            .bind(&req.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(token.is_none());
    let err = crate::cluster::services::issue_replica_lan_auth(&pool, "fp-revoked", &req.id)
        .await
        .expect_err("revoked");
    assert!(matches!(err, AppError::Forbidden));
}

#[tokio::test]
async fn pending_pairing_is_not_minted() {
    let pool = fresh_pool().await;
    let req = submit_request(
        &pool,
        PairingRequestSubmit {
            device_id: "fp-pending".into(),
            slave_pubkey: "cHVi".into(),
            slave_label: "Front".into(),
            requester_ip: "10.0.0.10".into(),
            transport: "lan".into(),
        },
    )
    .await
    .expect("submit");
    let err = crate::cluster::services::issue_replica_lan_auth(&pool, "fp-pending", &req.id)
        .await
        .expect_err("pending");
    assert!(matches!(err, AppError::Forbidden));
    let token: Option<String> =
        sqlx::query_scalar("SELECT activation_token FROM pairing_request WHERE id = ?1")
            .bind(&req.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(token.is_none());
}

#[tokio::test]
async fn foreign_fingerprint_does_not_match_the_noise_key() {
    let previous = std::env::var("MEDOC_CLUSTER_DEVICE_SECRET").ok();
    std::env::set_var(
        "MEDOC_CLUSTER_DEVICE_SECRET",
        "1111111111111111111111111111111111111111111111111111111111111111",
    );
    let identity = crate::cluster::crypto::DeviceIdentity::load_or_create().expect("identity");
    match previous {
        Some(value) => std::env::set_var("MEDOC_CLUSTER_DEVICE_SECRET", value),
        None => std::env::remove_var("MEDOC_CLUSTER_DEVICE_SECRET"),
    }
    let pool = fresh_pool().await;
    let req = submit_request(
        &pool,
        PairingRequestSubmit {
            device_id: "desk-1".into(),
            slave_pubkey: STANDARD.encode(identity.pubkey_bytes),
            slave_label: "Front".into(),
            requester_ip: "10.0.0.11".into(),
            transport: "lan".into(),
        },
    )
    .await
    .expect("submit");
    sqlx::query("UPDATE pairing_request SET status = 'ACCEPTED', fingerprint = ?1 WHERE id = ?2")
        .bind(&identity.fingerprint)
        .bind(&req.id)
        .execute(&pool)
        .await
        .unwrap();

    let foreign = crate::cluster::services::issue_replica_lan_auth(&pool, "desk-1", &req.id)
        .await
        .expect_err("foreign fingerprint");
    assert!(matches!(foreign, AppError::Forbidden));
    let token: Option<String> =
        sqlx::query_scalar("SELECT activation_token FROM pairing_request WHERE id = ?1")
            .bind(&req.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(token.is_none());
}
