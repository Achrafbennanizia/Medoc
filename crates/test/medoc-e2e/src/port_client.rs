//! Real HTTPS/HTTP clients for multi-process port-based e2e (medoc-server binaries).

use crate::harness::{slave_pubkey_b64, slave_signing_key};
use medoc_sync::repo::OutboxEntry;
use reqwest::Method;
use serde_json::Value;
use std::path::Path;
use std::process::{Child, Stdio};

/// LAN master client (self-signed TLS).
pub struct PortE2eClient {
    http: reqwest::Client,
    pub base_url: String,
}

impl PortE2eClient {
    pub fn lan(base_url: &str) -> Self {
        let http = reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .build()
            .expect("reqwest lan client");
        Self {
            http,
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }

    /// Company server (plain HTTP).
    pub fn company(base_url: &str) -> Self {
        let http = reqwest::Client::builder()
            .build()
            .expect("reqwest company client");
        Self {
            http,
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }

    pub async fn json(
        &self,
        method: &str,
        path: &str,
        body: Option<&Value>,
        bearer: Option<&str>,
    ) -> (u16, Value) {
        self.json_with_headers(method, path, body, bearer, &[])
            .await
    }

    pub async fn json_with_headers(
        &self,
        method: &str,
        path: &str,
        body: Option<&Value>,
        bearer: Option<&str>,
        extra_headers: &[(&str, &str)],
    ) -> (u16, Value) {
        let url = format!("{}{}", self.base_url, path);
        let mut req = self
            .http
            .request(Method::from_bytes(method.as_bytes()).expect("method"), &url);
        if let Some(token) = bearer {
            req = req.bearer_auth(token);
        }
        for (k, v) in extra_headers {
            req = req.header(*k, *v);
        }
        if let Some(json) = body {
            req = req.json(json);
        }
        let resp = req.send().await.expect("http send");
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        let value = if text.is_empty() {
            Value::Null
        } else {
            serde_json::from_str(&text).unwrap_or(Value::String(text))
        };
        (status, value)
    }

    pub async fn wait_health(&self, max_attempts: u32) {
        for _ in 0..max_attempts {
            if let Ok((200, body)) = self.try_health().await {
                if body.get("status").and_then(|v| v.as_str()) == Some("ok") {
                    return;
                }
            }
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }
        panic!("health check failed for {}", self.base_url);
    }

    async fn try_health(&self) -> Result<(u16, Value), reqwest::Error> {
        let url = format!("{}/health", self.base_url);
        let resp = self.http.get(&url).send().await?;
        let status = resp.status().as_u16();
        let text = resp.text().await?;
        let value: Value = serde_json::from_str(&text).unwrap_or(Value::String(text));
        Ok((status, value))
    }

    pub async fn login_arzt_totp(&self, totp_code: &str) -> String {
        let (status, body) = self
            .json(
                "POST",
                "/api/v1/auth/login",
                Some(&serde_json::json!({
                    "email": "ahmed@praxis.de",
                    "passwort": "passwort123",
                    "totp_code": totp_code
                })),
                None,
            )
            .await;
        assert_eq!(status, 200, "login failed: {body:?}");
        body["access_token"]
            .as_str()
            .expect("access_token")
            .to_string()
    }
}

pub fn master_url_from_env() -> String {
    std::env::var("MEDOC_MASTER_URL").unwrap_or_else(|_| "https://127.0.0.1:8787".to_string())
}

/// When false, port-based e2e tests no-op (Docker sets `MEDOC_MASTER_URL` — see `run-multi-device-port-e2e.sh`).
pub fn port_e2e_or_skip() -> bool {
    std::env::var("MEDOC_MASTER_URL").is_err()
}

pub fn company_url_from_env() -> String {
    std::env::var("MEDOC_COMPANY_URL").unwrap_or_else(|_| "http://127.0.0.1:9797".to_string())
}

pub async fn pair_replica_over_port(
    client: &PortE2eClient,
    master_jwt: &str,
    seed: u8,
    device_id: &str,
) -> String {
    let slave_pubkey = slave_pubkey_b64(&slave_signing_key(seed));
    let (status, submitted) = client
        .json(
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": device_id,
                "slavePubkey": slave_pubkey,
                "slaveLabel": format!("Port-Replica-{seed}"),
            })),
            None,
        )
        .await;
    assert_eq!(status, 200, "pairing request: {submitted:?}");
    let request_id = submitted["id"].as_str().expect("request id");

    let (status, decided) = client
        .json(
            "POST",
            &format!("/api/v1/pairing/decide/{request_id}"),
            Some(&serde_json::json!({ "accept": true })),
            Some(master_jwt),
        )
        .await;
    assert_eq!(status, 200, "pairing decide: {decided:?}");
    let pin = decided["confirmPin"]
        .as_str()
        .expect("confirm pin after accept");
    let (status, confirmed) = client
        .json(
            "POST",
            &format!("/api/v1/pairing/confirm/{request_id}"),
            Some(&serde_json::json!({ "pin": pin })),
            None,
        )
        .await;
    assert_eq!(status, 200, "pairing confirm: {confirmed:?}");
    confirmed["activationToken"]
        .as_str()
        .expect("activation token")
        .to_string()
}

pub fn patient_insert_entry(
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

pub async fn sync_push_entries(
    client: &PortE2eClient,
    activation_token: &str,
    device_id: &str,
    entries: &[OutboxEntry],
) -> Value {
    let (status, body) = client
        .json(
            "POST",
            "/api/v1/sync/push",
            Some(&serde_json::json!({
                "fromDeviceId": device_id,
                "entries": entries,
            })),
            Some(activation_token),
        )
        .await;
    assert_eq!(status, 200, "sync push: {body:?}");
    body
}

pub async fn sync_pull_since(
    client: &PortE2eClient,
    activation_token: &str,
    device_id: &str,
    since_seq: i64,
) -> Value {
    let (status, body) = client
        .json(
            "POST",
            "/api/v1/sync/pull",
            Some(&serde_json::json!({
                "deviceId": device_id,
                "sinceSeq": since_seq,
            })),
            Some(activation_token),
        )
        .await;
    assert_eq!(status, 200, "sync pull: {body:?}");
    body
}

pub async fn sync_push_raw(
    client: &PortE2eClient,
    activation_token: &str,
    from_device_id: &str,
    entries: &[OutboxEntry],
) -> (u16, Value) {
    client
        .json(
            "POST",
            "/api/v1/sync/push",
            Some(&serde_json::json!({
                "fromDeviceId": from_device_id,
                "entries": entries,
            })),
            Some(activation_token),
        )
        .await
}

pub fn rezept_insert_entry(
    device_id: &str,
    seq: i64,
    rezept_id: &str,
    patient_id: &str,
    arzt_id: &str,
    medikament: &str,
    created_at_iso: &str,
) -> OutboxEntry {
    let payload = serde_json::json!({
        "id": rezept_id,
        "patient_id": patient_id,
        "arzt_id": arzt_id,
        "medikament": medikament,
        "dosierung": "1-0-1",
        "dauer": "7 Tage",
        "ausgestellt_am": "2026-06-02",
        "status": "AUSGESTELLT",
        "created_at": created_at_iso,
        "aut_idem": true,
        "rezept_typ": "PRIVAT",
    });
    OutboxEntry {
        id: format!("rez-{device_id}-{seq}"),
        device_id: device_id.into(),
        seq,
        entity_table: "rezept".into(),
        entity_id: rezept_id.into(),
        op: "INSERT".into(),
        payload_json: payload.to_string(),
        created_at: created_at_iso.into(),
    }
}

#[allow(clippy::too_many_arguments)]
pub fn praxis_ticket_insert_entry(
    device_id: &str,
    seq: i64,
    ticket_id: &str,
    patient_id: &str,
    from_user_id: &str,
    to_arzt_id: &str,
    body: &str,
    created_at_iso: &str,
) -> OutboxEntry {
    let payload = serde_json::json!({
        "id": ticket_id,
        "patient_id": patient_id,
        "from_user_id": from_user_id,
        "to_arzt_id": to_arzt_id,
        "body": body,
        "status": "OFFEN",
        "created_at": created_at_iso,
        "updated_at": created_at_iso,
    });
    OutboxEntry {
        id: format!("tkt-{device_id}-{seq}"),
        device_id: device_id.into(),
        seq,
        entity_table: "praxis_ticket".into(),
        entity_id: ticket_id.into(),
        op: "INSERT".into(),
        payload_json: payload.to_string(),
        created_at: created_at_iso.into(),
    }
}

pub fn patient_update_entry(
    device_id: &str,
    seq: i64,
    patient_id: &str,
    name: &str,
    updated_at_iso: &str,
) -> OutboxEntry {
    OutboxEntry {
        id: format!("upd-{device_id}-{seq}"),
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

pub async fn submit_pairing_request(
    client: &PortE2eClient,
    seed: u8,
    device_id: &str,
    label: &str,
) -> (String, Value) {
    let slave_pubkey = slave_pubkey_b64(&slave_signing_key(seed));
    let (status, submitted) = client
        .json(
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": device_id,
                "slavePubkey": slave_pubkey,
                "slaveLabel": label,
            })),
            None,
        )
        .await;
    assert_eq!(status, 200, "pairing request: {submitted:?}");
    let request_id = submitted["id"].as_str().expect("request id").to_string();
    (request_id, submitted)
}

/// Headless `medoc-server` child for mesh / replica TCP tests.
pub struct MedocServerProcess {
    pub base_url: String,
    child: Child,
}

impl Drop for MedocServerProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

pub fn medoc_server_bin() -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../target/debug/medoc-server")
}

pub async fn spawn_medoc_server(data_dir: &Path, port: u16, label: &str) -> MedocServerProcess {
    let bin = medoc_server_bin();
    assert!(
        bin.exists(),
        "medoc-server binary missing at {}",
        bin.display()
    );
    let child = std::process::Command::new(&bin)
        .args([
            "--data-dir",
            &data_dir.to_string_lossy(),
            "--http-bind",
            "127.0.0.1",
            "--http-port",
            &port.to_string(),
            "--label",
            label,
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .expect("spawn medoc-server");
    let base_url = format!("https://127.0.0.1:{port}");
    PortE2eClient::lan(&base_url).wait_health(40).await;
    MedocServerProcess { base_url, child }
}

pub fn replica_port_a_from_env() -> u16 {
    std::env::var("MEDOC_REPLICA_A_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8788)
}

pub fn replica_port_b_from_env() -> u16 {
    std::env::var("MEDOC_REPLICA_B_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8789)
}
