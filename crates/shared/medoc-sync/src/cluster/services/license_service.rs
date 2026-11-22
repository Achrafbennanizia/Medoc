//! Cluster license activation and validation.

use chrono::Utc;
use medoc_core::error::AppError;
use medoc_core::infrastructure::database::repos::admin::license as license_repo;
use medoc_core::infrastructure::license::{self, LicenseStatus};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::cluster::crypto::DeviceIdentity;
use crate::cluster::entities::{Device, License, SeatUsage};
use crate::cluster::enums::{DeviceStatus, SeatRole};
use crate::cluster::ports::{mark_provisioned, SqliteClusterRepos};
use crate::cluster::seat_budget::seat_budget_from_edition;
use crate::master_keys;

use super::audit;
use super::install_plan_service::apply_install_plan_from_license_v2;

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
    pub needs_bridge_b_passphrase: bool,
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
    medoc_core::domain::device::require_can_host()?;
    let status = cluster_status(pool).await?;
    if (status.cluster_id.is_some() || status.provisioned) && !status.is_owner {
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
    let license_key: String = license_key.chars().filter(|c| !c.is_whitespace()).collect();
    let device_id = license_repo::ensure_device_id(pool).await?;
    let status = license::verify(&license_key, &device_id);
    if !status.valid {
        let reason = status
            .reason
            .unwrap_or_else(|| "License key is not valid for this PC.".into());
        tracing::warn!(
            target: "medoc::system",
            event = "LICENSE_ACTIVATE_REJECTED",
            reason = %reason,
            "license rejected"
        );
        if let Some(code) = license::user_license_error_code(&reason) {
            return Err(AppError::validation_code(code));
        }
        return Err(AppError::Validation(reason));
    }
    match status.format.as_deref() {
        Some("v2") => license_repo::store_v2(pool, &license_key).await?,
        Some("v1") => license_repo::store_v1(pool, &license_key).await?,
        _ => {}
    }

    let repos = SqliteClusterRepos { pool };
    let budget = seat_budget_from_edition(&edition_from_status(&status));

    if let Some(mut existing) = repos.load().await? {
        existing.license_ref = license_key.clone();
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
        if let Some(v2) = &status.license_v2 {
            apply_install_plan_from_license_v2(pool, v2).await?;
        }
        return cluster_status(pool).await;
    }

    let identity = DeviceIdentity::load_or_create()?;
    let cluster_id = Uuid::new_v4().to_string();
    let signing_key = master_keys::load_or_create()?;
    let signing_key_enc = signing_key.to_bytes().to_vec();

    let license = License {
        cluster_id: cluster_id.clone(),
        license_ref: license_key.clone(),
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

    if let Some(v2) = &status.license_v2 {
        apply_install_plan_from_license_v2(pool, v2).await?;
    }

    cluster_status(pool).await
}

/// USB installer: mint a device-bound v2 key, activate the cluster owner seat, and
/// turn on LAN auto-start so the next app launch brings services up.
pub fn mint_and_activate_usb_owner_license(
    app_data_dir: &std::path::Path,
    customer_id: &str,
    edition: &str,
) -> Result<String, AppError> {
    let app_data_dir = app_data_dir.to_path_buf();
    let customer_id = customer_id.to_string();
    let edition = edition.to_string();
    let join = std::thread::Builder::new()
        .name("medoc-usb-license-activate".into())
        .spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .map_err(|e| AppError::Internal(format!("tokio: {e}")))?;
            rt.block_on(async move {
                let pool = medoc_core::infrastructure::database::connection::init_db_headless(
                    &app_data_dir,
                )
                .await?;
                let device_id = license_repo::ensure_device_id(&pool).await?;
                medoc_core::infrastructure::database::repos::admin::app_kv::set(
                    &pool,
                    crate::deployment::APP_KV_DEVICE_ID_KEY,
                    &device_id,
                )
                .await?;
                let envelope =
                    license::mint_dev_v2_license_envelope(&device_id, &customer_id, &edition)?;
                activate_cluster_license(&pool, "usb-setup", &envelope).await?;
                enable_lan_auto_start(&pool).await?;
                pool.close().await;
                Ok(envelope)
            })
        })
        .map_err(|e| AppError::Internal(format!("license thread: {e}")))?;
    join.join()
        .map_err(|_| AppError::Internal("license thread panicked".into()))?
}

pub async fn enable_lan_auto_start(pool: &SqlitePool) -> Result<(), AppError> {
    const KEY: &str = "lan.server.config.v1";
    let mut cfg = if let Some(raw) =
        medoc_core::infrastructure::database::repos::admin::app_kv::get(pool, KEY).await?
    {
        serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    if !cfg.is_object() {
        cfg = serde_json::json!({});
    }
    let obj = cfg.as_object_mut().expect("object");
    obj.entry("schemaVersion")
        .or_insert_with(|| serde_json::json!(1));
    obj.entry("bindAddr")
        .or_insert_with(|| serde_json::json!("0.0.0.0"));
    obj.entry("httpPort")
        .or_insert_with(|| serde_json::json!(8787));
    obj.entry("udpDiscoveryPort")
        .or_insert_with(|| serde_json::json!(47_830));
    obj.entry("instanceLabel")
        .or_insert_with(|| serde_json::json!("MeDoc Practice"));
    obj.insert("autoStartWithApp".into(), serde_json::json!(true));
    obj.entry("extraCorsOrigins")
        .or_insert_with(|| serde_json::json!([]));
    medoc_core::infrastructure::database::repos::admin::app_kv::set(pool, KEY, &cfg.to_string())
        .await
}

pub async fn cluster_status(pool: &SqlitePool) -> Result<ClusterStatus, AppError> {
    let vendor = license_repo::current_status(pool).await.ok();
    let licensed = vendor.as_ref().map(|s| s.valid).unwrap_or(false);

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
    let mut provisioned = if let Some(ref f) = fp {
        super::provisioning_service::is_local_provisioned(pool, f).await?
    } else {
        false
    };

    let mut needs_reprovision = false;
    let (cluster_id, seat_usage, mut is_owner) = if let Some(ref l) = license {
        let usage = repos.seat_usage(&l.cluster_id).await?;
        let fp_device = if let Some(ref f) = fp {
            repos.find_by_fingerprint(f).await?
        } else {
            None
        };
        let mut is_owner = if let Some(ref g) = fp_device {
            needs_reprovision = !g.identity_complete();
            g.identity_complete()
                && g.seat_role == SeatRole::Admin
                && g.status == DeviceStatus::Active
        } else {
            false
        };
        // Device-id fallback is only for rows that have no fingerprint identity yet.
        if fp_device.is_none() {
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

    if let Ok(snap) = crate::engine::SyncEngine::status(pool).await {
        if snap.deployment.role == crate::deployment::DeviceRole::Replica {
            is_owner = false;
            if !provisioned {
                provisioned = !snap.deployment.master_base_url.trim().is_empty()
                    || super::staff_directory::load_join_admin_endpoint(pool)
                        .await?
                        .is_some();
            }
        }
    }

    Ok(ClusterStatus {
        licensed,
        provisioned,
        is_owner,
        cluster_id,
        seat_usage,
        local_fingerprint: fp,
        license_valid: vendor.as_ref().map(|s| s.valid).unwrap_or(false),
        license_format: vendor.and_then(|s| s.format),
        needs_reprovision,
    })
}

#[cfg(test)]
mod tests {
    use crate::schema::ensure_sync_tables;
    use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
    use chrono::{TimeZone, Utc};
    use ed25519_dalek::Signer;
    use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
    use medoc_core::infrastructure::license::{encrypt_v2_for_device, LicenseV2, VENDOR_PUBKEY};
    use serial_test::serial;

    use super::*;
    use crate::cluster::enums::{DeviceStatus, SeatRole};
    use crate::cluster::ports::SqliteClusterRepos;
    use crate::master_keys;

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
            install_plan: None,
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
        let audit_dir =
            std::env::temp_dir().join(format!("medoc-sync-test-audit-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&audit_dir).expect("audit dir");
        medoc_core::infrastructure::database::repos::admin::audit::init_audit_hmac_key(&audit_dir)
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

        let device_id = license_repo::ensure_device_id(&pool)
            .await
            .expect("device id");
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

        let device_id = license_repo::ensure_device_id(&pool)
            .await
            .expect("device id");
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

        let lic = license_repo::current_status(&pool)
            .await
            .expect("license status");
        assert!(
            !lic.valid,
            "empty license_ref / no app_kv must not imply valid license"
        );

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

    #[tokio::test]
    #[serial]
    async fn sas_replica_activation_demotes_owner_and_skips_onboarding() {
        std::env::set_var("MEDOC_CLUSTER_DEVICE_SECRET", TEST_DEVICE_SECRET);
        std::env::set_var("MEDOC_PAIRING_MASTER_SECRET", TEST_MASTER_SECRET);

        let pool = fresh_pool().await;
        let cluster_id = uuid::Uuid::new_v4().to_string();
        let identity = DeviceIdentity::load_or_create().expect("identity");
        let repos = SqliteClusterRepos { pool: &pool };
        let master_before = master_keys::load_or_create().expect("master").to_bytes();
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
        let device_id = license_repo::ensure_device_id(&pool)
            .await
            .expect("device id");
        repos
            .upsert(&Device {
                fingerprint: identity.fingerprint.clone(),
                cluster_id,
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
        mark_provisioned(&pool, &identity.fingerprint)
            .await
            .expect("provisioned");
        crate::cluster::services::store_join_admin_endpoint(&pool, "192.168.1.10", 49300)
            .await
            .expect("admin endpoint");
        let pin = "ab".repeat(32);
        crate::cluster::services::store_join_lan_auth(
            &pool,
            Some("mt2.pending"),
            Some("pk"),
            Some("master-device"),
            Some(&pin),
        )
        .await
        .expect("lan auth");

        let before = cluster_status(&pool).await.expect("before");
        assert!(before.is_owner);
        assert!(before.provisioned);
        assert!(needs_cluster_onboarding(&before));

        crate::cluster::services::activate_replica_after_sas_confirm(&pool)
            .await
            .expect("replica activate");

        let after = cluster_status(&pool).await.expect("after");
        assert!(!after.is_owner);
        assert!(after.provisioned);
        assert!(!needs_cluster_onboarding(&after));
        let snap = crate::engine::SyncEngine::status(&pool)
            .await
            .expect("deployment");
        assert_eq!(snap.deployment.role, crate::deployment::DeviceRole::Replica);
        // No HTTP port stored from the join reply: default LAN port, never the cluster port.
        assert_eq!(snap.deployment.master_base_url, "https://192.168.1.10:8787");
        assert_eq!(snap.deployment.master_cert_sha256, pin);
        let setup = medoc_core::infrastructure::database::repos::admin::app_kv::get(
            &pool,
            "onboarding.setup_complete.v1",
        )
        .await
        .expect("kv");
        assert_eq!(setup.as_deref(), Some("1"));

        // F24: the main device's LAN port from the join reply wins over the default.
        crate::cluster::services::store_join_http_port(&pool, Some(9443))
            .await
            .expect("store http port");
        crate::cluster::services::activate_replica_after_sas_confirm(&pool)
            .await
            .expect("re-activate");
        let snap = crate::engine::SyncEngine::status(&pool)
            .await
            .expect("deployment");
        assert_eq!(snap.deployment.master_base_url, "https://192.168.1.10:9443");

        std::env::remove_var("MEDOC_CLUSTER_DEVICE_SECRET");
        std::env::remove_var("MEDOC_PAIRING_MASTER_SECRET");
    }

    #[tokio::test]
    #[serial]
    async fn replica_role_clears_owner_even_with_leftover_admin_device_id_row() {
        std::env::set_var("MEDOC_CLUSTER_DEVICE_SECRET", TEST_DEVICE_SECRET);
        std::env::set_var("MEDOC_PAIRING_MASTER_SECRET", TEST_MASTER_SECRET);

        let pool = fresh_pool().await;
        let cluster_id = uuid::Uuid::new_v4().to_string();
        let identity = DeviceIdentity::load_or_create().expect("identity");
        let repos = SqliteClusterRepos { pool: &pool };
        repos
            .save(&License {
                cluster_id: cluster_id.clone(),
                license_ref: String::new(),
                signing_key_enc: master_keys::load_or_create()
                    .expect("master")
                    .to_bytes()
                    .to_vec(),
                max_total: 2,
                max_admin: 1,
                max_member: 1,
                activated_at: Utc::now(),
            })
            .await
            .expect("license");
        repos
            .upsert(&Device {
                fingerprint: "leftover-admin-fp".into(),
                cluster_id: cluster_id.clone(),
                device_id: license_repo::ensure_device_id(&pool)
                    .await
                    .expect("device id"),
                pubkey: vec![3u8; 32],
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
            .expect("leftover admin");
        repos
            .upsert(&Device {
                fingerprint: identity.fingerprint.clone(),
                cluster_id,
                device_id: identity.fingerprint.clone(),
                pubkey: identity.pubkey_bytes.to_vec(),
                hostname: None,
                os: Some("test".into()),
                last_ip: None,
                seat_role: SeatRole::Member,
                status: DeviceStatus::Active,
                seat_cert: None,
                last_seen: Some(Utc::now()),
                created_at: Utc::now(),
            })
            .await
            .expect("member");
        mark_provisioned(&pool, &identity.fingerprint)
            .await
            .expect("provisioned");
        crate::cluster::services::store_join_admin_endpoint(&pool, "192.168.1.10", 49300)
            .await
            .expect("admin endpoint");
        crate::cluster::services::activate_replica_after_sas_confirm(&pool)
            .await
            .expect("replica activate");

        let after = cluster_status(&pool).await.expect("after");
        assert!(!after.is_owner);
        assert!(after.provisioned);

        std::env::remove_var("MEDOC_CLUSTER_DEVICE_SECRET");
        std::env::remove_var("MEDOC_PAIRING_MASTER_SECRET");
    }
}
