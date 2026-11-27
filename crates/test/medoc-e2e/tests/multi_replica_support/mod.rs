//! Pairing, entry builders and row readers of the multi-replica tests (split from `multi_replica_roundtrip.rs`).

use super::*;

pub(super) fn connect_from_ip(ip: &str) -> SocketAddr {
    format!("{ip}:54321").parse().expect("connect addr")
}

pub(super) async fn pair_replica(
    lan: &mut LanHarness,
    jwt: &str,
    seed: u8,
    device_id: &str,
) -> String {
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

pub(super) fn patient_entry(
    device_id: &str,
    seq: i64,
    patient_id: &str,
    name: &str,
    updated_at_iso: &str,
) -> OutboxEntry {
    // UPDATE op — the row MUST already exist on the receiver, otherwise
    // `apply_remote_entry` falls into `insert_from_json` which fails
    // because the patient schema has NOT NULL columns
    // (date_of_birth, sex, insurance_number) not present in
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
pub(super) fn patient_insert_entry(
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
        "date_of_birth": "1990-01-01",
        "sex": "MALE",
        "insurance_number": versicherung,
        "status": "ACTIVE",
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

pub(super) async fn seed_patient_directly(
    pool: &sqlx::SqlitePool,
    id: &str,
    name: &str,
    updated_at: &str,
) {
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number,
                              phone, email, address, status, created_at, updated_at)
         VALUES (?1, ?2, '1990-01-01', 'MALE', 'V-X',
                 NULL, NULL, NULL, 'ACTIVE', '2026-01-01 00:00:00', ?3)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at",
    )
    .bind(id)
    .bind(name)
    .bind(updated_at)
    .execute(pool)
    .await
    .expect("seed patient row");
}

pub(super) async fn read_patient_name(pool: &sqlx::SqlitePool, id: &str) -> Option<String> {
    sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .expect("read patient")
}
