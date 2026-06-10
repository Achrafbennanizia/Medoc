//! Cluster license activation and validation.

use chrono::Utc;
use medoc_core::error::AppError;
use medoc_core::infrastructure::license::{self, LicenseStatus};
use medoc_core::infrastructure::license_repo;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::master_keys;
use crate::verbund::crypto::DeviceIdentity;
use crate::verbund::entities::{Geraet, Lizenz, SeatUsage};
use crate::verbund::enums::{GeraetStatus, SeatRolle};
use crate::verbund::ports::{GeraetRepo, LizenzRepo, SqliteVerbundRepos};
use crate::verbund::seat_budget::seat_budget_from_edition;

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
pub struct VerbundStatus {
    pub licensed: bool,
    pub provisioned: bool,
    pub is_owner: bool,
    pub cluster_id: Option<String>,
    pub seat_usage: Option<SeatUsage>,
    pub local_fingerprint: Option<String>,
    pub license_valid: bool,
    pub license_format: Option<String>,
    /// Local device row lacks fingerprint/pubkey after migration — must re-join verbund.
    pub needs_reprovision: bool,
}

/// Activate vendor license and create cluster + first ADMIN seat.
pub async fn activate_cluster_license(
    pool: &SqlitePool,
    user_id: &str,
    license_key: &str,
) -> Result<VerbundStatus, AppError> {
    let device_id = license_repo::ensure_device_id(pool).await?;
    let status = license::verify(license_key, &device_id);
    if !status.valid {
        return verbund_status(pool).await;
    }
    match status.format.as_deref() {
        Some("v2") => license_repo::store_v2(pool, license_key.trim()).await?,
        Some("v1") => license_repo::store_v1(pool, license_key.trim()).await?,
        _ => {}
    }

    let identity = DeviceIdentity::load_or_create()?;
    let cluster_id = Uuid::new_v4().to_string();
    let signing_key = master_keys::load_or_create()?;
    let signing_key_enc = signing_key.to_bytes().to_vec();
    let budget = seat_budget_from_edition(&edition_from_status(&status));

    let lizenz = Lizenz {
        cluster_id: cluster_id.clone(),
        license_ref: license_key.trim().to_string(),
        signing_key_enc,
        max_total: budget.max_total,
        max_admin: budget.max_admin,
        max_member: budget.max_member,
        activated_at: Utc::now(),
    };

    let repos = SqliteVerbundRepos { pool };
    repos.save(&lizenz).await?;

    let geraet = Geraet {
        fingerprint: identity.fingerprint.clone(),
        cluster_id: cluster_id.clone(),
        device_id: device_id.clone(),
        pubkey: identity.pubkey_bytes.to_vec(),
        hostname: None,
        os: Some(std::env::consts::OS.into()),
        last_ip: None,
        seat_role: SeatRolle::Admin,
        status: GeraetStatus::Active,
        seat_cert: None,
        last_seen: Some(Utc::now()),
        created_at: Utc::now(),
    };
    repos.upsert(&geraet).await?;

    audit::log_verbund(
        pool,
        user_id,
        "LIZENZ_ACTIVATE",
        Some(&cluster_id),
        Some("first ADMIN seat"),
    )
    .await?;

    verbund_status(pool).await
}

pub async fn verbund_status(pool: &SqlitePool) -> Result<VerbundStatus, AppError> {
    let license = license_repo::current_status(pool).await.ok();
    let licensed = license.as_ref().map(|s| s.valid).unwrap_or(false);
    let identity = DeviceIdentity::load_or_create().ok();
    let fp = identity.as_ref().map(|i| i.fingerprint.clone());

    let repos = SqliteVerbundRepos { pool };
    let lizenz = repos.load().await?;
    let provisioned = if let Some(ref f) = fp {
        super::provisioning_service::is_local_provisioned(pool, f).await?
    } else {
        false
    };

    let mut needs_reprovision = false;
    let (cluster_id, seat_usage, is_owner) = if let Some(ref l) = lizenz {
        let usage = repos.seat_usage(&l.cluster_id).await?;
        let is_owner = if let Some(ref f) = fp {
            let geraet = repos.find_by_fingerprint(f).await?;
            if let Some(ref g) = geraet {
                needs_reprovision = !g.identity_complete();
            }
            geraet
                .map(|g| {
                    g.identity_complete()
                        && g.seat_role == SeatRolle::Admin
                        && g.status == GeraetStatus::Active
                })
                .unwrap_or(false)
        } else {
            false
        };
        (Some(l.cluster_id.clone()), Some(usage), is_owner)
    } else {
        (None, None, false)
    };

    Ok(VerbundStatus {
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
