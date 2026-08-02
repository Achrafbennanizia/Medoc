//! Repository ports for the device cluster (DIP).

use std::future::Future;

use medoc_core::error::AppError;
use sqlx::SqlitePool;

use super::entities::{Geraet, KopplungSession, Lizenz, SeatUsage, Verbund};
use super::enums::{GeraetStatus, KopplungStatus, SeatRolle};

pub trait LizenzRepo: Send + Sync {
    fn load(&self) -> impl Future<Output = Result<Option<Lizenz>, AppError>> + Send;
    fn save(&self, lizenz: &Lizenz) -> impl Future<Output = Result<(), AppError>> + Send;
}

pub trait GeraetRepo: Send + Sync {
    fn seat_usage(
        &self,
        cluster_id: &str,
    ) -> impl Future<Output = Result<SeatUsage, AppError>> + Send;

    fn find_by_fingerprint(
        &self,
        fingerprint: &str,
    ) -> impl Future<Output = Result<Option<Geraet>, AppError>> + Send;

    fn upsert(&self, geraet: &Geraet) -> impl Future<Output = Result<(), AppError>> + Send;

    fn list_active(
        &self,
        cluster_id: &str,
    ) -> impl Future<Output = Result<Vec<Geraet>, AppError>> + Send;

    fn set_status(
        &self,
        fingerprint: &str,
        status: GeraetStatus,
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

pub trait KopplungRepo: Send + Sync {
    fn create_session(
        &self,
        session: &KopplungSession,
    ) -> impl Future<Output = Result<(), AppError>> + Send;

    fn load_session(
        &self,
        id: &str,
    ) -> impl Future<Output = Result<Option<KopplungSession>, AppError>> + Send;

    fn update_state(
        &self,
        id: &str,
        state: KopplungStatus,
        sas_hash: Option<&[u8]>,
    ) -> impl Future<Output = Result<(), AppError>> + Send;

    fn list_pending(
        &self,
        cluster_id: &str,
    ) -> impl Future<Output = Result<Vec<KopplungSession>, AppError>> + Send;
}

/// Load verbund aggregate with current seat usage.
pub async fn load_verbund<L: LizenzRepo, G: GeraetRepo>(
    lizenz_repo: &L,
    geraet_repo: &G,
) -> Result<Option<Verbund>, AppError> {
    let Some(lizenz) = lizenz_repo.load().await? else {
        return Ok(None);
    };
    let usage = geraet_repo.seat_usage(&lizenz.cluster_id).await?;
    Ok(Some(Verbund::from_lizenz(&lizenz, usage)))
}

/// Atomically reserve a seat inside a transaction (caller provides pool).
pub async fn reserve_seat_atomic(
    pool: &SqlitePool,
    cluster_id: &str,
    role: SeatRolle,
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
           AND geraet_status IN ('PENDING','ACTIVE')",
    )
    .bind(cluster_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(AppError::Database)?;

    let admin_used = row.0 as u32;
    let member_used = row.1 as u32;
    let total_used = row.2 as u32;

    let verbund = Verbund {
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
    verbund.reserve_seat(role)?;

    tx.commit().await.map_err(AppError::Database)?;
    Ok(())
}

#[derive(Clone, Copy)]
pub struct SqliteVerbundRepos<'a> {
    pub pool: &'a SqlitePool,
}

impl LizenzRepo for SqliteVerbundRepos<'_> {
    async fn load(&self) -> Result<Option<Lizenz>, AppError> {
        super::repo::load_lizenz(self.pool).await
    }

    async fn save(&self, lizenz: &Lizenz) -> Result<(), AppError> {
        super::repo::save_lizenz(self.pool, lizenz).await
    }
}

impl GeraetRepo for SqliteVerbundRepos<'_> {
    async fn seat_usage(&self, cluster_id: &str) -> Result<SeatUsage, AppError> {
        super::repo::seat_usage(self.pool, cluster_id).await
    }

    async fn find_by_fingerprint(&self, fingerprint: &str) -> Result<Option<Geraet>, AppError> {
        super::repo::find_by_fingerprint(self.pool, fingerprint).await
    }

    async fn upsert(&self, geraet: &Geraet) -> Result<(), AppError> {
        super::repo::upsert_geraet(self.pool, geraet).await
    }

    async fn list_active(&self, cluster_id: &str) -> Result<Vec<Geraet>, AppError> {
        super::repo::list_geraete(self.pool, cluster_id).await
    }

    async fn set_status(&self, fingerprint: &str, status: GeraetStatus) -> Result<(), AppError> {
        super::repo::set_geraet_status(self.pool, fingerprint, status).await
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

impl KopplungRepo for SqliteVerbundRepos<'_> {
    async fn create_session(&self, session: &KopplungSession) -> Result<(), AppError> {
        super::repo::create_kopplung_session(self.pool, session).await
    }

    async fn load_session(&self, id: &str) -> Result<Option<KopplungSession>, AppError> {
        super::repo::load_kopplung_session(self.pool, id).await
    }

    async fn update_state(
        &self,
        id: &str,
        state: KopplungStatus,
        sas_hash: Option<&[u8]>,
    ) -> Result<(), AppError> {
        super::repo::update_kopplung_state(self.pool, id, state, sas_hash).await
    }

    async fn list_pending(&self, cluster_id: &str) -> Result<Vec<KopplungSession>, AppError> {
        super::repo::list_pending_kopplung(self.pool, cluster_id).await
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
