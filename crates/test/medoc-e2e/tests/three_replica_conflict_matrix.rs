//! Three-replica freshness conflict matrix over real LAN HTTP.

use axum::http::StatusCode;
use medoc_e2e::harness::{slave_pubkey_b64, slave_signing_key, LanHarness};

async fn pair_replica(lan: &mut LanHarness, jwt: &str, seed: u8, device_id: &str) -> String {
    let (status, submitted) = lan
        .json(
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": device_id,
                "slavePubkey": slave_pubkey_b64(&slave_signing_key(seed)),
                "slaveLabel": device_id,
            })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::OK);
    let request_id = submitted["id"].as_str().unwrap();
    lan.pairing_decide_accept_and_confirm(request_id, jwt).await
}

fn patient_entry(
    device_id: &str,
    seq: i64,
    patient_id: &str,
    name: &str,
    updated_at: &str,
) -> serde_json::Value {
    serde_json::json!({
        "id": format!("out-{device_id}-{seq}"),
        "deviceId": device_id,
        "seq": seq,
        "entityTable": "patient",
        "entityId": patient_id,
        "op": "INSERT",
        "payloadJson": serde_json::json!({
            "id": patient_id,
            "name": name,
            "geburtsdatum": "1990-01-01",
            "geschlecht": "MAENNLICH",
            "versicherungsnummer": format!("V-{patient_id}"),
            "updated_at": updated_at,
        }).to_string(),
        "createdAt": updated_at,
    })
}

#[tokio::test]
async fn three_replicas_competing_freshness_last_newer_wins_on_master() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let patient_id = "conflict-pat-3way";

    let token_a = pair_replica(&mut lan, &jwt, 51, "matrix-replica-a").await;
    let token_b = pair_replica(&mut lan, &jwt, 52, "matrix-replica-b").await;
    let token_c = pair_replica(&mut lan, &jwt, 53, "matrix-replica-c").await;

    let entry_old = patient_entry(
        "matrix-replica-a",
        1,
        patient_id,
        "Older Name",
        "2026-01-01T10:00:00Z",
    );
    let entry_mid = patient_entry(
        "matrix-replica-b",
        1,
        patient_id,
        "Middle Name",
        "2026-06-01T12:00:00Z",
    );
    let entry_new = patient_entry(
        "matrix-replica-c",
        1,
        patient_id,
        "Newest Name",
        "2026-06-02T15:00:00Z",
    );

    for (token, device, entry) in [
        (&token_a, "matrix-replica-a", entry_old),
        (&token_b, "matrix-replica-b", entry_mid),
        (&token_c, "matrix-replica-c", entry_new),
    ] {
        let (status, push) = lan
            .json(
                "POST",
                "/api/v1/sync/push",
                Some(&serde_json::json!({
                    "fromDeviceId": device,
                    "entries": [entry],
                })),
                Some(token),
            )
            .await;
        assert_eq!(status, StatusCode::OK, "push from {device}: {push:?}");
    }

    let (status, patients) = lan.json("GET", "/api/v1/patienten", None, Some(&jwt)).await;
    assert_eq!(status, StatusCode::OK);
    let winner = patients
        .as_array()
        .expect("array")
        .iter()
        .find(|p| p["id"] == patient_id)
        .expect("patient on master");
    assert_eq!(winner["name"], "Newest Name");
}
