use std::time::Duration;

use medoc_core::error::AppError;
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
use crate::merge::{apply_remote_entry, apply_remote_entry_phased, ConflictPolicy};
use crate::repo::{
    clear_pull_failure, enqueue_full_snapshot, ensure_local_device, list_entries_since,
    list_pending_outbox, list_pending_outbox_for_peer, load_deployment, load_row_payload_json,
    mark_outbox_delivered, mark_peer_delivery, record_pull_failure, save_deployment,
    set_observed_seq, status_snapshot, SyncStatusSnapshot,
};

/// Failed pull rows are retried on later cycles. After this many failures the
/// cursor moves past the row so one bad entry cannot stall every newer change.
pub const PULL_ROW_RETRY_LIMIT: i64 = 8;

use super::types::{MeshSyncReport, SyncPullResult, SyncPushResult, SyncRunReport};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncPullResponseBody {
    entries: Vec<crate::repo::OutboxEntry>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct MeshPeerInfo {
    device_id: String,
    #[serde(default)]
    peer_base_url: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SignedMeshPeerEntry {
    device_id: String,
    slave_label: String,
    slave_pubkey: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    peer_base_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MeshPeerListResponse {
    master_device_id: String,
    #[serde(default)]
    peers: Vec<SignedMeshPeerEntry>,
    signature: String,
}

pub struct SyncEngine;

impl SyncEngine {
    pub async fn status(pool: &SqlitePool) -> Result<SyncStatusSnapshot, AppError> {
        status_snapshot(pool).await
    }

    /// Ingest remote outbox batch (master or replica receiving peer push).
    pub async fn ingest_push(
        pool: &SqlitePool,
        from_device_id: &str,
        entries: &[crate::repo::OutboxEntry],
    ) -> Result<SyncPushResult, AppError> {
        let deployment = load_deployment(pool).await?;
        let local_id = ensure_local_device(pool, &deployment.device_label).await?;
        let local_is_master = deployment.role == DeviceRole::Master || local_id == from_device_id;
        // Replicas pull this device's outbox only. A change that arrived from
        // another replica has to be copied onto that outbox or it never
        // leaves this device. The copied payload is the row as stored here,
        // so a stale push forwards the newer local row rather than the body
        // that was rejected.
        let relay = deployment.role == DeviceRole::Master && from_device_id != local_id;
        let mut accepted = 0u32;
        let mut last_seq = 0i64;
        for entry in entries {
            if entry.device_id != from_device_id {
                return Err(AppError::Validation("sync push device_id mismatch".into()));
            }
            if apply_remote_entry(
                pool,
                &local_id,
                local_is_master,
                ConflictPolicy::LastWriteWins,
                entry,
            )
            .await?
            {
                accepted += 1;
                if relay {
                    let payload = relay_payload(pool, entry).await?;
                    crate::repo::append_outbox(
                        pool,
                        &local_id,
                        &entry.entity_table,
                        &entry.entity_id,
                        &entry.op,
                        &payload,
                    )
                    .await?;
                }
            }
            last_seq = entry.seq;
        }
        Ok(SyncPushResult { accepted, last_seq })
    }

    /// Return entries from `device_id` newer than `since_seq` (pull API).
    pub async fn collect_pull(
        pool: &SqlitePool,
        device_id: &str,
        since_seq: i64,
    ) -> Result<Vec<crate::repo::OutboxEntry>, AppError> {
        list_entries_since(pool, device_id, since_seq).await
    }

    /// First replica pull (`since_seq = 0`) queues a full row snapshot, then
    /// returns packages from **this node's** outbox. The replica-supplied
    /// `device_id` is ignored: independently seeded replicas never know the
    /// master's local outbox id, so serving by that id returned an empty pull.
    pub async fn collect_pull_for_replica(
        pool: &SqlitePool,
        _device_id: &str,
        since_seq: i64,
    ) -> Result<Vec<crate::repo::OutboxEntry>, AppError> {
        let deployment = load_deployment(pool).await?;
        let local_id = ensure_local_device(pool, &deployment.device_label).await?;
        if since_seq <= 0 {
            enqueue_full_snapshot(pool).await?;
        }
        Self::collect_pull(pool, &local_id, since_seq).await
    }

    /// Replica: push pending local outbox to master over HTTPS.
    pub async fn push_to_master(pool: &SqlitePool) -> Result<SyncPushResult, AppError> {
        let deployment = load_deployment(pool).await?;
        if deployment.mode != DeploymentMode::ServerlessPeer {
            return Err(AppError::Validation(
                "sync push requires serverless_peer mode".into(),
            ));
        }
        if deployment.role != DeviceRole::Replica {
            return Err(AppError::Validation(
                "sync push to master requires REPLICA role".into(),
            ));
        }
        if deployment.master_base_url.is_empty() {
            return Err(AppError::Validation("master_base_url missing".into()));
        }
        let bearer_token = pick_bearer(&deployment)?;
        let local_id = align_local_id_to_activation(pool, &deployment).await?;
        let pending = list_pending_outbox(pool, &local_id).await?;
        if pending.is_empty() {
            return Ok(SyncPushResult {
                accepted: 0,
                last_seq: 0,
            });
        }
        let last_seq = pending.last().map(|e| e.seq).unwrap_or(0);
        let client = build_http_client(&deployment.master_cert_sha256)?;
        let url = format!(
            "{}/api/v1/sync/push",
            deployment.master_base_url.trim_end_matches('/')
        );
        let body = serde_json::json!({
            "fromDeviceId": local_id,
            "entries": pending,
        });
        let resp = client
            .post(&url)
            .bearer_auth(&bearer_token)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("sync push http: {e}")))?;
        if !resp.status().is_success() {
            return Err(AppError::Internal(format!(
                "sync push http status {}",
                resp.status()
            )));
        }
        let result: SyncPushResult = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("sync push decode: {e}")))?;
        mark_outbox_delivered(pool, &local_id, last_seq).await?;
        Ok(result)
    }

    /// Replica: pull master changes since last known vector.
    pub async fn pull_from_master(pool: &SqlitePool) -> Result<SyncPullResult, AppError> {
        let deployment = load_deployment(pool).await?;
        if deployment.mode != DeploymentMode::ServerlessPeer
            || deployment.role != DeviceRole::Replica
        {
            return Err(AppError::Validation(
                "sync pull requires serverless_peer REPLICA".into(),
            ));
        }
        if deployment.master_base_url.is_empty() {
            return Err(AppError::Validation("master_base_url missing".into()));
        }
        let bearer_token = pick_bearer(&deployment)?;
        let vectors = crate::repo::all_vectors(pool).await?;
        let local_id = ensure_local_device(pool, &deployment.device_label).await?;
        let master_device_id = resolve_master_device_id(pool, &deployment)
            .await
            .unwrap_or_default();
        let since_seq = if master_device_id.is_empty() {
            0
        } else {
            vectors.get(&master_device_id).copied().unwrap_or(0)
        };
        let client = build_http_client(&deployment.master_cert_sha256)?;
        let url = format!(
            "{}/api/v1/sync/pull",
            deployment.master_base_url.trim_end_matches('/')
        );
        let body = serde_json::json!({
            "deviceId": master_device_id,
            "sinceSeq": since_seq,
            "requesterId": local_id,
        });
        let resp = client
            .post(&url)
            .bearer_auth(&bearer_token)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("sync pull http: {e}")))?;
        if !resp.status().is_success() {
            return Err(AppError::Internal(format!(
                "sync pull http status {}",
                resp.status()
            )));
        }
        let pulled: SyncPullResponseBody = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("sync pull decode: {e}")))?;
        if since_seq <= 0 {
            // Independent year seeds use the same `seed-yr-apt-*` ids with
            // different rows. LWW then keeps the replica's calendar. Drop
            // local seed appointments so the master's snapshot is the source.
            let _ = sqlx::query("DELETE FROM appointment WHERE id LIKE 'seed-yr-apt-%'")
                .execute(pool)
                .await;
        }
        let mut applied = 0u32;
        let mut skipped = 0u32;
        // Cursor stops at the last row before the first failure still under
        // the retry limit. Later rows in this batch are still applied, so a
        // parent that sorts after a child can land and the child succeeds
        // on the next pull. Rows after the hole are fetched again; apply is
        // idempotent.
        let mut cursor: Option<(String, i64)> = None;
        let mut blocked = false;
        for entry in &pulled.entries {
            match apply_remote_entry_phased(
                pool,
                &local_id,
                false,
                true,
                ConflictPolicy::LastWriteWins,
                entry,
            )
            .await
            {
                Ok(did_apply) => {
                    if did_apply {
                        applied += 1;
                    } else {
                        skipped += 1;
                    }
                    clear_pull_failure(pool, &entry.device_id, entry.seq).await?;
                    if !blocked {
                        cursor = Some((entry.device_id.clone(), entry.seq));
                    }
                }
                Err(e) => {
                    let attempts = record_pull_failure(pool, &entry.device_id, entry.seq).await?;
                    tracing::warn!(
                        target: "medoc::sync",
                        event = "REPLICA_PULL_ROW_SKIP",
                        table = %entry.entity_table,
                        id = %entry.entity_id,
                        attempts,
                        error = %e
                    );
                    skipped += 1;
                    if attempts >= PULL_ROW_RETRY_LIMIT {
                        tracing::warn!(
                            target: "medoc::sync",
                            event = "REPLICA_PULL_ROW_GAVE_UP",
                            table = %entry.entity_table,
                            id = %entry.entity_id,
                            seq = entry.seq,
                            attempts
                        );
                        clear_pull_failure(pool, &entry.device_id, entry.seq).await?;
                        if !blocked {
                            cursor = Some((entry.device_id.clone(), entry.seq));
                        }
                    } else {
                        blocked = true;
                    }
                }
            }
        }
        if let Some((device_id, seq)) = cursor {
            set_observed_seq(pool, &device_id, seq).await?;
        }
        Ok(SyncPullResult { applied, skipped })
    }

    /// Per-peer delivery is tracked in `sync_peer_vector` so repeated mesh
    /// cycles do not re-push the same seq to the same peer.
    pub async fn run_mesh_sync(pool: &SqlitePool) -> Result<MeshSyncReport, AppError> {
        let deployment = load_deployment(pool).await?;
        if !deployment.unstable_mesh {
            return Ok(MeshSyncReport {
                attempted: 0,
                succeeded: 0,
                errors: vec!["unstable_mesh flag is OFF".into()],
            });
        }
        if deployment.mode != DeploymentMode::ServerlessPeer
            || deployment.role != DeviceRole::Replica
        {
            return Err(AppError::Validation(
                "mesh sync requires serverless_peer REPLICA".into(),
            ));
        }
        let bearer_token = pick_bearer(&deployment)?;
        let peers = fetch_peer_list(&deployment, &bearer_token).await?;
        let local_id = ensure_local_device(pool, &deployment.device_label).await?;
        let mut report = MeshSyncReport::default();
        if peers.is_empty() {
            return Ok(report);
        }
        for peer in peers {
            if peer.device_id == local_id {
                continue;
            }
            report.attempted += 1;
            let Some(base) = peer.peer_base_url.as_deref().filter(|s| !s.is_empty()) else {
                report.errors.push(format!(
                    "peer {} skipped: no peer_base_url advertised",
                    peer.device_id
                ));
                continue;
            };
            let pending = list_pending_outbox_for_peer(pool, &local_id, &peer.device_id).await?;
            if pending.is_empty() {
                report.succeeded += 1;
                continue;
            }
            match push_to_peer(
                pool,
                base,
                &bearer_token,
                &local_id,
                &peer.device_id,
                &pending,
            )
            .await
            {
                Ok(_) => report.succeeded += 1,
                Err(e) => report.errors.push(format!("peer {}: {e}", peer.device_id)),
            }
        }
        Ok(report)
    }

    /// Bidirectional sync for serverless replica.
    ///
    /// Product order (C8): **push** member changes (LWW merge on master), then
    /// **pull** admin authoritative rows onto the replica (`admin_pull` phase).
    pub async fn run_replica_sync(pool: &SqlitePool) -> Result<SyncRunReport, AppError> {
        let mut report = SyncRunReport {
            push: None,
            pull: None,
            mesh: None,
            error: None,
        };
        match Self::push_to_master(pool).await {
            Ok(push) => report.push = Some(push),
            Err(e) => report.error = Some(format!("push: {e}")),
        }
        match Self::pull_from_master(pool).await {
            Ok(pull) => report.pull = Some(pull),
            Err(e) => {
                let msg = format!("pull: {e}");
                report.error = Some(match report.error {
                    Some(prev) => format!("{prev}; {msg}"),
                    None => msg,
                });
            }
        }
        let deployment = load_deployment(pool).await?;
        if deployment.unstable_mesh {
            match Self::run_mesh_sync(pool).await {
                Ok(mesh) => {
                    if !mesh.errors.is_empty() {
                        let msg = format!("mesh: {}", mesh.errors.join("; "));
                        report.error = Some(match report.error {
                            Some(prev) => format!("{prev}; {msg}"),
                            None => msg,
                        });
                    }
                    report.mesh = Some(mesh);
                }
                Err(e) => {
                    let msg = format!("mesh: {e}");
                    report.error = Some(match report.error {
                        Some(prev) => format!("{prev}; {msg}"),
                        None => msg,
                    });
                }
            }
        }
        Ok(report)
    }

    /// Repeat push/pull until a pull returns fewer than one outbox page (initial catch-up).
    pub async fn run_replica_sync_until_caught_up(
        pool: &SqlitePool,
    ) -> Result<SyncRunReport, AppError> {
        let mut last = SyncRunReport {
            push: None,
            pull: None,
            mesh: None,
            error: None,
        };
        for _ in 0..256 {
            last = Self::run_replica_sync(pool).await?;
            let pulled = last
                .pull
                .as_ref()
                .map(|p| p.applied.saturating_add(p.skipped))
                .unwrap_or(0);
            if pulled < 500 {
                break;
            }
        }
        Ok(last)
    }

    pub async fn set_deployment(
        pool: &SqlitePool,
        cfg: crate::deployment::SyncDeploymentConfig,
    ) -> Result<(), AppError> {
        save_deployment(pool, &cfg).await?;
        let local_id = align_local_id_to_activation(pool, &cfg).await?;
        let display = if cfg.device_label.is_empty() {
            "This device"
        } else {
            cfg.device_label.as_str()
        };
        let (peer_url, peer_cert) = if cfg.role == DeviceRole::Replica {
            (
                (!cfg.master_base_url.is_empty()).then_some(cfg.master_base_url.as_str()),
                (!cfg.master_cert_sha256.is_empty()).then_some(cfg.master_cert_sha256.as_str()),
            )
        } else {
            (None, None)
        };
        crate::repo::register_local_device(pool, &local_id, display, cfg.role, peer_url, peer_cert)
            .await?;
        Ok(())
    }
}

async fn find_master_device_id(pool: &SqlitePool) -> Result<String, AppError> {
    let id: Option<String> = sqlx::query_scalar(
        "SELECT device_id FROM sync_device WHERE role = 'MASTER' AND is_local = 0 LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    if let Some(id) = id {
        return Ok(id);
    }
    let local: String = sqlx::query_scalar(
        "SELECT device_id FROM sync_device WHERE role = 'MASTER' AND is_local = 1 LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::Validation("no master device registered".into()))?;
    Ok(local)
}

/// Prefer the deployment's `master_device_id` (set during pairing). Falls
/// back to the sync_device registry when the id is missing.
async fn resolve_master_device_id(
    pool: &SqlitePool,
    deployment: &SyncDeploymentConfig,
) -> Result<String, AppError> {
    if !deployment.master_device_id.is_empty() {
        return Ok(deployment.master_device_id.clone());
    }
    find_master_device_id(pool).await
}

/// Choose the Authorization bearer for replica → master calls. Prefers the
/// new activation token (Ed25519-signed by master); falls back to the
/// legacy JWT for installs paired before Slice 4.
/// `fromDeviceId` has to be the device id baked into the activation token.
/// Join can leave `sync.device_id.v1` as a later fingerprint while the token
/// still names the paired one; the master answers that push with 403.
async fn align_local_id_to_activation(
    pool: &SqlitePool,
    deployment: &SyncDeploymentConfig,
) -> Result<String, AppError> {
    let local_id = ensure_local_device(pool, &deployment.device_label).await?;
    let Some(authorized) = verified_activation_device_id(deployment) else {
        return Ok(local_id);
    };
    if authorized == local_id {
        return Ok(local_id);
    }
    tracing::warn!(
        target: "medoc::sync",
        event = "SYNC_DEVICE_ID_ALIGNED_TO_TOKEN",
        from = %local_id,
        to = %authorized
    );
    crate::repo::adopt_local_device_id(
        pool,
        &local_id,
        &authorized,
        &deployment.device_label,
        deployment.role,
    )
    .await?;
    Ok(authorized)
}

fn verified_activation_device_id(deployment: &SyncDeploymentConfig) -> Option<String> {
    let token = deployment.activation_token.trim();
    let pk = deployment.master_pubkey.trim();
    if token.is_empty() || pk.is_empty() {
        return None;
    }
    let key = crate::master_keys::parse_pubkey_b64(pk).ok()?;
    let payload = crate::pairing::verify_activation_token(token, &key).ok()?;
    let id = payload.device_id.trim();
    if id.is_empty() {
        None
    } else {
        Some(id.to_string())
    }
}

fn pick_bearer(deployment: &SyncDeploymentConfig) -> Result<String, AppError> {
    if !deployment.activation_token.is_empty() {
        return Ok(deployment.activation_token.clone());
    }
    if !deployment.master_access_token.is_empty() {
        return Ok(deployment.master_access_token.clone());
    }
    Err(AppError::Validation(
        "Replica not paired — complete the pairing flow".into(),
    ))
}

async fn relay_payload(
    pool: &SqlitePool,
    entry: &crate::repo::OutboxEntry,
) -> Result<String, AppError> {
    if entry.op == "DELETE" {
        return Ok(entry.payload_json.clone());
    }
    match load_row_payload_json(pool, &entry.entity_table, &entry.entity_id).await? {
        Some(json) => Ok(json),
        None => Ok(entry.payload_json.clone()),
    }
}

fn build_http_client(_cert_sha256: &str) -> Result<reqwest::Client, AppError> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| AppError::Internal(format!("sync http client: {e}")))
}

/// Fetches the signed peer list from the master and verifies the Ed25519
/// signature against the pinned `master_pubkey` from pairing.
async fn fetch_peer_list(
    deployment: &SyncDeploymentConfig,
    bearer_token: &str,
) -> Result<Vec<MeshPeerInfo>, AppError> {
    if deployment.master_base_url.is_empty() {
        return Err(AppError::Validation(
            "master_base_url missing for mesh sync".into(),
        ));
    }
    if deployment.master_pubkey.is_empty() {
        return Err(AppError::Validation(
            "master_pubkey missing for mesh peer-list verification".into(),
        ));
    }
    let url = format!(
        "{}/api/v1/pairing/peers",
        deployment.master_base_url.trim_end_matches('/')
    );
    let client = build_http_client(&deployment.master_cert_sha256)?;
    let resp = client
        .get(&url)
        .bearer_auth(bearer_token)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("peers http: {e}")))?;
    if !resp.status().is_success() {
        return Err(AppError::Internal(format!(
            "peers http status {}",
            resp.status()
        )));
    }
    let body: MeshPeerListResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("peers decode: {e}")))?;
    let canonical = serde_json::json!({
        "masterDeviceId": body.master_device_id,
        "peers": body.peers,
    });
    let bytes = serde_json::to_vec(&canonical)
        .map_err(|e| AppError::Internal(format!("peers canonical json: {e}")))?;
    let pubkey = crate::master_keys::parse_pubkey_b64(&deployment.master_pubkey)?;
    crate::master_keys::verify(&pubkey, &bytes, &body.signature)?;
    Ok(body
        .peers
        .into_iter()
        .map(|p| MeshPeerInfo {
            device_id: p.device_id,
            peer_base_url: p.peer_base_url,
        })
        .collect())
}

async fn push_to_peer(
    pool: &SqlitePool,
    peer_base_url: &str,
    bearer_token: &str,
    local_id: &str,
    target_device_id: &str,
    pending: &[crate::repo::OutboxEntry],
) -> Result<SyncPushResult, AppError> {
    if pending.is_empty() {
        return Ok(SyncPushResult {
            accepted: 0,
            last_seq: 0,
        });
    }
    let last_seq = pending.last().map(|e| e.seq).unwrap_or(0);
    let client = build_http_client("")?;
    let url = format!("{}/api/v1/sync/push", peer_base_url.trim_end_matches('/'));
    let body = serde_json::json!({
        "fromDeviceId": local_id,
        "entries": pending,
    });
    let resp = client
        .post(&url)
        .bearer_auth(bearer_token)
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("peer push http: {e}")))?;
    if !resp.status().is_success() {
        return Err(AppError::Internal(format!(
            "peer push http status {}",
            resp.status()
        )));
    }
    let result: SyncPushResult = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("peer push decode: {e}")))?;
    mark_peer_delivery(pool, local_id, target_device_id, last_seq).await?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::repo::save_deployment;
    use crate::schema::ensure_sync_tables;
    use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};

    #[tokio::test]
    async fn push_ingest_applies_app_kv_row() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");
        let device = ensure_local_device(&pool, "test").await.expect("device");
        let entry = crate::repo::append_outbox(
            &pool,
            &device,
            "app_kv",
            "sync.test.key",
            "INSERT",
            r#"{"key":"sync.test.key","value":"42"}"#,
        )
        .await
        .expect("outbox");
        let result = SyncEngine::ingest_push(&pool, &device, std::slice::from_ref(&entry))
            .await
            .expect("ingest");
        assert_eq!(result.accepted, 1);
    }

    /// Slice 6 regression — replica's locally-newer row must not be clobbered
    /// when the master pushes an older `updated_at`.
    #[tokio::test]
    async fn master_does_not_overwrite_newer_replica_row() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");

        // Seed a local patient row that already has a *newer* updated_at than
        // the incoming master push.
        let id = "00000000-0000-0000-0000-0000000000aa";
        sqlx::query(
            "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number,
                                  phone, email, address, status, created_at, updated_at)
             VALUES (?1, 'Local Newer', '1990-01-01', 'MALE', 'V-A',
                     NULL, NULL, NULL, 'ACTIVE', '2099-01-01 00:00:00', '2099-01-02 00:00:00')",
        )
        .bind(id)
        .execute(&pool)
        .await
        .expect("seed");

        // Outbox entry from a remote (master) device with an *older* updated_at.
        let master_device = "master-device-id";
        let entry = crate::repo::OutboxEntry {
            id: "e1".into(),
            device_id: master_device.into(),
            seq: 1,
            entity_table: "patient".into(),
            entity_id: id.into(),
            op: "UPDATE".into(),
            payload_json: format!(
                r#"{{"id":"{id}","name":"Master Older","updated_at":"2099-01-01T00:00:00Z"}}"#
            ),
            created_at: "2099-01-01T00:00:00Z".into(),
        };

        // Local is REPLICA. The freshness policy should keep the local "Local Newer" row.
        let res = SyncEngine::ingest_push(&pool, master_device, std::slice::from_ref(&entry))
            .await
            .expect("ingest");
        assert_eq!(res.accepted, 1, "applied flag should still be marked");

        let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .expect("read back");
        assert_eq!(name, "Local Newer", "newer local row must be preserved");
    }

    /// Slice 6 — older local row must be overwritten by a newer master push.
    #[tokio::test]
    async fn newer_master_push_overwrites_older_replica_row() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");

        let id = "00000000-0000-0000-0000-0000000000bb";
        sqlx::query(
            "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number,
                                  phone, email, address, status, created_at, updated_at)
             VALUES (?1, 'Local Older', '1990-01-01', 'MALE', 'V-B',
                     NULL, NULL, NULL, 'ACTIVE', '2099-01-01 00:00:00', '2099-01-01 00:00:00')",
        )
        .bind(id)
        .execute(&pool)
        .await
        .expect("seed");

        let master_device = "master-device-id-2";
        let entry = crate::repo::OutboxEntry {
            id: "e2".into(),
            device_id: master_device.into(),
            seq: 1,
            entity_table: "patient".into(),
            entity_id: id.into(),
            op: "UPDATE".into(),
            payload_json: format!(
                r#"{{"id":"{id}","name":"Master Newer","updated_at":"2099-02-01T00:00:00Z"}}"#
            ),
            created_at: "2099-02-01T00:00:00Z".into(),
        };

        SyncEngine::ingest_push(&pool, master_device, std::slice::from_ref(&entry))
            .await
            .expect("ingest");

        let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .expect("read back");
        assert_eq!(
            name, "Master Newer",
            "older local row must yield to newer master push"
        );
    }

    #[tokio::test]
    async fn ingest_push_rejects_outbox_device_id_mismatch() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");
        let device = ensure_local_device(&pool, "local").await.expect("device");
        let entry = crate::repo::append_outbox(
            &pool,
            &device,
            "app_kv",
            "mismatch.key",
            "INSERT",
            r#"{"key":"mismatch.key","value":"1"}"#,
        )
        .await
        .expect("outbox");
        let err = SyncEngine::ingest_push(&pool, "other-device", std::slice::from_ref(&entry))
            .await
            .expect_err("mismatch");
        assert!(matches!(err, medoc_core::error::AppError::Validation(_)));
    }

    #[tokio::test]
    async fn collect_pull_returns_entries_after_since_seq() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");
        let device = ensure_local_device(&pool, "pull-device")
            .await
            .expect("device");
        crate::repo::append_outbox(
            &pool,
            &device,
            "app_kv",
            "pull-a",
            "INSERT",
            r#"{"key":"pull-a","value":"1"}"#,
        )
        .await
        .expect("o1");
        let e2 = crate::repo::append_outbox(
            &pool,
            &device,
            "app_kv",
            "pull-b",
            "INSERT",
            r#"{"key":"pull-b","value":"2"}"#,
        )
        .await
        .expect("o2");
        let pulled = SyncEngine::collect_pull(&pool, &device, 1)
            .await
            .expect("pull");
        assert_eq!(pulled.len(), 1);
        assert_eq!(pulled[0].seq, e2.seq);
    }

    #[tokio::test]
    async fn collect_pull_for_replica_ignores_caller_device_id() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");
        save_deployment(
            &pool,
            &crate::deployment::SyncDeploymentConfig {
                schema_version: 1,
                mode: crate::deployment::DeploymentMode::PracticeDesktop,
                role: crate::deployment::DeviceRole::Master,
                device_label: "Main".into(),
                ..Default::default()
            },
        )
        .await
        .expect("deploy");
        let local = ensure_local_device(&pool, "Main").await.expect("device");
        crate::repo::append_outbox(
            &pool,
            &local,
            "app_kv",
            "from-master",
            "INSERT",
            r#"{"key":"from-master","value":"1"}"#,
        )
        .await
        .expect("outbox");
        let pulled = SyncEngine::collect_pull_for_replica(&pool, "unknown-replica-guess", 0)
            .await
            .expect("pull");
        assert!(
            pulled.iter().any(|e| e.entity_id == "from-master"),
            "master must serve its own outbox, not the replica-supplied device id"
        );
    }

    #[tokio::test]
    async fn master_forwards_its_row_not_a_stale_replica_payload() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");
        save_deployment(
            &pool,
            &crate::deployment::SyncDeploymentConfig {
                schema_version: 1,
                mode: crate::deployment::DeploymentMode::ServerlessPeer,
                role: crate::deployment::DeviceRole::Master,
                device_label: "Main".into(),
                ..Default::default()
            },
        )
        .await
        .expect("deploy");
        let local = ensure_local_device(&pool, "Main").await.expect("device");
        let id = "00000000-0000-0000-0000-0000000000d1";
        sqlx::query(
            "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status, updated_at)
             VALUES (?1, 'Master Newer', '1990-01-01', 'MALE', 'V-STALE', 'ACTIVE', '2099-03-01 00:00:00')",
        )
        .bind(id)
        .execute(&pool)
        .await
        .expect("seed");
        let entry = crate::repo::OutboxEntry {
            id: "stale".into(),
            device_id: "replica-a".into(),
            seq: 4,
            entity_table: "patient".into(),
            entity_id: id.into(),
            op: "UPDATE".into(),
            payload_json: format!(
                r#"{{"id":"{id}","name":"Stale Replica","updated_at":"2099-01-01T00:00:00Z"}}"#
            ),
            created_at: "2099-01-01T00:00:00Z".into(),
        };
        SyncEngine::ingest_push(&pool, "replica-a", std::slice::from_ref(&entry))
            .await
            .expect("ingest");
        let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(name, "Master Newer");
        let forwarded = crate::repo::list_entries_since(&pool, &local, 0)
            .await
            .expect("outbox");
        let row = forwarded
            .iter()
            .find(|e| e.entity_id == id)
            .expect("stale push must still be relayed from the master's current row");
        assert!(row.payload_json.contains("Master Newer"));
        assert!(!row.payload_json.contains("Stale Replica"));
    }

    #[tokio::test]
    async fn replica_does_not_relay_a_peer_push() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");
        save_deployment(
            &pool,
            &crate::deployment::SyncDeploymentConfig {
                schema_version: 1,
                mode: crate::deployment::DeploymentMode::ServerlessPeer,
                role: crate::deployment::DeviceRole::Replica,
                device_label: "Replica".into(),
                ..Default::default()
            },
        )
        .await
        .expect("deploy");
        let local = ensure_local_device(&pool, "Replica").await.expect("device");
        let id = "00000000-0000-0000-0000-0000000000d2";
        let entry = crate::repo::OutboxEntry {
            id: "peer".into(),
            device_id: "replica-a".into(),
            seq: 1,
            entity_table: "patient".into(),
            entity_id: id.into(),
            op: "INSERT".into(),
            payload_json: format!(
                r#"{{"id":"{id}","name":"Peer","date_of_birth":"1990-01-01","sex":"MALE","insurance_number":"V-PEER","status":"ACTIVE","updated_at":"2099-01-01T00:00:00Z"}}"#
            ),
            created_at: "2099-01-01T00:00:00Z".into(),
        };
        SyncEngine::ingest_push(&pool, "replica-a", std::slice::from_ref(&entry))
            .await
            .expect("ingest");
        let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox WHERE device_id = ?1")
            .bind(&local)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(n, 0);
    }

    #[tokio::test]
    async fn align_moves_pending_outbox_onto_the_activation_token_device() {
        use ed25519_dalek::SigningKey;
        use rand::rngs::OsRng;

        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");
        let signing_key = SigningKey::generate(&mut OsRng);
        let authorized = "authorized-replica";
        let token = crate::pairing::mint_activation_token(
            &signing_key,
            &crate::pairing::ActivationTokenPayload {
                version: 2,
                device_id: authorized.into(),
                slave_label: "Replica".into(),
                master_device_id: "master".into(),
                allowed_actions: vec!["sync.push".into()],
                issued_at: "2026-11-06T00:00:00Z".into(),
                nonce: "n".into(),
            },
        )
        .expect("mint");
        medoc_core::infrastructure::database::app_kv_repo::set(
            &pool,
            crate::deployment::APP_KV_DEVICE_ID_KEY,
            "local-wrong",
        )
        .await
        .expect("kv");
        ensure_local_device(&pool, "Replica").await.expect("device");
        crate::repo::append_outbox(
            &pool,
            "local-wrong",
            "app_kv",
            "pending-key",
            "INSERT",
            r#"{"key":"pending-key","value":"1"}"#,
        )
        .await
        .expect("outbox");
        let cfg = crate::deployment::SyncDeploymentConfig {
            schema_version: 1,
            mode: crate::deployment::DeploymentMode::ServerlessPeer,
            role: crate::deployment::DeviceRole::Replica,
            device_label: "Replica".into(),
            activation_token: token,
            master_pubkey: crate::master_keys::pubkey_b64(&signing_key),
            ..Default::default()
        };
        let id = align_local_id_to_activation(&pool, &cfg)
            .await
            .expect("align");
        assert_eq!(id, authorized);
        let pending = crate::repo::list_pending_outbox(&pool, authorized)
            .await
            .expect("pending");
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].device_id, authorized);
        let stored = medoc_core::infrastructure::database::app_kv_repo::get(
            &pool,
            crate::deployment::APP_KV_DEVICE_ID_KEY,
        )
        .await
        .expect("read")
        .expect("device id");
        assert_eq!(stored, authorized);
        let wrong: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox WHERE device_id = 'local-wrong'")
                .fetch_one(&pool)
                .await
                .expect("count");
        assert_eq!(wrong, 0);
    }
}
