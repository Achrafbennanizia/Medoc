//! Repository ports for the device cluster (DIP).

use medoc_core::error::AppError;
use sqlx::SqlitePool;

use super::entities::{Cluster, Device, License, PairingSession, SeatUsage};
use super::enums::{DeviceStatus, PairingStatus, SeatRole};

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
    super::repo::release_revoked_pairing_seats(&mut *tx).await?;

    let sql = format!(
        "SELECT
            COALESCE(SUM(CASE WHEN seat_role = 'ADMIN' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN seat_role = 'MEMBER' THEN 1 ELSE 0 END), 0),
            COALESCE(COUNT(*), 0)
         FROM sync_device
         WHERE cluster_id = ?1
           AND {}",
        super::repo::OCCUPIED_SEAT_SQL
    );
    let row: (i64, i64, i64) = sqlx::query_as(&sql)
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

impl SqliteClusterRepos<'_> {
    pub async fn load(&self) -> Result<Option<License>, AppError> {
        super::repo::load_license(self.pool).await
    }

    pub async fn save(&self, license: &License) -> Result<(), AppError> {
        super::repo::save_license(self.pool, license).await
    }

    pub async fn seat_usage(&self, cluster_id: &str) -> Result<SeatUsage, AppError> {
        super::repo::seat_usage(self.pool, cluster_id).await
    }

    pub async fn find_by_fingerprint(&self, fingerprint: &str) -> Result<Option<Device>, AppError> {
        super::repo::find_by_fingerprint(self.pool, fingerprint).await
    }

    pub async fn upsert(&self, device: &Device) -> Result<(), AppError> {
        super::repo::upsert_device(self.pool, device).await
    }

    pub async fn list_active(&self, cluster_id: &str) -> Result<Vec<Device>, AppError> {
        super::repo::list_devices(self.pool, cluster_id).await
    }

    pub async fn set_status(
        &self,
        fingerprint: &str,
        status: DeviceStatus,
    ) -> Result<(), AppError> {
        super::repo::set_device_status(self.pool, fingerprint, status).await
    }

    pub async fn is_blocklisted(&self, fingerprint: &str) -> Result<bool, AppError> {
        super::repo::is_blocklisted(self.pool, fingerprint).await
    }

    pub async fn block(&self, fingerprint: &str, reason: &str) -> Result<(), AppError> {
        super::repo::block_fingerprint(self.pool, fingerprint, reason).await
    }

    pub async fn unblock(&self, fingerprint: &str) -> Result<(), AppError> {
        super::repo::unblock_fingerprint(self.pool, fingerprint).await
    }

    pub async fn create_session(&self, session: &PairingSession) -> Result<(), AppError> {
        super::repo::create_pairing_session(self.pool, session).await
    }

    pub async fn load_session(&self, id: &str) -> Result<Option<PairingSession>, AppError> {
        super::repo::load_pairing_session(self.pool, id).await
    }

    pub async fn update_state(
        &self,
        id: &str,
        state: PairingStatus,
        sas_hash: Option<&[u8]>,
    ) -> Result<(), AppError> {
        super::repo::update_pairing_state(self.pool, id, state, sas_hash).await
    }

    pub async fn list_pending(&self, cluster_id: &str) -> Result<Vec<PairingSession>, AppError> {
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
