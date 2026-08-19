//! Cluster license activation and validation.

use chrono::Utc;
use medoc_core::error::AppError;
use medoc_core::infrastructure::license::{self, LicenseStatus};
use medoc_core::infrastructure::license_repo;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::master_keys;
use crate::cluster::crypto::DeviceIdentity;
use crate::cluster::entities::{Device, License, SeatUsage};
use crate::cluster::enums::{DeviceStatus, SeatRole};
use crate::cluster::ports::{mark_provisioned, DeviceRepo, LicenseRepo, SqliteClusterRepos};
use crate::cluster::seat_budget::seat_budget_from_edition;

use super::audit;

fn edition_from_status(status: &LicenseStatus) -> String {
    if let Some(v2) = &status.license_v2 {
        return v2.edition.clone();
    }
    if let Some(v1) = &status.license {
        return v1.edition.clone();
    }
    "BASIC".into()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterStatus {
    pub licensed: bool,
    pub provisioned: bool,
    pub is_owner: bool,
    pub cluster_id: Option<String>,
    pub seat_usage: Option<SeatUsage>,
    pub local_fingerprint: Option<String>,
    pub license_valid: bool,
    pub license_format: Option<String>,
    /// Local device row lacks fingerprint/pubkey after migration — must re-join cluster.
    pub needs_reprovision: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportActivationResult {
    pub status: ClusterStatus,
    pub manifest_removed: bool,
    pub cluster_id: Option<String>,
    pub device_fingerprint: Option<String>,
    pub requires_app_reload: bool,
}

/// Whether the local install may bind the cluster network listener.
pub fn cluster_network_ready(status: &ClusterStatus) -> bool {
    if status.is_owner {
        status.licensed
    } else {
        status.licensed || status.provisioned
    }
}

/// Pre-login onboarding gate: owners require vendor license; members may pass on provisioned.
pub fn needs_cluster_onboarding(status: &ClusterStatus) -> bool {
    !status.licensed && !(status.provisioned && !status.is_owner)
}

/// Owner admin pairing requires a valid vendor license envelope.
pub async fn require_owner_vendor_license(pool: &SqlitePool) -> Result<(), AppError> {
    let status = license_repo::current_status(pool).await?;
    if status.valid {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}

/// Owner admin mutators: local ADMIN seat plus valid vendor license in `app_kv`.
pub async fn require_owner_admin(pool: &SqlitePool) -> Result<(), AppError> {
    let status = cluster_status(pool).await?;
    if !status.is_owner {
        return Err(AppError::Forbidden);
    }
    require_owner_vendor_license(pool).await
}

async fn mark_owner_provisioned_if_ready(pool: &SqlitePool) -> Result<(), AppError> {
    let identity = DeviceIdentity::load_or_create()?;
    if super::provisioning_service::is_local_provisioned(pool, &identity.fingerprint).await? {
        return Ok(());
    }
    mark_provisioned(pool, &identity.fingerprint).await
}

/// Only the cluster owner admin may import CA manifests or activate cluster license.
pub async fn require_owner_activation_device(pool: &SqlitePool) -> Result<(), AppError> {
    let status = cluster_status(pool).await?;
    if status.cluster_id.is_some() && !status.is_owner {
        return Err(AppError::Forbidden);
    }
    if status.provisioned && !status.is_owner {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

/// Activate vendor license and create cluster + first ADMIN seat.
/// When keys were pre-imported via [`crate::cluster::activation::import_owner_activation`],
/// only the license envelope and seat budgets are updated.
pub async fn activate_cluster_license(
    pool: &SqlitePool,
    user_id: &str,
    license_key: &str,
) -> Result<ClusterStatus, AppError> {
    require_owner_activation_device(pool).await?;
    let device_id = license_repo::ensure_device_id(pool).await?;
    let status = license::verify(license_key, &device_id);
    if !status.valid {
        return cluster_status(pool).await;
    }
    match status.format.as_deref() {
        Some("v2") => license_repo::store_v2(pool, license_key.trim()).await?,
        Some("v1") => license_repo::store_v1(pool, license_key.trim()).await?,
        _ => {}
    }

    let repos = SqliteClusterRepos { pool };
    let budget = seat_budget_from_edition(&edition_from_status(&status));

    if let Some(mut existing) = repos.load().await? {
        existing.license_ref = license_key.trim().to_string();
        existing.max_total = budget.max_total;
        existing.max_admin = budget.max_admin;
        existing.max_member = budget.max_member;
        repos.save(&existing).await?;
        mark_owner_provisioned_if_ready(pool).await?;
        audit::log_cluster(
            pool,
            user_id,
            "LICENSE_ACTIVATE",
            Some(&existing.cluster_id),
            Some("vendor license applied to imported cluster"),
        )
        .await?;
        return cluster_status(pool).await;
    }

    let identity = DeviceIdentity::load_or_create()?;
    let cluster_id = Uuid::new_v4().to_string();
    let signing_key = master_keys::load_or_create()?;
    let signing_key_enc = signing_key.to_bytes().to_vec();

    let license = License {
        cluster_id: cluster_id.clone(),
        license_ref: license_key.trim().to_string(),
        signing_key_enc,
        max_total: budget.max_total,
        max_admin: budget.max_admin,
        max_member: budget.max_member,
        activated_at: Utc::now(),
    };

    repos.save(&license).await?;

    let device = Device {
        fingerprint: identity.fingerprint.clone(),
        cluster_id: cluster_id.clone(),
        device_id: device_id.clone(),
        pubkey: identity.pubkey_bytes.to_vec(),
        hostname: None,
        os: Some(std::env::consts::OS.into()),
        last_ip: None,
        seat_role: SeatRole::Admin,
        status: DeviceStatus::Active,
        seat_cert: None,
        last_seen: Some(Utc::now()),
        created_at: Utc::now(),
    };
    repos.upsert(&device).await?;
    mark_owner_provisioned_if_ready(pool).await?;

    audit::log_cluster(
        pool,
        user_id,
        "LICENSE_ACTIVATE",
        Some(&cluster_id),
        Some("first ADMIN seat"),
    )
    .await?;

    cluster_status(pool).await
}

pub async fn cluster_status(pool: &SqlitePool) -> Result<ClusterStatus, AppError> {
    let license = license_repo::current_status(pool).await.ok();
    let licensed = license.as_ref().map(|s| s.valid).unwrap_or(false);

    let repos = SqliteClusterRepos { pool };
    let license = repos.load().await?;
    // Prefer an existing keychain identity; only mint when the cluster is already provisioned.
    let identity = if license.is_some() {
        DeviceIdentity::try_load()
            .ok()
            .flatten()
            .or_else(|| DeviceIdentity::load_or_create().ok())
    } else {
        DeviceIdentity::try_load().ok().flatten()
    };
    let fp = identity.as_ref().map(|i| i.fingerprint.clone());
    let provisioned = if let Some(ref f) = fp {
        super::provisioning_service::is_local_provisioned(pool, f).await?
    } else {
        false
    };

    let mut needs_reprovision = false;
    let (cluster_id, seat_usage, is_owner) = if let Some(ref l) = license {
        let usage = repos.seat_usage(&l.cluster_id).await?;
        let mut is_owner = if let Some(ref f) = fp {
            let device = repos.find_by_fingerprint(f).await?;
            if let Some(ref g) = device {
                needs_reprovision = !g.identity_complete();
            }
            device
                .map(|g| {
                    g.identity_complete()
                        && g.seat_role == SeatRole::Admin
                        && g.status == DeviceStatus::Active
                })
                .unwrap_or(false)
        } else {
            false
        };
        if !is_owner {
            if let Ok(device_id) = license_repo::ensure_device_id(pool).await {
                if let Some(g) =
                    crate::cluster::repo::find_by_device_id(pool, &device_id, &l.cluster_id).await?
                {
                    needs_reprovision = !g.identity_complete();
                    is_owner = g.identity_complete()
                        && g.seat_role == SeatRole::Admin
                        && g.status == DeviceStatus::Active;
                }
            }
        }
        (Some(l.cluster_id.clone()), Some(usage), is_owner)
    } else {
        (None, None, false)
    };

    Ok(ClusterStatus {
        licensed,
        provisioned,
        is_owner,
        cluster_id,
        seat_usage,
        local_fingerprint: fp,
        license_valid: license.as_ref().map(|s| s.valid).unwrap_or(false),
        license_format: license.and_then(|s| s.format),
        needs_reprovision,
    })
}

#[cfg(test)]
mod tests {
    use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
    use ed25519_dalek::Signer;
    use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
    use medoc_core::infrastructure::license::{encrypt_v2_for_device, LicenseV2, VENDOR_PUBKEY};
    use serial_test::serial;
    use crate::schema::ensure_sync_tables;
    use chrono::{TimeZone, Utc};

    use super::*;
    use crate::master_keys;
    use crate::cluster::enums::{DeviceStatus, SeatRole};
    use crate::cluster::ports::SqliteClusterRepos;

    const TEST_SIGNING_KEY_HEX: &str =
        "8762be1a9a0963f36d98d47c0de6a73a0124b77d3268c170365824a6045d2fbf";
    const TEST_DEVICE_SECRET: &str =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const TEST_MASTER_SECRET: &str =
        "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

    fn sign_v2_envelope(device_id: &str) -> String {
        let lic = LicenseV2 {
            version: 2,
            customer_id: "practice-test".into(),
            edition: "BASIC".into(),
            device_id: device_id.into(),
            activated_at: Utc.with_ymd_and_hms(2026, 6, 16, 12, 0, 0).unwrap(),
            max_users: 2,
            modules: vec![],
            edition_features: vec![],
        };
        let body = serde_json::to_string(&lic).unwrap();
        let mut sk_bytes = [0u8; 32];
        for (i, chunk) in TEST_SIGNING_KEY_HEX.as_bytes().chunks(2).enumerate() {
            sk_bytes[i] = u8::from_str_radix(std::str::from_utf8(chunk).unwrap(), 16).unwrap();
        }
        let sk = ed25519_dalek::SigningKey::from_bytes(&sk_bytes);
        assert_eq!(sk.verifying_key().to_bytes(), VENDOR_PUBKEY);
        let sig_b64 = STANDARD_NO_PAD.encode(sk.sign(body.as_bytes()).to_bytes());
        let signed = format!("{body}.{sig_b64}");
        encrypt_v2_for_device(&signed, device_id).expect("encrypt")
    }

    async fn fresh_pool() -> sqlx::SqlitePool {
        let audit_dir = std::env::temp_dir().join(format!(
            "medoc-sync-test-audit-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&audit_dir).expect("audit dir");
        medoc_core::infrastructure::database::audit_repo::init_audit_hmac_key(&audit_dir)
            .expect("audit key");

        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");
        pool
    }

    #[tokio::test]
    #[serial]
    async fn activate_preserves_imported_cluster_and_keys() {
        std::env::set_var("MEDOC_CLUSTER_DEVICE_SECRET", TEST_DEVICE_SECRET);
        std::env::set_var("MEDOC_PAIRING_MASTER_SECRET", TEST_MASTER_SECRET);

        let pool = fresh_pool().await;
        let cluster_id = uuid::Uuid::new_v4().to_string();
        let identity = DeviceIdentity::load_or_create().expect("identity");
        let fp_before = identity.fingerprint.clone();
        let master_before = master_keys::load_or_create().expect("master").to_bytes();

        let repos = SqliteClusterRepos { pool: &pool };
        repos
            .save(&License {
                cluster_id: cluster_id.clone(),
                license_ref: String::new(),
                signing_key_enc: master_before.to_vec(),
                max_total: 2,
                max_admin: 1,
                max_member: 1,
                activated_at: Utc::now(),
            })
            .await
            .expect("license");

        let device_id = license_repo::ensure_device_id(&pool).await.expect("device id");
        repos
            .upsert(&Device {
                fingerprint: fp_before.clone(),
                cluster_id: cluster_id.clone(),
                device_id: device_id.clone(),
                pubkey: identity.pubkey_bytes.to_vec(),
                hostname: None,
                os: Some("test".into()),
                last_ip: None,
                seat_role: SeatRole::Admin,
                status: DeviceStatus::Active,
                seat_cert: None,
                last_seen: Some(Utc::now()),
                created_at: Utc::now(),
            })
            .await
            .expect("device");

        let before = cluster_status(&pool).await.expect("status");
        assert!(before.is_owner);
        assert!(!before.licensed);
        assert!(!before.provisioned);

        let envelope = sign_v2_envelope(&device_id);
        let after = activate_cluster_license(&pool, "test", &envelope)
            .await
            .expect("activate");

        assert!(after.licensed);
        assert!(after.provisioned);
        assert_eq!(after.cluster_id.as_deref(), Some(cluster_id.as_str()));
        assert_eq!(after.local_fingerprint.as_deref(), Some(fp_before.as_str()));

        let master_after = master_keys::load_or_create().expect("master").to_bytes();
        assert_eq!(master_before, master_after);

        std::env::remove_var("MEDOC_CLUSTER_DEVICE_SECRET");
        std::env::remove_var("MEDOC_PAIRING_MASTER_SECRET");
    }

    #[tokio::test]
    #[serial]
    async fn activation_import_does_not_imply_vendor_license_valid() {
        std::env::set_var("MEDOC_CLUSTER_DEVICE_SECRET", TEST_DEVICE_SECRET);
        std::env::set_var("MEDOC_PAIRING_MASTER_SECRET", TEST_MASTER_SECRET);

        let pool = fresh_pool().await;
        let cluster_id = uuid::Uuid::new_v4().to_string();
        let identity = DeviceIdentity::load_or_create().expect("identity");
        let master = master_keys::load_or_create().expect("master").to_bytes();

        let repos = SqliteClusterRepos { pool: &pool };
        repos
            .save(&License {
                cluster_id: cluster_id.clone(),
                license_ref: String::new(),
                signing_key_enc: master.to_vec(),
                max_total: 2,
                max_admin: 1,
                max_member: 1,
                activated_at: Utc::now(),
            })
            .await
            .expect("license");

        let device_id = license_repo::ensure_device_id(&pool).await.expect("device id");
        repos
            .upsert(&Device {
                fingerprint: identity.fingerprint.clone(),
                cluster_id: cluster_id.clone(),
                device_id,
                pubkey: identity.pubkey_bytes.to_vec(),
                hostname: None,
                os: Some("test".into()),
                last_ip: None,
                seat_role: SeatRole::Admin,
                status: DeviceStatus::Active,
                seat_cert: None,
                last_seen: Some(Utc::now()),
                created_at: Utc::now(),
            })
            .await
            .expect("device");

        let lic = license_repo::current_status(&pool).await.expect("license status");
        assert!(!lic.valid, "empty license_ref / no app_kv must not imply valid license");

        let vs = cluster_status(&pool).await.expect("cluster status");
        assert!(vs.is_owner);
        assert!(!vs.licensed);
        assert!(
            require_owner_vendor_license(&pool).await.is_err(),
            "owner admin ops must reject without vendor license"
        );

        std::env::remove_var("MEDOC_CLUSTER_DEVICE_SECRET");
        std::env::remove_var("MEDOC_PAIRING_MASTER_SECRET");
    }

    #[test]
    fn cluster_network_ready_matrix() {
        let cases = [
            (true, false, true, false, true),
            (true, true, false, true, false),
            (true, true, true, true, false),
            (false, false, true, true, false),
            (false, false, false, false, true),
            (false, true, false, true, false),
        ];
        for (is_owner, licensed, provisioned, network_ready, needs_onboarding) in cases {
            let status = ClusterStatus {
                licensed,
                provisioned,
                is_owner,
                cluster_id: None,
                seat_usage: None,
                local_fingerprint: None,
                license_valid: licensed,
                license_format: None,
                needs_reprovision: false,
            };
            assert_eq!(
                cluster_network_ready(&status),
                network_ready,
                "network_ready owner={is_owner} licensed={licensed} provisioned={provisioned}"
            );
            assert_eq!(
                needs_cluster_onboarding(&status),
                needs_onboarding,
                "needs_onboarding owner={is_owner} licensed={licensed} provisioned={provisioned}"
            );
        }
    }

    #[test]
    fn needs_cluster_onboarding_owner_requires_license() {
        let imported_owner = ClusterStatus {
            licensed: false,
            provisioned: false,
            is_owner: true,
            cluster_id: Some("c".into()),
            seat_usage: None,
            local_fingerprint: Some("fp".into()),
            license_valid: false,
            license_format: None,
            needs_reprovision: false,
        };
        assert!(needs_cluster_onboarding(&imported_owner));

        let member_provisioned = ClusterStatus {
            provisioned: true,
            is_owner: false,
            ..imported_owner.clone()
        };
        assert!(!needs_cluster_onboarding(&member_provisioned));
    }
}
