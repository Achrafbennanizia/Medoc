//! Cluster teardown: owner-initiated network reset with signed broadcast to members.

use std::path::Path;

use chrono::Utc;
use medoc_core::error::AppError;
use medoc_core::infrastructure::database::app_kv_repo;
use medoc_core::infrastructure::license_repo;
use medoc_core::infrastructure::secret_store;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::master_keys;
use crate::net::reset_broadcast::{broadcast_cluster_reset, MemberResetTarget};
use crate::verbund::crypto::DeviceIdentity;
use crate::verbund::enums::{GeraetStatus, SeatRolle};
use crate::verbund::ports::{GeraetRepo, LizenzRepo, SqliteVerbundRepos};
use crate::verbund::services::audit;
use crate::verbund::services::lizenz_service::{require_owner_admin, verbund_status};

pub const KV_CLUSTER_RESET_PENDING: &str = "verbund.cluster_reset_pending.v1";
pub const KV_CLUSTER_CA_PUBKEY: &str = "verbund.cluster_ca_pubkey.v1";

const KEYCHAIN_DEVICE: &str = "verbund-device-signing-key";
const KEYCHAIN_MASTER: &str = "pairing-master-signing-key";
const KEYCHAIN_SQLCIPHER: &str = "sqlcipher-key";

const NETWORK_KV_KEYS: &[&str] = &[
    license_repo::KEY_V1,
    license_repo::KEY_V2,
    license_repo::KEY_DEVICE_ID,
    "sync.device_id.v1",
    "onboarding.setup_complete.v1",
    "company.portal.config.v1",
    "sync.deployment.v1",
    "pairing.enabled.v1",
    "migration.demo_seed.v1",
    KV_CLUSTER_CA_PUBKEY,
    KV_CLUSTER_RESET_PENDING,
];

const NETWORK_KV_PREFIXES: &[&str] = &["onboarding.progress.v1."];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClusterResetMode {
    NetworkOnly,
    FullLocalWipe,
}

impl ClusterResetMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::NetworkOnly => "network_only",
            Self::FullLocalWipe => "full_wipe",
        }
    }

    pub fn parse(raw: &str) -> Result<Self, AppError> {
        match raw.trim() {
            "network_only" => Ok(Self::NetworkOnly),
            "full_wipe" => Ok(Self::FullLocalWipe),
            _ => Err(AppError::Validation(
                "Reset mode must be network_only or full_wipe.".into(),
            )),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterResetToken {
    pub reset_id: String,
    pub cluster_id: String,
    pub mode: String,
    pub issued_at: String,
    pub cluster_ca_pubkey_b64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterResetPending {
    pub token_json: String,
    pub signature_b64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterResetPreview {
    pub cluster_id: Option<String>,
    pub member_device_count: u32,
    pub confirm_phrase_hint: String,
    pub practice_slug: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterResetReport {
    pub mode: String,
    pub members_notified: u32,
    pub members_unreachable: Vec<String>,
    pub requires_app_restart: bool,
}

pub fn mint_reset_token(cluster_id: &str, mode: ClusterResetMode) -> Result<ClusterResetToken, AppError> {
    let sk = master_keys::load_or_create()?;
    Ok(ClusterResetToken {
        reset_id: Uuid::new_v4().to_string(),
        cluster_id: cluster_id.to_string(),
        mode: mode.as_str().to_string(),
        issued_at: Utc::now().to_rfc3339(),
        cluster_ca_pubkey_b64: master_keys::pubkey_b64(&sk),
    })
}

pub fn sign_reset_token(token: &ClusterResetToken) -> Result<(String, String), AppError> {
    let token_json = serde_json::to_string(token)
        .map_err(|e| AppError::Internal(format!("reset token json: {e}")))?;
    let sk = master_keys::load_or_create()?;
    let signature_b64 = master_keys::sign(&sk, token_json.as_bytes());
    Ok((token_json, signature_b64))
}

pub fn verify_reset_token_with_pubkey(
    token_json: &str,
    signature_b64: &str,
    pinned_pubkey_b64: &str,
) -> Result<ClusterResetToken, AppError> {
    let pubkey = master_keys::parse_pubkey_b64(pinned_pubkey_b64)?;
    master_keys::verify(&pubkey, token_json.as_bytes(), signature_b64)?;
    serde_json::from_str(token_json)
        .map_err(|e| AppError::Validation(format!("Reset token invalid: {e}")))
}

pub async fn verify_reset_token(
    pool: &SqlitePool,
    token_json: &str,
    signature_b64: &str,
) -> Result<ClusterResetToken, AppError> {
    let token: ClusterResetToken = serde_json::from_str(token_json)
        .map_err(|e| AppError::Validation(format!("Reset token invalid: {e}")))?;
    if !token.cluster_ca_pubkey_b64.is_empty() {
        verify_reset_token_with_pubkey(token_json, signature_b64, &token.cluster_ca_pubkey_b64)?;
        return Ok(token);
    }
    let pinned = read_pinned_cluster_ca_pubkey(pool)
        .await?
        .unwrap_or_else(|| {
            master_keys::pubkey_b64(
                &master_keys::load_or_create().expect("master signing key"),
            )
        });
    verify_reset_token_with_pubkey(token_json, signature_b64, &pinned)?;
    Ok(token)
}

pub async fn read_pinned_cluster_ca_pubkey(pool: &SqlitePool) -> Result<Option<String>, AppError> {
    app_kv_repo::get(pool, KV_CLUSTER_CA_PUBKEY).await
}

pub async fn persist_cluster_ca_pubkey(pool: &SqlitePool) -> Result<(), AppError> {
    let sk = master_keys::load_or_create()?;
    let b64 = master_keys::pubkey_b64(&sk);
    app_kv_repo::set(pool, KV_CLUSTER_CA_PUBKEY, &b64).await
}

pub async fn store_pending_reset(pool: &SqlitePool, pending: &ClusterResetPending) -> Result<(), AppError> {
    let raw = serde_json::to_string(pending)
        .map_err(|e| AppError::Internal(format!("pending reset json: {e}")))?;
    app_kv_repo::set(pool, KV_CLUSTER_RESET_PENDING, &raw).await
}

pub async fn load_pending_reset(pool: &SqlitePool) -> Result<Option<ClusterResetPending>, AppError> {
    let Some(raw) = app_kv_repo::get(pool, KV_CLUSTER_RESET_PENDING).await? else {
        return Ok(None);
    };
    serde_json::from_str(&raw)
        .map_err(|e| AppError::Internal(format!("pending reset parse: {e}")))
        .map(Some)
}

pub async fn clear_pending_reset(pool: &SqlitePool) -> Result<(), AppError> {
    app_kv_repo::delete(pool, KV_CLUSTER_RESET_PENDING).await
}

pub async fn cluster_reset_preview(pool: &SqlitePool) -> Result<ClusterResetPreview, AppError> {
    require_owner_admin(pool).await?;
    let vs = verbund_status(pool).await?;
    let cluster_id = vs.cluster_id.clone();
    let devices = list_member_targets(pool).await?;
    let practice_slug = app_kv_repo::get(pool, "company.portal.config.v1")
        .await
        .ok()
        .flatten()
        .and_then(|raw| {
            serde_json::from_str::<serde_json::Value>(&raw)
                .ok()
                .and_then(|v| {
                    v.get("practiceSlug")
                        .or_else(|| v.get("practice_slug"))
                        .and_then(|s| s.as_str())
                        .map(str::to_string)
                })
        });
    let confirm_phrase_hint = practice_slug.clone().unwrap_or_else(|| {
        cluster_id
            .as_ref()
            .map(|id| format!("RESET-{}", &id[..id.len().min(8)]))
            .unwrap_or_else(|| "RESET".into())
    });
    Ok(ClusterResetPreview {
        cluster_id,
        member_device_count: devices.len() as u32,
        confirm_phrase_hint,
        practice_slug,
    })
}

async fn list_member_targets(pool: &SqlitePool) -> Result<Vec<MemberResetTarget>, AppError> {
    let identity = DeviceIdentity::load_or_create()?;
    let local_fp = identity.fingerprint;
    let repos = SqliteVerbundRepos { pool };
    let Some(lizenz) = repos.load().await? else {
        return Ok(vec![]);
    };
    let all = repos.list_active(&lizenz.cluster_id).await?;
    Ok(all
        .into_iter()
        .filter(|g| {
            g.fingerprint != local_fp
                && g.seat_role != SeatRolle::Admin
                && g.status == GeraetStatus::Active
        })
        .filter_map(|g| {
            let ip = g.last_ip.filter(|s| !s.trim().is_empty())?;
            Some(MemberResetTarget {
                fingerprint: g.fingerprint,
                ip,
            })
        })
        .collect())
}

async fn revoke_all_remote_devices(pool: &SqlitePool, actor_user_id: &str) -> Result<(), AppError> {
    let identity = DeviceIdentity::load_or_create()?;
    let local_fp = identity.fingerprint;
    let repos = SqliteVerbundRepos { pool };
    let Some(lizenz) = repos.load().await? else {
        return Ok(());
    };
    for g in repos.list_active(&lizenz.cluster_id).await? {
        if g.fingerprint == local_fp {
            continue;
        }
        repos.set_status(&g.fingerprint, GeraetStatus::Revoked).await?;
        repos
            .block(&g.fingerprint, "cluster_reset")
            .await
            .ok();
        audit::log_verbund(
            pool,
            actor_user_id,
            "CLUSTER_RESET_REVOKE",
            Some(&g.fingerprint),
            None,
        )
        .await
        .ok();
    }
    Ok(())
}

async fn wipe_network_tables(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query("DELETE FROM pairing_request")
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    sqlx::query("DELETE FROM geraet_blocklist")
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    sqlx::query("DELETE FROM provisioning_state")
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    sqlx::query("DELETE FROM sync_device")
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    sqlx::query("DELETE FROM lizenz")
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

async fn delete_app_kv_by_prefix(pool: &SqlitePool, prefix: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM app_kv WHERE key LIKE ?1 || '%'")
        .bind(prefix)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

async fn wipe_network_kv(pool: &SqlitePool) -> Result<(), AppError> {
    license_repo::clear(pool).await?;
    for key in NETWORK_KV_KEYS {
        if let Err(e) = app_kv_repo::delete(pool, key).await {
            tracing::warn!(
                target: "medoc::verbund",
                event = "CLUSTER_RESET_KV_DELETE_FAILED",
                key,
                error = %e
            );
        }
    }
    for prefix in NETWORK_KV_PREFIXES {
        if let Err(e) = delete_app_kv_by_prefix(pool, prefix).await {
            tracing::warn!(
                target: "medoc::verbund",
                event = "CLUSTER_RESET_KV_PREFIX_DELETE_FAILED",
                prefix,
                error = %e
            );
        }
    }
    Ok(())
}

fn wipe_device_keychain() -> Result<(), AppError> {
    secret_store::delete_account(KEYCHAIN_DEVICE)?;
    secret_store::delete_account(KEYCHAIN_MASTER)?;
    Ok(())
}

fn wipe_full_database_files(app_data_dir: &Path) -> Result<(), AppError> {
    let db_path = app_data_dir.join("medoc.db");
    for path in [
        db_path.clone(),
        app_data_dir.join("medoc.db-wal"),
        app_data_dir.join("medoc.db-shm"),
        app_data_dir.join("db-key.wrap"),
        app_data_dir.join("db-key.salt"),
    ] {
        if path.exists() {
            std::fs::remove_file(&path).map_err(|e| {
                AppError::Internal(format!("Could not delete file {}: {e}", path.display()))
            })?;
        }
    }
    secret_store::delete_account(KEYCHAIN_SQLCIPHER)?;
    Ok(())
}

async fn wipe_local_state(
    pool: &SqlitePool,
    app_data_dir: &Path,
    mode: ClusterResetMode,
) -> Result<(), AppError> {
    wipe_network_tables(pool).await?;
    wipe_network_kv(pool).await?;
    wipe_device_keychain()?;
    if mode == ClusterResetMode::FullLocalWipe {
        pool.close().await;
        wipe_full_database_files(app_data_dir)?;
    }
    Ok(())
}

/// Wipe license, verbund mesh, onboarding, and device keychain keys.
/// Used by cluster reset and settings "Remove license".
pub async fn wipe_desktop_network_state(
    pool: &SqlitePool,
    app_data_dir: &Path,
    mode: ClusterResetMode,
) -> Result<(), AppError> {
    wipe_local_state(pool, app_data_dir, mode).await
}

/// Owner device: broadcast, revoke peers, wipe local state.
pub async fn execute_owner_cluster_reset(
    pool: &SqlitePool,
    app_data_dir: &Path,
    actor_user_id: &str,
    mode: ClusterResetMode,
) -> Result<ClusterResetReport, AppError> {
    require_owner_admin(pool).await?;
    let vs = verbund_status(pool).await?;
    let cluster_id = vs.cluster_id.clone().unwrap_or_else(|| {
        tracing::warn!(
            target: "medoc::verbund",
            event = "CLUSTER_RESET_NO_CLUSTER_ID",
            "Local-only reset without persisted cluster row"
        );
        format!("local-{}", Uuid::new_v4())
    });

    audit::log_verbund(
        pool,
        actor_user_id,
        "CLUSTER_RESET_REQUESTED",
        Some(&cluster_id),
        Some(mode.as_str()),
    )
    .await?;

    let token = mint_reset_token(&cluster_id, mode)?;
    let (token_json, signature_b64) = sign_reset_token(&token)?;
    let pending = ClusterResetPending {
        token_json: token_json.clone(),
        signature_b64: signature_b64.clone(),
    };
    store_pending_reset(pool, &pending).await?;

    let targets = list_member_targets(pool).await?;
    let broadcast = broadcast_cluster_reset(&targets, &token_json, &signature_b64).await;

    revoke_all_remote_devices(pool, actor_user_id).await?;

    audit::log_verbund(
        pool,
        actor_user_id,
        "CLUSTER_RESET_COMPLETE",
        Some(&cluster_id),
        Some(mode.as_str()),
    )
    .await?;

    wipe_local_state(pool, app_data_dir, mode).await?;

    Ok(ClusterResetReport {
        mode: mode.as_str().to_string(),
        members_notified: broadcast.notified,
        members_unreachable: broadcast.unreachable,
        requires_app_restart: true,
    })
}

/// Member device: apply a verified remote reset (no password — signature is the auth).
pub async fn execute_member_cluster_reset(
    pool: &SqlitePool,
    app_data_dir: &Path,
    token_json: &str,
    signature_b64: &str,
) -> Result<ClusterResetReport, AppError> {
    let token = verify_reset_token(pool, token_json, signature_b64).await?;
    let mode = ClusterResetMode::parse(&token.mode)?;
    audit::log_verbund(
        pool,
        "cluster-reset",
        "CLUSTER_RESET_APPLIED",
        Some(&token.cluster_id),
        Some(mode.as_str()),
    )
    .await
    .ok();
    wipe_local_state(pool, app_data_dir, mode).await?;
    Ok(ClusterResetReport {
        mode: mode.as_str().to_string(),
        members_notified: 0,
        members_unreachable: vec![],
        requires_app_restart: true,
    })
}

/// Queue a verified remote reset for the background applier (inbound TCP handler).
pub async fn queue_verified_remote_reset(
    pool: &SqlitePool,
    token_json: &str,
    signature_b64: &str,
) -> Result<(), AppError> {
    verify_reset_token(pool, token_json, signature_b64).await?;
    store_pending_reset(
        pool,
        &ClusterResetPending {
            token_json: token_json.to_string(),
            signature_b64: signature_b64.to_string(),
        },
    )
    .await
}

/// Apply queued reset if present (member background watch).
pub async fn apply_queued_remote_reset_if_any(
    pool: &SqlitePool,
    app_data_dir: &Path,
) -> Result<Option<ClusterResetReport>, AppError> {
    let Some(pending) = load_pending_reset(pool).await? else {
        return Ok(None);
    };
    let report = execute_member_cluster_reset(
        pool,
        app_data_dir,
        &pending.token_json,
        &pending.signature_b64,
    )
    .await?;
    Ok(Some(report))
}

#[cfg(test)]
mod tests {
    use super::*;
    use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
    use medoc_core::infrastructure::database::license_repo;

    #[test]
    fn reset_token_sign_verify_roundtrip() {
        std::env::set_var(
            "MEDOC_PAIRING_MASTER_SECRET",
            "8762be1a9a0963f36d98d47c0de6a73a0124b77d3268c170365824a6045d2fbf",
        );
        let token = mint_reset_token("cluster-abc", ClusterResetMode::NetworkOnly).expect("mint");
        let (json, sig) = sign_reset_token(&token).expect("sign");
        let sk = master_keys::load_or_create().expect("key");
        let pk = master_keys::pubkey_b64(&sk);
        let parsed = verify_reset_token_with_pubkey(&json, &sig, &pk).expect("verify");
        assert_eq!(parsed.cluster_id, "cluster-abc");
        assert_eq!(parsed.mode, "network_only");
    }

    #[tokio::test]
    async fn wipe_network_kv_clears_license_and_onboarding_keys() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");

        license_repo::store_v2(&pool, "v2.AAA.BBB").await.unwrap();
        app_kv_repo::set(&pool, "onboarding.setup_complete.v1", "1")
            .await
            .unwrap();
        app_kv_repo::set(&pool, "onboarding.progress.v1.arzt", "{}")
            .await
            .unwrap();
        app_kv_repo::set(&pool, "sync.device_id.v1", "device-123")
            .await
            .unwrap();

        wipe_network_kv(&pool).await.unwrap();

        assert!(license_repo::load_v2(&pool).await.unwrap().is_none());
        assert!(
            app_kv_repo::get(&pool, "onboarding.setup_complete.v1")
                .await
                .unwrap()
                .is_none()
        );
        assert!(
            app_kv_repo::get(&pool, "onboarding.progress.v1.arzt")
                .await
                .unwrap()
                .is_none()
        );
        assert!(
            app_kv_repo::get(&pool, "sync.device_id.v1")
                .await
                .unwrap()
                .is_none()
        );
    }
}
