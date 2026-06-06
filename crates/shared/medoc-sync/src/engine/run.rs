use std::time::Duration;

use medoc_core::error::AppError;
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
use crate::merge::{apply_remote_entry, ConflictPolicy};
use crate::repo::{
    ensure_local_device, list_entries_since, list_pending_outbox, list_pending_outbox_for_peer,
    load_deployment, mark_outbox_delivered, mark_peer_delivery, save_deployment, status_snapshot,
    SyncStatusSnapshot,
};

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
        let mut accepted = 0u32;
        let mut last_seq = 0i64;
        for entry in entries {
            if entry.device_id != from_device_id {
                return Err(AppError::Validation("sync push device_id mismatch".into()));
            }
            if apply_remote_entry(
                pool,
                local_is_master,
                ConflictPolicy::MasterWinsWithFreshness,
                entry,
            )
            .await?
            {
                accepted += 1;
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
        let local_id = ensure_local_device(pool, &deployment.device_label).await?;
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
        let master_device_id = resolve_master_device_id(pool, &deployment).await?;
        let since_seq = vectors.get(&master_device_id).copied().unwrap_or(0);
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
        let mut applied = 0u32;
        let mut skipped = 0u32;
        for entry in &pulled.entries {
            if apply_remote_entry(pool, false, ConflictPolicy::MasterWinsWithFreshness, entry)
                .await?
            {
                applied += 1;
            } else {
                skipped += 1;
            }
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

    /// Bidirectional sync for serverless replica (push then pull).
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

    pub async fn set_deployment(
        pool: &SqlitePool,
        cfg: crate::deployment::SyncDeploymentConfig,
    ) -> Result<(), AppError> {
        let local_id = ensure_local_device(pool, &cfg.device_label).await?;
        save_deployment(pool, &cfg).await?;
        crate::repo::register_peer(
            pool,
            &local_id,
            if cfg.device_label.is_empty() {
                "Dieses Gerät"
            } else {
                &cfg.device_label
            },
            cfg.role,
            if cfg.master_base_url.is_empty() {
                None
            } else {
                Some(cfg.master_base_url.as_str())
            },
            if cfg.master_cert_sha256.is_empty() {
                None
            } else {
                Some(cfg.master_cert_sha256.as_str())
            },
        )
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
fn pick_bearer(deployment: &SyncDeploymentConfig) -> Result<String, AppError> {
    if !deployment.activation_token.is_empty() {
        return Ok(deployment.activation_token.clone());
    }
    if !deployment.master_access_token.is_empty() {
        return Ok(deployment.master_access_token.clone());
    }
    Err(AppError::Validation(
        "Replica nicht gekoppelt — Pairing-Maske ausführen".into(),
    ))
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
            "INSERT INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer,
                                  telefon, email, adresse, status, created_at, updated_at)
             VALUES (?1, 'Local Newer', '1990-01-01', 'MAENNLICH', 'V-A',
                     NULL, NULL, NULL, 'AKTIV', '2099-01-01 00:00:00', '2099-01-02 00:00:00')",
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
            "INSERT INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer,
                                  telefon, email, adresse, status, created_at, updated_at)
             VALUES (?1, 'Local Older', '1990-01-01', 'MAENNLICH', 'V-B',
                     NULL, NULL, NULL, 'AKTIV', '2099-01-01 00:00:00', '2099-01-01 00:00:00')",
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
}
