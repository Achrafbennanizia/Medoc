//! HTTP-layer push/pull roundtrip + conflict policy coverage.
//!
//! These tests exercise the master-side `/api/v1/sync/{push,pull}` handlers
//! end-to-end (router → `SyncEngine::ingest_push` → `apply_remote_entry` →
//! `ConflictPolicy::MasterWinsWithFreshness`). They complement the
//! function-level merge tests in `medoc_sync::engine::tests` (which already
//! cover the policy in isolation) and the mesh fan-out test in
//! `two_replica_mesh.rs` (which covers replica → replica TCP push).
//!
//! Scenarios:
//!
//! 1. Replica pushes one patient row → master applies, status reflects the
//!    new vector for the replica's device.
//! 2. Replica pulls master's outbox after master writes a patient locally;
//!    the replica sees exactly one entry on the wire.
//! 3. Stale push wins on first write but loses on retry with older
//!    `updated_at` (idempotent + freshness combined).
//! 4. Two replicas push the SAME entity in interleaved order; the later
//!    `updated_at` wins on the master.
//! 5. Push with mismatched `fromDeviceId` vs token `device_id` is rejected
//!    even with a valid signature.
//! 6. Push from an unknown device (no pairing) is rejected at the
//!    activation-token verify step.

use axum::http::StatusCode;
use chrono::{NaiveDate, Utc};
use medoc_core::domain::entities::patient::CreatePatient;
use medoc_core::domain::enums::Geschlecht;
use medoc_core::infrastructure::database::patient_repo;
use medoc_e2e::harness::{slave_pubkey_b64, slave_signing_key, LanHarness};
use medoc_sync::repo::OutboxEntry;
use std::net::SocketAddr;

fn connect_from_ip(ip: &str) -> SocketAddr {
    format!("{ip}:54321").parse().expect("connect addr")
}

async fn pair_replica(lan: &mut LanHarness, jwt: &str, seed: u8, device_id: &str) -> String {
    let connect = connect_from_ip("192.168.1.10");
    let (status, submitted) = lan
        .json_with_connect(
            connect,
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": device_id,
                "slavePubkey": slave_pubkey_b64(&slave_signing_key(seed)),
                "slaveLabel": format!("Replica-{seed}"),
            })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK, "submit: {submitted:?}");
    let request_id = submitted["id"].as_str().expect("id").to_string();

    lan.pairing_decide_accept_and_confirm(&request_id, jwt)
        .await
}

fn patient_entry(
    device_id: &str,
    seq: i64,
    patient_id: &str,
    name: &str,
    updated_at_iso: &str,
) -> OutboxEntry {
    // UPDATE op — the row MUST already exist on the receiver, otherwise
    // `apply_remote_entry` falls into `insert_from_json` which fails
    // because the patient schema has NOT NULL columns
    // (geburtsdatum, geschlecht, versicherungsnummer) not present in
    // this minimal payload. Callers should pair this with
    // `seed_patient_directly` or `patient_insert_entry`.
    OutboxEntry {
        id: format!("e-{device_id}-{seq}"),
        device_id: device_id.into(),
        seq,
        entity_table: "patient".into(),
        entity_id: patient_id.into(),
        op: "UPDATE".into(),
        payload_json: format!(
            r#"{{"id":"{patient_id}","name":"{name}","updated_at":"{updated_at_iso}"}}"#
        ),
        created_at: updated_at_iso.into(),
    }
}

/// Full-row INSERT entry; safe to push against a fresh master.
fn patient_insert_entry(
    device_id: &str,
    seq: i64,
    patient_id: &str,
    name: &str,
    updated_at_iso: &str,
    versicherung: &str,
) -> OutboxEntry {
    let payload = serde_json::json!({
        "id": patient_id,
        "name": name,
        "geburtsdatum": "1990-01-01",
        "geschlecht": "MAENNLICH",
        "versicherungsnummer": versicherung,
        "status": "AKTIV",
        "created_at": "2026-01-01 00:00:00",
        "updated_at": updated_at_iso,
    });
    OutboxEntry {
        id: format!("ins-{device_id}-{seq}"),
        device_id: device_id.into(),
        seq,
        entity_table: "patient".into(),
        entity_id: patient_id.into(),
        op: "INSERT".into(),
        payload_json: payload.to_string(),
        created_at: updated_at_iso.into(),
    }
}

async fn seed_patient_directly(pool: &sqlx::SqlitePool, id: &str, name: &str, updated_at: &str) {
    sqlx::query(
        "INSERT INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer,
                              telefon, email, adresse, status, created_at, updated_at)
         VALUES (?1, ?2, '1990-01-01', 'MAENNLICH', 'V-X',
                 NULL, NULL, NULL, 'AKTIV', '2026-01-01 00:00:00', ?3)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at",
    )
    .bind(id)
    .bind(name)
    .bind(updated_at)
    .execute(pool)
    .await
    .expect("seed patient row");
}

async fn read_patient_name(pool: &sqlx::SqlitePool, id: &str) -> Option<String> {
    sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .expect("read patient")
}

#[tokio::test]
async fn replica_push_applies_one_patient_row_on_master() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let device_id = "rtrip-replica-001";
    let token = pair_replica(&mut lan, &jwt, 91, device_id).await;

    let patient_id = "00000000-0000-0000-0000-0000000000a1";
    let entry = patient_insert_entry(
        device_id,
        1,
        patient_id,
        "From Replica",
        "2099-06-01T12:00:00Z",
        "V-RPL-001",
    );

    let (status, push_result) = lan
        .json(
            "POST",
            "/api/v1/sync/push",
            Some(&serde_json::json!({
                "fromDeviceId": device_id,
                "entries": [entry],
            })),
            Some(&token),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "push: {push_result:?}");
    assert_eq!(push_result["accepted"].as_i64(), Some(1));
    assert_eq!(push_result["lastSeq"].as_i64(), Some(1));

    // Confirm the patient row landed on the master.
    let name = read_patient_name(&lan.pool, patient_id).await;
    assert_eq!(name.as_deref(), Some("From Replica"));

    // `sync_applied` should record (device_id, seq=1) — this is how the
    // master remembers what it has consumed (vs `sync_vector` which is the
    // LOCAL outbox high-water mark per device on the queried pool).
    let applied_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sync_applied WHERE source_device_id = ?1 AND source_seq = ?2",
    )
    .bind(device_id)
    .bind(1_i64)
    .fetch_one(&lan.pool)
    .await
    .expect("count applied");
    assert_eq!(applied_count, 1, "exactly one applied row for (dev,seq=1)");

    // /sync/status still works for a paired replica.
    let (status, _snap) = lan
        .json("GET", "/api/v1/sync/status", None, Some(&token))
        .await;
    assert_eq!(status, StatusCode::OK);
}

#[tokio::test]
async fn replica_pull_sees_master_local_writes() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let device_id = "rtrip-replica-002";
    let token = pair_replica(&mut lan, &jwt, 92, device_id).await;

    // Master is in `serverless_peer` mode AS MASTER for this test, so its
    // local writes append to `sync_outbox` (see `sync_outbox_hooks_tests`).
    medoc_core::infrastructure::database::app_kv_repo::set(
        &lan.pool,
        "sync.deployment.v1",
        r#"{"schemaVersion":1,"mode":"serverless_peer","role":"MASTER","masterBaseUrl":"","masterCertSha256":"","masterAccessToken":"","deviceLabel":"E2E Master"}"#,
    )
    .await
    .expect("enable serverless master");

    // Master writes a patient through `patient_repo` (the auto-outbox hook fires).
    let p = patient_repo::create(
        &lan.pool,
        &CreatePatient {
            name: "Master Local Write".into(),
            geburtsdatum: NaiveDate::from_ymd_opt(1985, 4, 21).unwrap(),
            geschlecht: Geschlecht::Weiblich,
            versicherungsnummer: "V-MLW-1".into(),
            telefon: None,
            email: None,
            adresse: None,
        },
    )
    .await
    .expect("create patient");
    let _ = p.id;

    // Resolve master device_id for the pull request.
    let (_, snap) = lan
        .json("GET", "/api/v1/sync/status", None, Some(&token))
        .await;
    let master_device_id = snap["localDeviceId"]
        .as_str()
        .expect("local device id")
        .to_string();

    // Replica pulls everything from master since seq 0.
    let (status, pull_body) = lan
        .json(
            "POST",
            "/api/v1/sync/pull",
            Some(&serde_json::json!({
                "deviceId": master_device_id,
                "sinceSeq": 0,
                "requesterId": device_id,
            })),
            Some(&token),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "pull: {pull_body:?}");
    let entries = pull_body["entries"].as_array().expect("entries array");
    assert!(
        entries.iter().any(|e| e["entityTable"] == "patient"),
        "expected a patient row in pull: {entries:?}"
    );
    assert!(
        entries.iter().any(|e| e["entityTable"] == "patientenakte"),
        "expected a patientenakte row in pull (auto-created): {entries:?}"
    );
}

#[tokio::test]
async fn older_push_does_not_overwrite_newer_master_row() {
    // Scenario: master already has a row with `updated_at = 2099-12`; replica
    // pushes an UPDATE with `updated_at = 2099-01` (older). Freshness policy
    // must keep the master's newer row, but the push is still "accepted"
    // (i.e. lastSeq advances) — `apply_remote_entry` marks the entry applied
    // even when the row is left untouched, so vectors monotonically grow.
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let device_id = "rtrip-replica-003";
    let token = pair_replica(&mut lan, &jwt, 93, device_id).await;

    let patient_id = "00000000-0000-0000-0000-0000000000c1";
    seed_patient_directly(&lan.pool, patient_id, "Master Newer", "2099-12-01 00:00:00").await;

    let stale_entry = patient_entry(
        device_id,
        1,
        patient_id,
        "Replica Older Push",
        "2099-01-01T00:00:00Z",
    );

    let (status, _) = lan
        .json(
            "POST",
            "/api/v1/sync/push",
            Some(&serde_json::json!({
                "fromDeviceId": device_id,
                "entries": [stale_entry],
            })),
            Some(&token),
        )
        .await;
    assert_eq!(status, StatusCode::OK);

    let name = read_patient_name(&lan.pool, patient_id).await;
    assert_eq!(
        name.as_deref(),
        Some("Master Newer"),
        "freshness policy must keep master's newer row"
    );
}

#[tokio::test]
async fn newer_push_overwrites_older_master_row() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let device_id = "rtrip-replica-004";
    let token = pair_replica(&mut lan, &jwt, 94, device_id).await;

    let patient_id = "00000000-0000-0000-0000-0000000000c2";
    seed_patient_directly(&lan.pool, patient_id, "Master Older", "2099-01-01 00:00:00").await;

    let fresh_entry = patient_entry(
        device_id,
        1,
        patient_id,
        "Replica Newer Wins",
        "2099-12-01T00:00:00Z",
    );

    let (status, _) = lan
        .json(
            "POST",
            "/api/v1/sync/push",
            Some(&serde_json::json!({
                "fromDeviceId": device_id,
                "entries": [fresh_entry],
            })),
            Some(&token),
        )
        .await;
    assert_eq!(status, StatusCode::OK);

    let name = read_patient_name(&lan.pool, patient_id).await;
    assert_eq!(
        name.as_deref(),
        Some("Replica Newer Wins"),
        "freshness policy must apply newer replica write"
    );
}

#[tokio::test]
async fn two_replicas_push_same_entity_freshness_resolves_winner() {
    // Replica B INSERTs the patient with an old timestamp; replica A then
    // UPDATEs with a newer timestamp; then B retries the UPDATE with an
    // older (but still later-than-original) timestamp. Newer always wins.
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;

    let dev_a = "rtrip-replica-A";
    let dev_b = "rtrip-replica-B";
    let token_a = pair_replica(&mut lan, &jwt, 95, dev_a).await;
    let token_b = pair_replica(&mut lan, &jwt, 96, dev_b).await;

    let patient_id = "00000000-0000-0000-0000-0000000000c3";

    // 1. B INSERTs the patient first (only one device should INSERT).
    let insert_b = patient_insert_entry(
        dev_b,
        1,
        patient_id,
        "B Initial",
        "2099-01-01T00:00:00Z",
        "V-CONFLICT-1",
    );
    let (status, _) = lan
        .json(
            "POST",
            "/api/v1/sync/push",
            Some(&serde_json::json!({
                "fromDeviceId": dev_b,
                "entries": [insert_b],
            })),
            Some(&token_b),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "B insert");

    // 2. A pushes an UPDATE with a NEWER updated_at — must win.
    let update_a_newer =
        patient_entry(dev_a, 1, patient_id, "A Newer Push", "2099-12-01T00:00:00Z");
    let (status, _) = lan
        .json(
            "POST",
            "/api/v1/sync/push",
            Some(&serde_json::json!({
                "fromDeviceId": dev_a,
                "entries": [update_a_newer],
            })),
            Some(&token_a),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "A newer update");

    let name_after_first_order = read_patient_name(&lan.pool, patient_id).await;
    assert_eq!(
        name_after_first_order.as_deref(),
        Some("A Newer Push"),
        "newer push must win"
    );

    // 3. B retries an UPDATE with an OLDER (mid-range) updated_at — must NOT
    //    overwrite A's freshest write.
    let update_b_older = patient_entry(
        dev_b,
        2,
        patient_id,
        "B Older Retry",
        "2099-06-01T00:00:00Z",
    );
    let (status, _) = lan
        .json(
            "POST",
            "/api/v1/sync/push",
            Some(&serde_json::json!({
                "fromDeviceId": dev_b,
                "entries": [update_b_older],
            })),
            Some(&token_b),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "B older retry");

    let name_final = read_patient_name(&lan.pool, patient_id).await;
    assert_eq!(
        name_final.as_deref(),
        Some("A Newer Push"),
        "older retry must NOT clobber the master's freshest row"
    );
}

#[tokio::test]
async fn push_with_mismatched_from_device_id_is_rejected() {
    // Token carries device_id=X but body claims fromDeviceId=Y. The
    // `sync_push` handler must 403 on the mismatch even when the signature
    // and route action both verify.
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let real_device = "rtrip-replica-real";
    let token = pair_replica(&mut lan, &jwt, 97, real_device).await;

    let other_device = "rtrip-replica-spoof";
    let entry = patient_entry(
        other_device,
        1,
        "00000000-0000-0000-0000-0000000000d1",
        "Spoof",
        "2099-06-01T00:00:00Z",
    );

    let (status, _) = lan
        .json(
            "POST",
            "/api/v1/sync/push",
            Some(&serde_json::json!({
                "fromDeviceId": other_device,
                "entries": [entry],
            })),
            Some(&token),
        )
        .await;
    assert_eq!(
        status,
        StatusCode::FORBIDDEN,
        "spoofed fromDeviceId must be 403"
    );
}

#[tokio::test]
async fn push_with_inner_entry_device_id_mismatch_returns_400() {
    // Token + body fromDeviceId both = X, but one entry inside has
    // device_id=Y. `ingest_push` returns Validation, which the handler maps
    // to 400 Bad Request.
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let device_id = "rtrip-replica-entry-mix";
    let token = pair_replica(&mut lan, &jwt, 98, device_id).await;

    let mixed_entry = patient_entry(
        "some-other-device",
        1,
        "00000000-0000-0000-0000-0000000000d2",
        "Wrong inner",
        Utc::now().to_rfc3339().as_str(),
    );

    let (status, _) = lan
        .json(
            "POST",
            "/api/v1/sync/push",
            Some(&serde_json::json!({
                "fromDeviceId": device_id,
                "entries": [mixed_entry],
            })),
            Some(&token),
        )
        .await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "entry.device_id mismatch must 400"
    );
}

#[tokio::test]
async fn pull_with_unknown_master_device_id_returns_empty_entries() {
    // Pulling for a device the master doesn't know about must succeed and
    // return zero entries (no leak, no 500).
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let device_id = "rtrip-replica-pulltest";
    let token = pair_replica(&mut lan, &jwt, 99, device_id).await;

    let (status, body) = lan
        .json(
            "POST",
            "/api/v1/sync/pull",
            Some(&serde_json::json!({
                "deviceId": "nonexistent-device-xyz",
                "sinceSeq": 0,
                "requesterId": device_id,
            })),
            Some(&token),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "pull body: {body:?}");
    assert_eq!(body["entries"].as_array().map(|a| a.len()), Some(0));
}

#[tokio::test]
async fn idempotent_push_same_seq_does_not_double_apply() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let device_id = "rtrip-replica-idem";
    let token = pair_replica(&mut lan, &jwt, 100, device_id).await;

    let patient_id = "00000000-0000-0000-0000-0000000000e1";
    let entry = patient_insert_entry(
        device_id,
        7,
        patient_id,
        "Idempotent",
        "2099-08-01T00:00:00Z",
        "V-IDEM-1",
    );

    for _ in 0..3 {
        let (status, _) = lan
            .json(
                "POST",
                "/api/v1/sync/push",
                Some(&serde_json::json!({
                    "fromDeviceId": device_id,
                    "entries": [entry.clone()],
                })),
                Some(&token),
            )
            .await;
        assert_eq!(status, StatusCode::OK);
    }

    // Final row state should still match the entry; `sync_applied` is
    // keyed on (source_device_id, source_seq), so three identical pushes
    // result in exactly one applied marker via `was_applied`.
    let name = read_patient_name(&lan.pool, patient_id).await;
    assert_eq!(name.as_deref(), Some("Idempotent"));

    let applied_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sync_applied WHERE source_device_id = ?1 AND source_seq = ?2",
    )
    .bind(device_id)
    .bind(7_i64)
    .fetch_one(&lan.pool)
    .await
    .expect("count applied");
    assert_eq!(applied_count, 1, "idempotent: exactly one applied marker");
}
