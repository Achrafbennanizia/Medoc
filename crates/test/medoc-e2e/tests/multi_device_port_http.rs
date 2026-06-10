//! Multi-process port-based HTTP e2e — real `medoc-server` / `medoc-company-server` binaries.
//!
//! Run via `docker/ci/run-multi-device-port-e2e.sh` (sets `MEDOC_MASTER_URL`, starts servers).

use medoc_e2e::harness::{
    self, open_headless_pool, patch_replica_peer_url, prepare_replica_data_dir,
    PORT_MASTER_SEED_PATIENT_NAME,
};
use medoc_e2e::port_client::{
    company_url_from_env, master_url_from_env, pair_replica_over_port, patient_insert_entry,
    patient_update_entry, port_e2e_or_skip, praxis_ticket_insert_entry, replica_port_a_from_env,
    replica_port_b_from_env, rezept_insert_entry, spawn_medoc_server, submit_pairing_request,
    sync_pull_since, sync_push_entries, sync_push_raw, MedocServerProcess, PortE2eClient,
};
use medoc_sync::engine::SyncEngine;
use medoc_sync::pairing::ACTIVATION_TOKEN_PREFIX;
use medoc_sync::repo;

const DEMO_SLUG: &str = "demo-praxis";
const DEMO_API_KEY: &str = "sk_demo_company_practice_key";

/// Invoked by Docker orchestrator before starting `medoc-server`.
#[tokio::test]
#[ignore = "docker: MEDOC_MASTER_DATA_DIR must be set"]
async fn prepare_master_datadir() {
    let dir = std::env::var("MEDOC_MASTER_DATA_DIR").expect("MEDOC_MASTER_DATA_DIR");
    harness::prepare_master_data_dir(std::path::Path::new(&dir)).await;
}

#[tokio::test]
async fn port_master_public_health_and_master_info() {
    if port_e2e_or_skip() {
        return;
    }
    harness::ensure_e2e_env();
    let client = PortE2eClient::lan(&master_url_from_env());

    let (status, body) = client.json("GET", "/health", None, None).await;
    assert_eq!(status, 200);
    assert_eq!(body["status"], "ok");
    assert_eq!(body["service"], "medoc-lan");

    let (status, body) = client.json("GET", "/api/v1/ping", None, None).await;
    assert_eq!(status, 200);
    assert_eq!(body["ok"], true);

    let (status, body) = client
        .json("GET", "/api/v1/pairing/master-info", None, None)
        .await;
    assert_eq!(status, 200);
    assert!(body["masterPubkey"].is_string());
}

#[tokio::test]
async fn port_master_jwt_login_and_me() {
    if port_e2e_or_skip() {
        return;
    }
    harness::ensure_e2e_env();
    let client = PortE2eClient::lan(&master_url_from_env());
    let jwt = client.login_arzt_totp("1234").await;

    let (status, body) = client.json("GET", "/api/v1/me", None, Some(&jwt)).await;
    assert_eq!(status, 200);
    assert_eq!(body["email"], "ahmed@praxis.de");
    assert_eq!(body["rolle"], "ARZT");
}

#[tokio::test]
async fn port_two_replicas_pair_push_patient_master_lists() {
    if port_e2e_or_skip() {
        return;
    }
    harness::ensure_e2e_env();
    let client = PortE2eClient::lan(&master_url_from_env());
    let jwt = client.login_arzt_totp("1234").await;

    let token_a = pair_replica_over_port(&client, &jwt, 11, "port-replica-a").await;
    let token_b = pair_replica_over_port(&client, &jwt, 12, "port-replica-b").await;
    assert!(token_a.starts_with(ACTIVATION_TOKEN_PREFIX));
    assert!(token_b.starts_with(ACTIVATION_TOKEN_PREFIX));

    let patient_id = "port-pat-001";
    let entry = patient_insert_entry(
        "port-replica-a",
        1,
        patient_id,
        "Port E2E Patient",
        "2026-06-01T12:00:00Z",
        "PORT-E2E-001",
    );
    let push = sync_push_entries(&client, &token_a, "port-replica-a", &[entry]).await;
    assert_eq!(push["accepted"], 1);

    let (status, patients) = client
        .json("GET", "/api/v1/patienten", None, Some(&jwt))
        .await;
    assert_eq!(status, 200, "patienten list: {patients:?}");
    let names: Vec<_> = patients
        .as_array()
        .expect("patient array")
        .iter()
        .filter_map(|p| p["name"].as_str())
        .collect();
    assert!(names.iter().any(|n| n.contains("Port E2E Patient")));

    let pull = sync_pull_since(&client, &token_b, "port-replica-b", 0).await;
    assert!(pull["entries"].is_array(), "pull response: {pull:?}");

    let (_, master_info) = client
        .json("GET", "/api/v1/pairing/master-info", None, None)
        .await;
    let master_device_id = master_info["masterDeviceId"]
        .as_str()
        .expect("master device id");
    let master_pull = sync_pull_since(&client, &token_b, master_device_id, 0).await;
    let master_entries = master_pull["entries"]
        .as_array()
        .expect("master pull entries");
    assert!(
        master_entries
            .iter()
            .any(|e| e["entityTable"] == "patient" || e["entityTable"] == "patientenakte"),
        "replica B should pull master outbox after seed: {master_entries:?}"
    );

    let (status, status_b) = client
        .json("GET", "/api/v1/sync/status", None, Some(&token_b))
        .await;
    assert_eq!(status, 200);
    assert!(status_b["localDeviceId"].is_string());
}

#[tokio::test]
async fn port_master_sync_status_and_signed_peers() {
    if port_e2e_or_skip() {
        return;
    }
    harness::ensure_e2e_env();
    let client = PortE2eClient::lan(&master_url_from_env());
    let jwt = client.login_arzt_totp("1234").await;
    let token = pair_replica_over_port(&client, &jwt, 13, "port-replica-peers").await;

    let (status, sync_status) = client
        .json("GET", "/api/v1/sync/status", None, Some(&token))
        .await;
    assert_eq!(status, 200);
    assert!(sync_status["localDeviceId"].is_string());

    let (status, peers) = client
        .json("GET", "/api/v1/pairing/peers", None, Some(&token))
        .await;
    assert_eq!(status, 200);
    assert!(peers["signature"].is_string());
    assert!(peers["peers"].is_array());
}

#[tokio::test]
async fn port_company_server_health_and_practice_api() {
    if port_e2e_or_skip() {
        return;
    }
    harness::ensure_e2e_env();
    let company = PortE2eClient::company(&company_url_from_env());

    let (status, body) = company.json("GET", "/health", None, None).await;
    assert_eq!(status, 200);
    assert_eq!(body["service"], "medoc-company-server");
    assert_eq!(body["_demo"], true);

    let headers = [
        ("X-Practice-Slug", DEMO_SLUG),
        ("Authorization", &format!("Bearer {DEMO_API_KEY}")),
    ];
    let (status, summary) = company
        .json_with_headers("GET", "/v1/summary", None, None, &headers)
        .await;
    assert_eq!(status, 200, "summary: {summary:?}");
    assert_eq!(summary["practice_slug"], DEMO_SLUG);
}

#[tokio::test]
async fn port_practice_proxy_company_summary_via_lan() {
    if port_e2e_or_skip() {
        return;
    }
    harness::ensure_e2e_env();
    let lan = PortE2eClient::lan(&master_url_from_env());
    let jwt = lan.login_arzt_totp("1234").await;

    let (status, body) = lan
        .json("GET", "/api/v1/company/summary", None, Some(&jwt))
        .await;
    assert_eq!(status, 200, "LAN company proxy: {body:?}");
    assert!(
        body.get("practice_slug").is_some()
            || body.get("_demo").is_some()
            || body.get("display_name").is_some(),
        "expected company summary fields: {body:?}"
    );
}

#[tokio::test]
async fn port_pairing_status_transitions_pending_to_accepted() {
    if port_e2e_or_skip() {
        return;
    }
    harness::ensure_e2e_env();
    let client = PortE2eClient::lan(&master_url_from_env());
    let jwt = client.login_arzt_totp("1234").await;

    let (request_id, _) =
        submit_pairing_request(&client, 21, "port-status-replica", "Port Status Replica").await;

    let (status, pending) = client
        .json(
            "GET",
            &format!("/api/v1/pairing/status/{request_id}"),
            None,
            None,
        )
        .await;
    assert_eq!(status, 200);
    assert_eq!(pending["status"], "PENDING");

    let (status, decided) = client
        .json(
            "POST",
            &format!("/api/v1/pairing/decide/{request_id}"),
            Some(&serde_json::json!({ "accept": true })),
            Some(&jwt),
        )
        .await;
    assert_eq!(status, 200, "decide: {decided:?}");
    assert_eq!(decided["request"]["status"], "PENDING");
    assert!(decided["request"]["awaitingPin"].as_bool().unwrap_or(false));
    let pin = decided["confirmPin"].as_str().expect("confirm pin");

    let (status, confirmed) = client
        .json(
            "POST",
            &format!("/api/v1/pairing/confirm/{request_id}"),
            Some(&serde_json::json!({ "pin": pin })),
            None,
        )
        .await;
    assert_eq!(status, 200, "confirm: {confirmed:?}");
    assert_eq!(confirmed["status"], "ACCEPTED");
    assert!(confirmed["activationToken"]
        .as_str()
        .is_some_and(|t| t.starts_with(ACTIVATION_TOKEN_PREFIX)));

    let (status, accepted) = client
        .json(
            "GET",
            &format!("/api/v1/pairing/status/{request_id}"),
            None,
            None,
        )
        .await;
    assert_eq!(status, 200);
    assert_eq!(accepted["status"], "ACCEPTED");
}

#[tokio::test]
async fn port_push_spoofed_from_device_id_forbidden() {
    if port_e2e_or_skip() {
        return;
    }
    harness::ensure_e2e_env();
    let client = PortE2eClient::lan(&master_url_from_env());
    let jwt = client.login_arzt_totp("1234").await;
    let token = pair_replica_over_port(&client, &jwt, 22, "port-real-replica").await;

    let spoofed = "port-spoof-replica";
    let entry = patient_update_entry(
        spoofed,
        1,
        "port-spoof-patient",
        "Spoof",
        "2099-06-01T00:00:00Z",
    );
    let (status, _) = sync_push_raw(&client, &token, spoofed, &[entry]).await;
    assert_eq!(status, 403, "token device must match fromDeviceId");
}

#[tokio::test]
async fn port_two_replicas_freshness_conflict_over_https() {
    if port_e2e_or_skip() {
        return;
    }
    harness::ensure_e2e_env();
    let client = PortE2eClient::lan(&master_url_from_env());
    let jwt = client.login_arzt_totp("1234").await;

    let dev_a = "port-conflict-a";
    let dev_b = "port-conflict-b";
    let token_a = pair_replica_over_port(&client, &jwt, 23, dev_a).await;
    let token_b = pair_replica_over_port(&client, &jwt, 24, dev_b).await;

    let patient_id = "port-conflict-patient-001";
    let insert_b = patient_insert_entry(
        dev_b,
        1,
        patient_id,
        "Replica B Initial",
        "2099-01-01T00:00:00Z",
        "V-CONFLICT-B",
    );
    sync_push_entries(&client, &token_b, dev_b, &[insert_b]).await;

    let update_a_newer = patient_update_entry(
        dev_a,
        1,
        patient_id,
        "Replica A Newer Wins",
        "2099-12-01T00:00:00Z",
    );
    sync_push_entries(&client, &token_a, dev_a, &[update_a_newer]).await;

    let (status, patients) = client
        .json("GET", "/api/v1/patienten", None, Some(&jwt))
        .await;
    assert_eq!(status, 200);
    let winner = patients
        .as_array()
        .expect("patients")
        .iter()
        .find(|p| p["id"] == patient_id)
        .expect("conflict patient on master");
    assert_eq!(winner["name"], "Replica A Newer Wins");
}

#[tokio::test]
async fn port_sync_engine_push_to_master_propagates_patient() {
    if port_e2e_or_skip() {
        return;
    }
    harness::ensure_e2e_env();
    let master_url = master_url_from_env();
    let client = PortE2eClient::lan(&master_url);
    let jwt = client.login_arzt_totp("1234").await;

    let device_id = "port-engine-push-replica";
    let token = pair_replica_over_port(&client, &jwt, 25, device_id).await;

    let (_, master_info) = client
        .json("GET", "/api/v1/pairing/master-info", None, None)
        .await;
    let master_pubkey = master_info["masterPubkey"].as_str().expect("pubkey");
    let master_device_id = master_info["masterDeviceId"]
        .as_str()
        .expect("master device id");

    let replica_dir = std::env::temp_dir().join(format!("medoc-port-replica-{device_id}"));
    let _ = std::fs::remove_dir_all(&replica_dir);
    prepare_replica_data_dir(
        &replica_dir,
        device_id,
        "Engine Push Replica",
        &master_url,
        master_pubkey,
        master_device_id,
        &token,
        false,
    )
    .await;

    let pool = open_headless_pool(&replica_dir).await;
    let patient_id = "port-engine-push-pat-001";
    let entry = patient_insert_entry(
        device_id,
        1,
        patient_id,
        "Engine Push Patient",
        "2099-06-02T12:00:00Z",
        "V-ENGINE-PUSH",
    );
    repo::append_outbox(
        &pool,
        device_id,
        "patient",
        patient_id,
        "INSERT",
        &entry.payload_json,
    )
    .await
    .expect("append outbox");

    let push = SyncEngine::push_to_master(&pool)
        .await
        .expect("push_to_master");
    assert_eq!(push.accepted, 1);

    let (status, patients) = client
        .json("GET", "/api/v1/patienten", None, Some(&jwt))
        .await;
    assert_eq!(status, 200);
    assert!(patients.as_array().is_some_and(|rows| rows
        .iter()
        .any(|p| p["id"] == patient_id && p["name"] == "Engine Push Patient")));

    let _ = std::fs::remove_dir_all(&replica_dir);
}

#[tokio::test]
async fn port_sync_engine_pull_from_master_applies_to_replica_db() {
    if port_e2e_or_skip() {
        return;
    }
    harness::ensure_e2e_env();
    let master_url = master_url_from_env();
    let client = PortE2eClient::lan(&master_url);
    let jwt = client.login_arzt_totp("1234").await;

    let device_id = "port-engine-pull-replica";
    let token = pair_replica_over_port(&client, &jwt, 26, device_id).await;

    let (_, master_info) = client
        .json("GET", "/api/v1/pairing/master-info", None, None)
        .await;
    let master_pubkey = master_info["masterPubkey"].as_str().expect("pubkey");
    let master_device_id = master_info["masterDeviceId"]
        .as_str()
        .expect("master device id");

    let replica_dir = std::env::temp_dir().join(format!("medoc-port-replica-{device_id}"));
    let _ = std::fs::remove_dir_all(&replica_dir);
    prepare_replica_data_dir(
        &replica_dir,
        device_id,
        "Engine Pull Replica",
        &master_url,
        master_pubkey,
        master_device_id,
        &token,
        false,
    )
    .await;

    let pool = open_headless_pool(&replica_dir).await;
    let pull = SyncEngine::pull_from_master(&pool)
        .await
        .expect("pull_from_master");
    assert!(
        pull.applied >= 1,
        "expected master seed rows applied, got {pull:?}"
    );

    let name: Option<String> =
        sqlx::query_scalar("SELECT name FROM patient WHERE name = ?1 LIMIT 1")
            .bind(PORT_MASTER_SEED_PATIENT_NAME)
            .fetch_optional(&pool)
            .await
            .expect("query replica patient");
    assert_eq!(
        name.as_deref(),
        Some(PORT_MASTER_SEED_PATIENT_NAME),
        "replica local DB should mirror master seed patient"
    );

    let _ = std::fs::remove_dir_all(&replica_dir);
}

#[tokio::test]
async fn port_revoked_replica_push_forbidden() {
    if port_e2e_or_skip() {
        return;
    }
    harness::ensure_e2e_env();
    let client = PortE2eClient::lan(&master_url_from_env());
    let jwt = client.login_arzt_totp("1234").await;

    let device_id = "port-revoke-replica";
    let token = pair_replica_over_port(&client, &jwt, 27, device_id).await;

    let (status, _) = client
        .json(
            "POST",
            &format!("/api/v1/pairing/revoke/{device_id}"),
            None,
            Some(&jwt),
        )
        .await;
    assert!(
        status == 200 || status == 204,
        "revoke should succeed, got {status}"
    );

    let entry = patient_insert_entry(
        device_id,
        1,
        "port-revoke-pat",
        "Should Not Apply",
        "2099-06-03T00:00:00Z",
        "V-REVOKE",
    );
    let (status, _) = sync_push_raw(&client, &token, device_id, &[entry]).await;
    assert_eq!(status, 403, "revoked replica must not push");
}

#[tokio::test]
async fn port_mesh_sync_delivers_app_kv_to_peer_replica() {
    if port_e2e_or_skip() {
        return;
    }
    harness::ensure_e2e_env();
    let master_data_dir = std::env::var("MEDOC_MASTER_DATA_DIR")
        .expect("MEDOC_MASTER_DATA_DIR required for mesh port test");
    let master_data_dir = std::path::PathBuf::from(master_data_dir);

    let master_url = master_url_from_env();
    let client = PortE2eClient::lan(&master_url);
    let jwt = client.login_arzt_totp("1234").await;

    let device_a = "port-mesh-replica-a";
    let device_b = "port-mesh-replica-b";
    let token_a = pair_replica_over_port(&client, &jwt, 28, device_a).await;
    let token_b = pair_replica_over_port(&client, &jwt, 29, device_b).await;

    let (_, master_info) = client
        .json("GET", "/api/v1/pairing/master-info", None, None)
        .await;
    let master_pubkey = master_info["masterPubkey"].as_str().expect("pubkey");
    let master_device_id = master_info["masterDeviceId"]
        .as_str()
        .expect("master device id");

    let port_a = replica_port_a_from_env();
    let port_b = replica_port_b_from_env();
    let dir_a = std::env::temp_dir().join(format!("medoc-mesh-{device_a}"));
    let dir_b = std::env::temp_dir().join(format!("medoc-mesh-{device_b}"));
    let _ = std::fs::remove_dir_all(&dir_a);
    let _ = std::fs::remove_dir_all(&dir_b);

    prepare_replica_data_dir(
        &dir_a,
        device_a,
        "Mesh Replica A",
        &master_url,
        master_pubkey,
        master_device_id,
        &token_a,
        true,
    )
    .await;
    prepare_replica_data_dir(
        &dir_b,
        device_b,
        "Mesh Replica B",
        &master_url,
        master_pubkey,
        master_device_id,
        &token_b,
        false,
    )
    .await;

    let _server_a: MedocServerProcess = spawn_medoc_server(&dir_a, port_a, "Mesh Replica A").await;
    let _server_b: MedocServerProcess = spawn_medoc_server(&dir_b, port_b, "Mesh Replica B").await;

    patch_replica_peer_url(
        &master_data_dir,
        device_a,
        &format!("https://127.0.0.1:{port_a}"),
    )
    .await;
    patch_replica_peer_url(
        &master_data_dir,
        device_b,
        &format!("https://127.0.0.1:{port_b}"),
    )
    .await;

    let pool_a = open_headless_pool(&dir_a).await;
    let pool_b = open_headless_pool(&dir_b).await;
    let kv_key = "mesh.port.e2e.delivered";
    repo::append_outbox(
        &pool_a,
        device_a,
        "app_kv",
        kv_key,
        "INSERT",
        &format!(r#"{{"key":"{kv_key}","value":"from-mesh-port-a"}}"#),
    )
    .await
    .expect("mesh outbox");

    let report = SyncEngine::run_mesh_sync(&pool_a).await.expect("mesh sync");
    assert!(
        report.succeeded >= 1,
        "mesh should reach at least peer B (attempted={}, errors={:?})",
        report.attempted,
        report.errors
    );

    let value: Option<String> = sqlx::query_scalar("SELECT value FROM app_kv WHERE key = ?1")
        .bind(kv_key)
        .fetch_optional(&pool_b)
        .await
        .expect("read replica b");
    assert_eq!(value.as_deref(), Some("from-mesh-port-a"));

    let report2 = SyncEngine::run_mesh_sync(&pool_a)
        .await
        .expect("mesh sync repeat");
    let dup_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM app_kv WHERE key = ?1")
        .bind(kv_key)
        .fetch_one(&pool_b)
        .await
        .expect("count kv rows");
    assert_eq!(
        dup_count, 1,
        "second mesh run must not duplicate app_kv on peer (report2 attempted={})",
        report2.attempted
    );

    let _ = std::fs::remove_dir_all(&dir_a);
    let _ = std::fs::remove_dir_all(&dir_b);
}

#[tokio::test]
async fn port_sync_rezept_push_applies_on_master() {
    if port_e2e_or_skip() {
        return;
    }
    harness::ensure_e2e_env();
    let master_data_dir = std::env::var("MEDOC_MASTER_DATA_DIR")
        .expect("MEDOC_MASTER_DATA_DIR required for tier-1 port test");
    let master_url = master_url_from_env();
    let client = PortE2eClient::lan(&master_url);
    let jwt = client.login_arzt_totp("1234").await;

    let device_id = "port-rezept-replica";
    let token = pair_replica_over_port(&client, &jwt, 30, device_id).await;
    let rezept_id = "port-rezept-001";
    let ts = "2026-06-02T12:00:00Z";
    let entry = rezept_insert_entry(
        device_id,
        1,
        rezept_id,
        "seed-pat-001",
        "seed-arzt-001",
        "Port E2E Rezept",
        ts,
    );
    sync_push_entries(&client, &token, device_id, &[entry]).await;

    let master_pool = open_headless_pool(std::path::Path::new(&master_data_dir)).await;
    let med: Option<String> = sqlx::query_scalar("SELECT medikament FROM rezept WHERE id = ?1")
        .bind(rezept_id)
        .fetch_optional(&master_pool)
        .await
        .expect("read rezept");
    assert_eq!(med.as_deref(), Some("Port E2E Rezept"));
}

#[tokio::test]
async fn port_sync_praxis_ticket_push_applies_on_master() {
    if port_e2e_or_skip() {
        return;
    }
    harness::ensure_e2e_env();
    let master_data_dir = std::env::var("MEDOC_MASTER_DATA_DIR")
        .expect("MEDOC_MASTER_DATA_DIR required for tier-1 port test");
    let master_url = master_url_from_env();
    let client = PortE2eClient::lan(&master_url);
    let jwt = client.login_arzt_totp("1234").await;

    let device_id = "port-ticket-replica";
    let token = pair_replica_over_port(&client, &jwt, 31, device_id).await;
    let ticket_id = "port-ticket-001";
    let ts = "2026-06-02T12:30:00Z";
    let entry = praxis_ticket_insert_entry(
        device_id,
        1,
        ticket_id,
        "seed-pat-001",
        "seed-rez-001",
        "seed-arzt-001",
        "Port E2E Praxis-Ticket",
        ts,
    );
    sync_push_entries(&client, &token, device_id, &[entry]).await;

    let master_pool = open_headless_pool(std::path::Path::new(&master_data_dir)).await;
    let body: Option<String> = sqlx::query_scalar("SELECT body FROM praxis_ticket WHERE id = ?1")
        .bind(ticket_id)
        .fetch_optional(&master_pool)
        .await
        .expect("read ticket");
    assert_eq!(body.as_deref(), Some("Port E2E Praxis-Ticket"));
}

#[tokio::test]
async fn port_activation_token_patient_read_lists_over_https() {
    if port_e2e_or_skip() {
        return;
    }
    harness::ensure_e2e_env();
    let client = PortE2eClient::lan(&master_url_from_env());
    let jwt = client.login_arzt_totp("1234").await;

    let device_id = "port-rbac-patient-read";
    let (request_id, _) = submit_pairing_request(&client, 32, device_id, device_id).await;
    let (status, decided) = client
        .json(
            "POST",
            &format!("/api/v1/pairing/decide/{request_id}"),
            Some(&serde_json::json!({
                "accept": true,
                "allowedActions": [
                    "sync.push",
                    "sync.pull",
                    "sync.status",
                    "pairing.peers",
                    "patient.read",
                ],
            })),
            Some(&jwt),
        )
        .await;
    assert_eq!(status, 200, "decide: {decided:?}");
    let pin = decided["confirmPin"].as_str().expect("confirm pin");
    let (status, confirmed) = client
        .json(
            "POST",
            &format!("/api/v1/pairing/confirm/{request_id}"),
            Some(&serde_json::json!({ "pin": pin })),
            None,
        )
        .await;
    assert_eq!(status, 200, "confirm: {confirmed:?}");
    let token = confirmed["activationToken"].as_str().expect("token");

    let (status, patients) = client
        .json("GET", "/api/v1/patienten", None, Some(token))
        .await;
    assert_eq!(status, 200);
    assert!(patients.as_array().is_some_and(|a| !a.is_empty()));
}

#[tokio::test]
async fn port_activation_token_without_patient_read_gets_403() {
    if port_e2e_or_skip() {
        return;
    }
    harness::ensure_e2e_env();
    let client = PortE2eClient::lan(&master_url_from_env());
    let jwt = client.login_arzt_totp("1234").await;

    let token = pair_replica_over_port(&client, &jwt, 33, "port-rbac-no-read").await;

    let (status, _) = client
        .json("GET", "/api/v1/patienten", None, Some(&token))
        .await;
    assert_eq!(status, 403);
}
