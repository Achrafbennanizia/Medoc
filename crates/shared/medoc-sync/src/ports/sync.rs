//! Sync replication persistence port (outbox, vectors, deployment config).

use std::future::Future;

use medoc_core::error::AppError;
use sqlx::SqlitePool;

use crate::deployment::SyncDeploymentConfig;
use crate::repo::{OutboxEntry, SyncStatusSnapshot};

/// Contract for local sync state + outbox (portable across binaries).
pub trait SyncReplicationStore: Send + Sync {
    fn ensure_local_device(
        &self,
        label: &str,
    ) -> impl Future<Output = Result<String, AppError>> + Send;

    fn load_deployment(
        &self,
    ) -> impl Future<Output = Result<SyncDeploymentConfig, AppError>> + Send;

    fn save_deployment(
        &self,
        cfg: &SyncDeploymentConfig,
    ) -> impl Future<Output = Result<(), AppError>> + Send;

    fn status_snapshot(&self) -> impl Future<Output = Result<SyncStatusSnapshot, AppError>> + Send;

    fn append_outbox(
        &self,
        device_id: &str,
        entity_table: &str,
        entity_id: &str,
        op: &str,
        payload_json: &str,
    ) -> impl Future<Output = Result<OutboxEntry, AppError>> + Send;
}

#[derive(Clone, Copy)]
pub struct SqliteSyncStore<'a>(pub &'a SqlitePool);

impl SyncReplicationStore for SqliteSyncStore<'_> {
    async fn ensure_local_device(&self, label: &str) -> Result<String, AppError> {
        crate::repo::ensure_local_device(self.0, label).await
    }

    async fn load_deployment(&self) -> Result<SyncDeploymentConfig, AppError> {
        crate::repo::load_deployment(self.0).await
    }

    async fn save_deployment(&self, cfg: &SyncDeploymentConfig) -> Result<(), AppError> {
        crate::repo::save_deployment(self.0, cfg).await
    }

    async fn status_snapshot(&self) -> Result<SyncStatusSnapshot, AppError> {
        crate::repo::status_snapshot(self.0).await
    }

    async fn append_outbox(
        &self,
        device_id: &str,
        entity_table: &str,
        entity_id: &str,
        op: &str,
        payload_json: &str,
    ) -> Result<OutboxEntry, AppError> {
        crate::repo::append_outbox(self.0, device_id, entity_table, entity_id, op, payload_json)
            .await
    }
}
