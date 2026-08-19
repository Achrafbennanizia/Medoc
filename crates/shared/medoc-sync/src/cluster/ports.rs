//! Repository ports for the device cluster (DIP).

use std::future::Future;

use medoc_core::error::AppError;
use sqlx::SqlitePool;

use super::entities::{Device, PairingSession, License, SeatUsage, Cluster};
use super::enums::{DeviceStatus, PairingStatus, SeatRole};

pub trait LicenseRepo: Send + Sync {
    fn load(&self) -> impl Future<Output = Result<Option<License>, AppError>> + Send;
    fn save(&self, license: &License) -> impl Future<Output = Result<(), AppError>> + Send;
}

pub trait DeviceRepo: Send + Sync {
    fn seat_usage(
        &self,
        cluster_id: &str,
    ) -> impl Future<Output = Result<SeatUsage, AppError>> + Send;

    fn find_by_fingerprint(
        &self,
        fingerprint: &str,
    ) -> impl Future<Output = Result<Option<Device>, AppError>> + Send;

    fn upsert(&self, device: &Device) -> impl Future<Output = Result<(), AppError>> + Send;

    fn list_active(
        &self,
        cluster_id: &str,
    ) -> impl Future<Output = Result<Vec<Device>, AppError>> + Send;

    fn set_status(
        &self,
        fingerprint: &str,
        status: DeviceStatus,
    ) -> impl Future<Output = Result<(), AppError>> + Send;

    fn is_blocklisted(
        &self,
        fingerprint: &str,
    ) -> impl Future<Output = Result<bool, AppError>> + Send;

    fn block(
        &self,
        fingerprint: &str,
        reason: &str,
    ) -> impl Future<Output = Result<(), AppError>> + Send;

    fn unblock(&self, fingerprint: &str) -> impl Future<Output = Result<(), AppError>> + Send;
}

pub trait PairingRepo: Send + Sync {
    fn create_session(
        &self,
        session: &PairingSession,
    ) -> impl Future<Output = Result<(), AppError>> + Send;

    fn load_session(
        &self,
        id: &str,
    ) -> impl Future<Output = Result<Option<PairingSession>, AppError>> + Send;

    fn update_state(
        &self,
        id: &str,
        state: PairingStatus,
        sas_hash: Option<&[u8]>,
    ) -> impl Future<Output = Result<(), AppError>> + Send;

    fn list_pending(
        &self,
        cluster_id: &str,
    ) -> impl Future<Output = Result<Vec<PairingSession>, AppError>> + Send;
}

/// Load cluster aggregate with current seat usage.
pub async fn load_cluster<L: LicenseRepo, G: DeviceRepo>(
    license_repo: &L,
    geraet_repo: &G,
) -> Result<Option<Cluster>, AppError> {
    let Some(license) = license_repo.load().await? else {
        return Ok(None);
    };
    let usage = geraet_repo.seat_usage(&license.cluster_id).await?;
    Ok(Some(Cluster::from_license(&license, usage)))
}

/// Atomically reserve a seat inside a transaction (caller provides pool).
pub async fn reserve_seat_atomic(
    pool: &SqlitePool,
    cluster_id: &str,
    role: SeatRole,
    max_total: u32,
    max_admin: u32,
    max_member: u32,
) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(AppError::Database)?;

    let row: (i64, i64, i64) = sqlx::query_as(
        "SELECT
            SUM(CASE WHEN seat_role = 'ADMIN' THEN 1 ELSE 0 END),
            SUM(CASE WHEN seat_role = 'MEMBER' THEN 1 ELSE 0 END),
            COUNT(*)
         FROM sync_device
         WHERE cluster_id = ?1
           AND device_status IN ('PENDING','ACTIVE')",
    )
    .bind(cluster_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(AppError::Database)?;

    let admin_used = row.0 as u32;
    let member_used = row.1 as u32;
    let total_used = row.2 as u32;

    let cluster = Cluster {
        cluster_id: cluster_id.to_string(),
        max_total,
        max_admin,
        max_member,
        usage: SeatUsage {
            admin_used,
            member_used,
            total_used,
            max_admin,
            max_member,
            max_total,
        },
    };
    cluster.reserve_seat(role)?;

    tx.commit().await.map_err(AppError::Database)?;
    Ok(())
}

#[derive(Clone, Copy)]
pub struct SqliteClusterRepos<'a> {
    pub pool: &'a SqlitePool,
}

impl LicenseRepo for SqliteClusterRepos<'_> {
    async fn load(&self) -> Result<Option<License>, AppError> {
        super::repo::load_license(self.pool).await
    }

    async fn save(&self, license: &License) -> Result<(), AppError> {
        super::repo::save_license(self.pool, license).await
    }
}

impl DeviceRepo for SqliteClusterRepos<'_> {
    async fn seat_usage(&self, cluster_id: &str) -> Result<SeatUsage, AppError> {
        super::repo::seat_usage(self.pool, cluster_id).await
    }

    async fn find_by_fingerprint(&self, fingerprint: &str) -> Result<Option<Device>, AppError> {
        super::repo::find_by_fingerprint(self.pool, fingerprint).await
    }

    async fn upsert(&self, device: &Device) -> Result<(), AppError> {
        super::repo::upsert_device(self.pool, device).await
    }

    async fn list_active(&self, cluster_id: &str) -> Result<Vec<Device>, AppError> {
        super::repo::list_devices(self.pool, cluster_id).await
    }

    async fn set_status(&self, fingerprint: &str, status: DeviceStatus) -> Result<(), AppError> {
        super::repo::set_device_status(self.pool, fingerprint, status).await
    }

    async fn is_blocklisted(&self, fingerprint: &str) -> Result<bool, AppError> {
        super::repo::is_blocklisted(self.pool, fingerprint).await
    }

    async fn block(&self, fingerprint: &str, reason: &str) -> Result<(), AppError> {
        super::repo::block_fingerprint(self.pool, fingerprint, reason).await
    }

    async fn unblock(&self, fingerprint: &str) -> Result<(), AppError> {
        super::repo::unblock_fingerprint(self.pool, fingerprint).await
    }
}

impl PairingRepo for SqliteClusterRepos<'_> {
    async fn create_session(&self, session: &PairingSession) -> Result<(), AppError> {
        super::repo::create_pairing_session(self.pool, session).await
    }

    async fn load_session(&self, id: &str) -> Result<Option<PairingSession>, AppError> {
        super::repo::load_pairing_session(self.pool, id).await
    }

    async fn update_state(
        &self,
        id: &str,
        state: PairingStatus,
        sas_hash: Option<&[u8]>,
    ) -> Result<(), AppError> {
        super::repo::update_pairing_state(self.pool, id, state, sas_hash).await
    }

    async fn list_pending(&self, cluster_id: &str) -> Result<Vec<PairingSession>, AppError> {
        super::repo::list_pending_pairing(self.pool, cluster_id).await
    }
}

/// Provisioning idempotency guard.
pub async fn is_provisioned(pool: &SqlitePool, fingerprint: &str) -> Result<bool, AppError> {
    super::repo::is_provisioned(pool, fingerprint).await
}

pub async fn mark_provisioned(pool: &SqlitePool, fingerprint: &str) -> Result<(), AppError> {
    super::repo::mark_provisioned(pool, fingerprint).await
}

pub async fn provisioning_counter(pool: &SqlitePool, fingerprint: &str) -> Result<i64, AppError> {
    super::repo::provisioning_counter(pool, fingerprint).await
}
