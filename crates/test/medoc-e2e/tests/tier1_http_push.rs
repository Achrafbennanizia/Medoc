//! Tier-1 table HTTP push acceptance (in-process LAN harness).

use axum::http::StatusCode;
use medoc_e2e::harness::{slave_pubkey_b64, slave_signing_key, LanHarness};
use medoc_e2e::port_client::{praxis_ticket_insert_entry, rezept_insert_entry};
use medoc_sync::repo::OutboxEntry;

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
    assert_eq!(status, StatusCode::OK, "submit: {submitted:?}");
    let request_id = submitted["id"].as_str().unwrap();

    lan.pairing_decide_accept_and_confirm(request_id, jwt).await
}

async fn push_one(lan: &mut LanHarness, token: &str, device_id: &str, entry: OutboxEntry) -> u64 {
    let (status, body) = lan
        .json(
            "POST",
            "/api/v1/sync/push",
            Some(&serde_json::json!({
                "fromDeviceId": device_id,
                "entries": [entry],
            })),
            Some(token),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "push: {body:?}");
    body["accepted"].as_u64().expect("accepted")
}

#[tokio::test]
async fn tier1_rezept_push_applies_on_master() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let device = "tier1-rezept";
    let token = pair_replica(&mut lan, &jwt, 51, device).await;
    let id = "tier1-rezept-001";
    let entry = rezept_insert_entry(
        device,
        1,
        id,
        "seed-pat-001",
        "seed-arzt-001",
        "Tier1 E2E Rezept",
        "2026-06-02T12:00:00Z",
    );
    assert_eq!(push_one(&mut lan, &token, device, entry).await, 1);
    let med: Option<String> = sqlx::query_scalar("SELECT medikament FROM rezept WHERE id = ?1")
        .bind(id)
        .fetch_optional(&lan.pool)
        .await
        .unwrap();
    assert_eq!(med.as_deref(), Some("Tier1 E2E Rezept"));
}

#[tokio::test]
async fn tier1_praxis_ticket_push_applies_on_master() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let device = "tier1-ticket";
    let token = pair_replica(&mut lan, &jwt, 52, device).await;
    let id = "tier1-ticket-001";
    let entry = praxis_ticket_insert_entry(
        device,
        1,
        id,
        "seed-pat-001",
        "seed-rez-001",
        "seed-arzt-001",
        "Tier1 ticket body",
        "2026-06-02T12:00:00Z",
    );
    assert_eq!(push_one(&mut lan, &token, device, entry).await, 1);
    let body: Option<String> = sqlx::query_scalar("SELECT body FROM praxis_ticket WHERE id = ?1")
        .bind(id)
        .fetch_optional(&lan.pool)
        .await
        .unwrap();
    assert_eq!(body.as_deref(), Some("Tier1 ticket body"));
}

#[tokio::test]
async fn tier1_attest_push_applies_on_master() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let device = "tier1-attest";
    let token = pair_replica(&mut lan, &jwt, 53, device).await;
    let id = "tier1-attest-001";
    let ts = "2026-06-02T12:00:00Z";
    let entry = OutboxEntry {
        id: format!("att-{device}-1"),
        device_id: device.into(),
        seq: 1,
        entity_table: "attest".into(),
        entity_id: id.into(),
        op: "INSERT".into(),
        payload_json: format!(
            r#"{{"id":"{id}","patient_id":"seed-pat-001","arzt_id":"seed-arzt-001","typ":"AU","inhalt":"Tier1 attest","gueltig_von":"2026-06-02","gueltig_bis":"2026-06-09","ausgestellt_am":"2026-06-02","created_at":"{ts}"}}"#
        ),
        created_at: ts.into(),
    };
    assert_eq!(push_one(&mut lan, &token, device, entry).await, 1);
    let typ: Option<String> = sqlx::query_scalar("SELECT typ FROM attest WHERE id = ?1")
        .bind(id)
        .fetch_optional(&lan.pool)
        .await
        .unwrap();
    assert_eq!(typ.as_deref(), Some("AU"));
}

#[tokio::test]
async fn tier1_leistung_push_applies_on_master() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let device = "tier1-leistung";
    let token = pair_replica(&mut lan, &jwt, 54, device).await;
    let id = "tier1-leistung-001";
    let ts = "2026-06-02T12:00:00Z";
    let entry = OutboxEntry {
        id: format!("lei-{device}-1"),
        device_id: device.into(),
        seq: 1,
        entity_table: "leistung".into(),
        entity_id: id.into(),
        op: "INSERT".into(),
        payload_json: format!(
            r#"{{"id":"{id}","name":"Tier1 Leistung","beschreibung":null,"kategorie":"GOZ","preis":45.0,"aktiv":true,"created_at":"{ts}","updated_at":"{ts}"}}"#
        ),
        created_at: ts.into(),
    };
    assert_eq!(push_one(&mut lan, &token, device, entry).await, 1);
    let name: Option<String> = sqlx::query_scalar("SELECT name FROM leistung WHERE id = ?1")
        .bind(id)
        .fetch_optional(&lan.pool)
        .await
        .unwrap();
    assert_eq!(name.as_deref(), Some("Tier1 Leistung"));
}

#[tokio::test]
async fn tier1_in_app_notification_push_applies_on_master() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;
    let device = "tier1-notif";
    let token = pair_replica(&mut lan, &jwt, 55, device).await;
    let id = "tier1-notif-001";
    let ts = "2026-06-02T12:00:00Z";
    let entry = OutboxEntry {
        id: format!("ntf-{device}-1"),
        device_id: device.into(),
        seq: 1,
        entity_table: "in_app_notification".into(),
        entity_id: id.into(),
        op: "INSERT".into(),
        payload_json: format!(
            r#"{{"id":"{id}","user_id":"seed-arzt-001","kind":"SYNC","title":"Tier1","body":"hello","payload_json":null,"read_at":null,"created_at":"{ts}"}}"#
        ),
        created_at: ts.into(),
    };
    assert_eq!(push_one(&mut lan, &token, device, entry).await, 1);
    let title: Option<String> =
        sqlx::query_scalar("SELECT title FROM in_app_notification WHERE id = ?1")
            .bind(id)
            .fetch_optional(&lan.pool)
            .await
            .unwrap();
    assert_eq!(title.as_deref(), Some("Tier1"));
}
